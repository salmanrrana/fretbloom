//! Deterministic, bounded mono-PCM music evidence. No I/O or worker threads.
mod chords;
mod config;
mod naming;
mod pitch;
mod polyphony;
mod ratio_gate;
mod segments;
mod spectrum;
mod types;
mod voice_evidence;
pub use chords::chord_vocabulary;
pub use naming::{chord_label, pitch_name};
pub use types::*;
pub const SAMPLE_RATE_HZ: u32 = 24_000;
pub const ENGINE_VERSION: &str = "rust-dsp-3.1";

pub fn analyze(
    mono: &[f32],
    sample_rate_hz: u32,
    options: &AnalysisOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
    progress: &mut dyn FnMut(AnalysisProgress),
) -> Result<AnalysisOutput, AnalysisError> {
    use config::*;
    if sample_rate_hz != SAMPLE_RATE_HZ {
        return Err(AnalysisError::InvalidInput(
            "sample rate must be 24000 Hz".into(),
        ));
    }
    if mono.is_empty() {
        return Err(AnalysisError::InvalidInput("PCM is empty".into()));
    }
    if mono.len() > MAX_SAMPLES {
        return Err(AnalysisError::LimitExceeded(
            "duration exceeds 600 seconds".into(),
        ));
    }
    if !options.concert_a_hz.is_finite() || !(432.0..=446.0).contains(&options.concert_a_hz) {
        return Err(AnalysisError::InvalidInput(
            "concert A must be 432..446 Hz".into(),
        ));
    }
    let mut clipping = false;
    for chunk in mono.chunks(HOP) {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        for &x in chunk {
            if !x.is_finite() {
                return Err(AnalysisError::InvalidInput(
                    "PCM contains non-finite samples".into(),
                ));
            }
            clipping |= x.abs() > 1.0;
        }
    }
    progress(AnalysisProgress {
        processed_samples: 0,
        total_samples: mono.len() as u64,
    });
    let duration = mono.len() as f64 / SAMPLE_RATE_HZ as f64;
    let mut short = spectrum::SpectralAnalyzer::new(WINDOW);
    let mut long = spectrum::SpectralAnalyzer::new(BASS_WINDOW);
    let mut local = spectrum::SpectralAnalyzer::new(1024);
    let mut yin = pitch::Yin::new();
    // Circular peak tuning estimate over at most 30 seconds; no full spectrogram is retained.
    let mut circular = [0.0_f64; 3];
    for center in (WINDOW / 2..mono.len().min(30 * SAMPLE_RATE_HZ as usize))
        .step_by(SAMPLE_RATE_HZ as usize / 4)
    {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let s = short.compute(mono, center);
        if s.flatness > 0.25 || s.tonal_fraction < 0.55 {
            continue;
        }
        let maximum = s.peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
        for p in s
            .peaks
            .iter()
            .filter(|p| p.hz > 75.0 && p.hz < 2000.0 && p.amplitude > maximum * 0.2)
        {
            let cents = 1200.0 * (p.hz / options.concert_a_hz).log2();
            let phase = cents * std::f64::consts::TAU / 100.0;
            let w = p.amplitude;
            circular[0] += phase.cos() * w;
            circular[1] += phase.sin() * w;
            circular[2] += w;
        }
    }
    let concentration = circular[0].hypot(circular[1]) / circular[2].max(1e-12);
    let tuning = if concentration > 0.65 && circular[2] > 1e-5 {
        Some(circular[1].atan2(circular[0]) * 100.0 / std::f64::consts::TAU)
    } else {
        None
    };
    let mut frames: Vec<segments::Frame> = Vec::with_capacity(mono.len().div_ceil(HOP));
    let mut bass = None;
    let mut evidence = voice_evidence::VoiceEvidence::new();
    let mut uncertain_hops = [0_u8; (MAX_MIDI - MIN_MIDI + 1) as usize];
    for (i, chunk) in mono.chunks(HOP).enumerate() {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let rms =
            (chunk.iter().map(|&v| (v as f64).powi(2)).sum::<f64>() / chunk.len() as f64).sqrt();
        let silent = rms < SILENCE_RMS;
        if silent {
            evidence.reset();
            uncertain_hops.fill(0);
            frames.push(segments::Frame {
                notes: vec![],
                mono: None,
                bass: None,
                rms,
                silent: true,
                tonal: false,
                dense: false,
                absent: u128::MAX,
            });
            continue;
        }
        let center = i * HOP + chunk.len() / 2;
        let s = short.compute(mono, center);
        let measured = if s.peak_energy_fraction > MIN_PEAK_ENERGY_FRACTION {
            local.measure(mono, center, &s.peaks, cancelled)?
        } else {
            Vec::new()
        };
        let known = frames.last().map(|f| f.notes.as_slice()).unwrap_or(&[]);
        let temporal = evidence.observe(&measured, options.concert_a_hz, known, cancelled)?;
        // Local peak prominence follows the current spectrum. A previous noisy
        // attack must not veto independently supported partials in a later decay.
        // Centered FFT evidence must also be audible in this cell; nearby loud
        // notes must not fill a quiet, nonzero room-noise gap.
        let tonal = s.peak_energy_fraction > MIN_PEAK_ENERGY_FRACTION
            && rms >= s.rms * MIN_CELL_WINDOW_RMS_RATIO;
        let mut fit = if tonal {
            polyphony::fit(
                &s,
                options.concert_a_hz,
                tuning.unwrap_or(0.0),
                Some(&temporal),
                cancelled,
            )?
        } else {
            polyphony::Fit {
                notes: vec![],
                residual: 1.0,
            }
        };
        if i % 4 == 0 || bass.is_none() {
            let s = long.compute(mono, center);
            let low = if tonal {
                polyphony::fit(
                    &s,
                    options.concert_a_hz,
                    tuning.unwrap_or(0.0),
                    None,
                    cancelled,
                )?
            } else {
                polyphony::Fit {
                    notes: vec![],
                    residual: 1.0,
                }
            };
            bass = low.notes.first().copied();
        }
        let mut present = [None; (MAX_MIDI - MIN_MIDI + 1) as usize];
        let mut current_support = |note: polyphony::Pitch| {
            let index = (note.midi - MIN_MIDI) as usize;
            *present[index].get_or_insert_with(|| {
                let support =
                    voice_evidence::current_support(mono, center, note, options.concert_a_hz, &s);
                let continuing = frames
                    .last()
                    .is_some_and(|f| f.notes.iter().any(|n| n.midi == note.midi));
                match support {
                    voice_evidence::Continuation::Confirmed => {
                        uncertain_hops[index] = 0;
                        support
                    }
                    voice_evidence::Continuation::Uncertain
                        if continuing && uncertain_hops[index] < 2 =>
                    {
                        // A measured current band can bridge at most 40 ms of
                        // phase uncertainty; demonstrated absence never bridges.
                        uncertain_hops[index] += 1;
                        voice_evidence::Continuation::Confirmed
                    }
                    _ => {
                        uncertain_hops[index] = 3;
                        support
                    }
                }
            })
        };
        let mut absent = 0_u128;
        let previous = frames.last().map(|f| f.notes.as_slice()).unwrap_or(&[]);
        for note in fit.notes.iter().chain(previous).chain(bass.iter()) {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            if current_support(*note) == voice_evidence::Continuation::Absent {
                absent |= 1_u128 << (note.midi - MIN_MIDI);
            }
        }
        fit.notes
            .retain(|p| current_support(*p) == voice_evidence::Continuation::Confirmed);
        bass = bass.filter(|p| current_support(*p) == voice_evidence::Continuation::Confirmed);
        let mut single = None;
        if tonal && s.supported {
            if let Some(p) = yin.estimate(mono, center, options.concert_a_hz) {
                // A periodic estimate must explain the observed partials, not just correlate.
                let fundamental = options.concert_a_hz
                    * 2.0_f64.powf((p.midi as f64 - 69.0 + p.cents / 100.0) / 12.0);
                let mut all = 0.0;
                let mut explained = 0.0;
                let mut tightly_explained = 0.0;
                for peak in &s.peaks {
                    let weight = peak.amplitude.powi(2);
                    all += weight;
                    let harmonic = (peak.hz / fundamental).round();
                    if harmonic >= 1.0
                        && (1200.0 * (peak.hz / (fundamental * harmonic)).log2()).abs() < 30.0
                    {
                        explained += weight;
                        if (1200.0 * (peak.hz / (fundamental * harmonic)).log2()).abs() < 8.0 {
                            tightly_explained += weight;
                        }
                    }
                }
                let peak_max = s.peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
                let fundamental_observed = s.peaks.iter().any(|peak| {
                    (1200.0 * (peak.hz / fundamental).log2()).abs() < 35.0
                        && peak.amplitude > peak_max * 0.03
                });
                let independent = fit.notes.len() > 1
                    || fit.notes.iter().any(|n| {
                        let frequency = options.concert_a_hz
                            * 2.0_f64.powf((n.midi as f64 - 69.0 + n.cents / 100.0) / 12.0);
                        let harmonic = (frequency / fundamental).round();
                        harmonic < 1.0
                            || (1200.0 * (frequency / (fundamental * harmonic)).log2()).abs() > 25.0
                    });
                if explained / all.max(1e-15) > 0.96
                    && p.support > 0.86
                    && fundamental_observed
                    && absent & (1_u128 << (p.midi - MIN_MIDI)) == 0
                    && current_support(p) == voice_evidence::Continuation::Confirmed
                    && !fit.notes.iter().any(|n| {
                        temporal.independent(n.midi)
                            && fit
                                .notes
                                .iter()
                                .any(|other| other.midi == temporal.parent(n.midi))
                    })
                    && (!independent || tightly_explained / all.max(1e-15) > 0.98)
                {
                    single = Some(p);
                    fit.notes = vec![p];
                    bass = Some(p);
                }
            }
        }
        frames.push(segments::Frame {
            absent,
            dense: fit.notes.len() >= 6 && fit.residual > 0.25,
            notes: fit.notes,
            mono: single,
            bass: if tonal { bass } else { None },
            rms,
            silent: false,
            tonal,
        });
        progress(AnalysisProgress {
            processed_samples: ((i + 1) * HOP).min(mono.len()) as u64,
            total_samples: mono.len() as u64,
        });
    }
    let dense = frames.iter().filter(|f| f.dense).count() > 10;
    let low_signal = frames.iter().all(|f| f.rms < LOW_SIGNAL_RMS);
    let (harmony, monophonic_notes, polyphonic_notes, features) =
        segments::finish(frames, duration, options, cancelled)?;
    let mut warnings = Vec::new();
    if clipping {
        warnings.push(AnalysisWarning {
            code: WarningCode::Clipping,
            message: "Finite samples outside [-1,1] were clamped for spectral analysis.".into(),
        });
    }
    if low_signal {
        warnings.push(AnalysisWarning {
            code: WarningCode::LowSignal,
            message: "Recording is silent or below the nominal -65 dBFS signal floor.".into(),
        });
    }
    if tuning.is_none() {
        warnings.push(AnalysisWarning {
            code: WarningCode::TuningUncertain,
            message: "Stable peak evidence did not establish a global tuning offset.".into(),
        });
    }
    if dense {
        warnings.push(AnalysisWarning{code:WarningCode::DensePolyphony,message:"Residual tonal energy remained after the six-note fit; some voices may be unresolved.".into()});
    }
    let result = AnalysisResult {
        schema_version: 1,
        engine_version: ENGINE_VERSION.into(),
        options: options.clone(),
        duration,
        sample_rate_hz: SAMPLE_RATE_HZ,
        timing_resolution_seconds: 0.02,
        tuning: Tuning {
            reference_hz: options.concert_a_hz,
            estimated_offset_cents: tuning,
        },
        harmony,
        monophonic_notes,
        polyphonic_notes,
        warnings,
    };
    if cancelled() {
        return Err(AnalysisError::Cancelled);
    }
    if serde_json::to_vec(&result)
        .map_err(|e| AnalysisError::LimitExceeded(e.to_string()))?
        .len()
        > 1_048_576 - 2048
    {
        return Err(AnalysisError::LimitExceeded(
            "result JSON exceeds envelope allowance".into(),
        ));
    }
    progress(AnalysisProgress {
        processed_samples: mono.len() as u64,
        total_samples: mono.len() as u64,
    });
    Ok(AnalysisOutput { result, features })
}

// Test-only requested-allocation accounting; production keeps its normal allocator.
#[cfg(test)]
mod allocation_meter {
    use std::{
        alloc::{GlobalAlloc, Layout, System},
        sync::atomic::{AtomicUsize, Ordering},
    };
    pub static LIVE: AtomicUsize = AtomicUsize::new(0);
    pub static PEAK: AtomicUsize = AtomicUsize::new(0);
    pub static TOTAL: AtomicUsize = AtomicUsize::new(0);
    pub struct Meter;
    fn add(bytes: usize) {
        let live = LIVE.fetch_add(bytes, Ordering::Relaxed) + bytes;
        PEAK.fetch_max(live, Ordering::Relaxed);
        TOTAL.fetch_add(bytes, Ordering::Relaxed);
    }
    // All allocation and layout guarantees are delegated unchanged to System.
    unsafe impl GlobalAlloc for Meter {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            let p = System.alloc(layout);
            if !p.is_null() {
                add(layout.size());
            }
            p
        }
        unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
            let p = System.alloc_zeroed(layout);
            if !p.is_null() {
                add(layout.size());
            }
            p
        }
        unsafe fn dealloc(&self, p: *mut u8, layout: Layout) {
            System.dealloc(p, layout);
            LIVE.fetch_sub(layout.size(), Ordering::Relaxed);
        }
        unsafe fn realloc(&self, p: *mut u8, layout: Layout, size: usize) -> *mut u8 {
            let next = System.realloc(p, layout, size);
            if !next.is_null() {
                LIVE.fetch_sub(layout.size(), Ordering::Relaxed);
                add(size);
            }
            next
        }
    }
}
#[cfg(test)]
#[global_allocator]
static TEST_ALLOCATOR: allocation_meter::Meter = allocation_meter::Meter;

#[cfg(test)]
pub fn analyze_original(
    mono: &[f32],
    sample_rate_hz: u32,
    options: &AnalysisOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
    progress: &mut dyn FnMut(AnalysisProgress),
) -> Result<AnalysisOutput, AnalysisError> {
    use config::*;
    if sample_rate_hz != SAMPLE_RATE_HZ {
        return Err(AnalysisError::InvalidInput(
            "sample rate must be 24000 Hz".into(),
        ));
    }
    if mono.is_empty() {
        return Err(AnalysisError::InvalidInput("PCM is empty".into()));
    }
    if mono.len() > MAX_SAMPLES {
        return Err(AnalysisError::LimitExceeded(
            "duration exceeds 600 seconds".into(),
        ));
    }
    if !options.concert_a_hz.is_finite() || !(432.0..=446.0).contains(&options.concert_a_hz) {
        return Err(AnalysisError::InvalidInput(
            "concert A must be 432..446 Hz".into(),
        ));
    }
    let mut clipping = false;
    for chunk in mono.chunks(HOP) {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        for &x in chunk {
            if !x.is_finite() {
                return Err(AnalysisError::InvalidInput(
                    "PCM contains non-finite samples".into(),
                ));
            }
            clipping |= x.abs() > 1.0;
        }
    }
    progress(AnalysisProgress {
        processed_samples: 0,
        total_samples: mono.len() as u64,
    });
    let duration = mono.len() as f64 / SAMPLE_RATE_HZ as f64;
    let mut short = spectrum::SpectralAnalyzer::new(WINDOW);
    let mut long = spectrum::SpectralAnalyzer::new(BASS_WINDOW);
    let mut local = spectrum::SpectralAnalyzer::new(1024);
    let mut yin = pitch::Yin::new();
    // Circular peak tuning estimate over at most 30 seconds; no full spectrogram is retained.
    let mut circular = [0.0_f64; 3];
    for center in (WINDOW / 2..mono.len().min(30 * SAMPLE_RATE_HZ as usize))
        .step_by(SAMPLE_RATE_HZ as usize / 4)
    {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let s = short.compute_original(mono, center);
        if s.flatness > 0.25 || s.tonal_fraction < 0.55 {
            continue;
        }
        let maximum = s.peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
        for p in s
            .peaks
            .iter()
            .filter(|p| p.hz > 75.0 && p.hz < 2000.0 && p.amplitude > maximum * 0.2)
        {
            let cents = 1200.0 * (p.hz / options.concert_a_hz).log2();
            let phase = cents * std::f64::consts::TAU / 100.0;
            let w = p.amplitude;
            circular[0] += phase.cos() * w;
            circular[1] += phase.sin() * w;
            circular[2] += w;
        }
    }
    let concentration = circular[0].hypot(circular[1]) / circular[2].max(1e-12);
    let tuning = if concentration > 0.65 && circular[2] > 1e-5 {
        Some(circular[1].atan2(circular[0]) * 100.0 / std::f64::consts::TAU)
    } else {
        None
    };
    let mut frames: Vec<segments::Frame> = Vec::with_capacity(mono.len().div_ceil(HOP));
    let mut bass = None;
    let mut evidence = voice_evidence::VoiceEvidence::new();
    let mut uncertain_hops = [0_u8; (MAX_MIDI - MIN_MIDI + 1) as usize];
    for (i, chunk) in mono.chunks(HOP).enumerate() {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let rms =
            (chunk.iter().map(|&v| (v as f64).powi(2)).sum::<f64>() / chunk.len() as f64).sqrt();
        let silent = rms < SILENCE_RMS;
        if silent {
            evidence.reset();
            uncertain_hops.fill(0);
            frames.push(segments::Frame {
                notes: vec![],
                mono: None,
                bass: None,
                rms,
                silent: true,
                tonal: false,
                dense: false,
                absent: u128::MAX,
            });
            continue;
        }
        let center = i * HOP + chunk.len() / 2;
        let s = short.compute_original(mono, center);
        let measured = if s.peak_energy_fraction > MIN_PEAK_ENERGY_FRACTION {
            local.measure_original(mono, center, &s.peaks, cancelled)?
        } else {
            Vec::new()
        };
        let known = frames.last().map(|f| f.notes.as_slice()).unwrap_or(&[]);
        let temporal =
            evidence.observe_original(&measured, options.concert_a_hz, known, cancelled)?;
        // Local peak prominence follows the current spectrum. A previous noisy
        // attack must not veto independently supported partials in a later decay.
        // Centered FFT evidence must also be audible in this cell; nearby loud
        // notes must not fill a quiet, nonzero room-noise gap.
        let tonal = s.peak_energy_fraction > MIN_PEAK_ENERGY_FRACTION
            && rms >= s.rms * MIN_CELL_WINDOW_RMS_RATIO;
        let mut fit = if tonal {
            polyphony::fit_original(
                &s,
                options.concert_a_hz,
                tuning.unwrap_or(0.0),
                Some(&temporal),
                cancelled,
            )?
        } else {
            polyphony::Fit {
                notes: vec![],
                residual: 1.0,
            }
        };
        if i % 4 == 0 || bass.is_none() {
            let s = long.compute_original(mono, center);
            let low = if tonal {
                polyphony::fit_original(
                    &s,
                    options.concert_a_hz,
                    tuning.unwrap_or(0.0),
                    None,
                    cancelled,
                )?
            } else {
                polyphony::Fit {
                    notes: vec![],
                    residual: 1.0,
                }
            };
            bass = low.notes.first().copied();
        }
        let mut present = [None; (MAX_MIDI - MIN_MIDI + 1) as usize];
        let mut current_support = |note: polyphony::Pitch| {
            let index = (note.midi - MIN_MIDI) as usize;
            *present[index].get_or_insert_with(|| {
                let support = voice_evidence::current_support_original(
                    mono,
                    center,
                    note,
                    options.concert_a_hz,
                    &s,
                );
                let continuing = frames
                    .last()
                    .is_some_and(|f| f.notes.iter().any(|n| n.midi == note.midi));
                match support {
                    voice_evidence::Continuation::Confirmed => {
                        uncertain_hops[index] = 0;
                        support
                    }
                    voice_evidence::Continuation::Uncertain
                        if continuing && uncertain_hops[index] < 2 =>
                    {
                        // A measured current band can bridge at most 40 ms of
                        // phase uncertainty; demonstrated absence never bridges.
                        uncertain_hops[index] += 1;
                        voice_evidence::Continuation::Confirmed
                    }
                    _ => {
                        uncertain_hops[index] = 3;
                        support
                    }
                }
            })
        };
        let mut absent = 0_u128;
        let previous = frames.last().map(|f| f.notes.as_slice()).unwrap_or(&[]);
        for note in fit.notes.iter().chain(previous).chain(bass.iter()) {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            if current_support(*note) == voice_evidence::Continuation::Absent {
                absent |= 1_u128 << (note.midi - MIN_MIDI);
            }
        }
        fit.notes
            .retain(|p| current_support(*p) == voice_evidence::Continuation::Confirmed);
        bass = bass.filter(|p| current_support(*p) == voice_evidence::Continuation::Confirmed);
        let mut single = None;
        if tonal && s.supported {
            if let Some(p) = yin.estimate(mono, center, options.concert_a_hz) {
                // A periodic estimate must explain the observed partials, not just correlate.
                let fundamental = options.concert_a_hz
                    * 2.0_f64.powf((p.midi as f64 - 69.0 + p.cents / 100.0) / 12.0);
                let mut all = 0.0;
                let mut explained = 0.0;
                let mut tightly_explained = 0.0;
                for peak in &s.peaks {
                    let weight = peak.amplitude.powi(2);
                    all += weight;
                    let harmonic = (peak.hz / fundamental).round();
                    if harmonic >= 1.0
                        && (1200.0 * (peak.hz / (fundamental * harmonic)).log2()).abs() < 30.0
                    {
                        explained += weight;
                        if (1200.0 * (peak.hz / (fundamental * harmonic)).log2()).abs() < 8.0 {
                            tightly_explained += weight;
                        }
                    }
                }
                let peak_max = s.peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
                let fundamental_observed = s.peaks.iter().any(|peak| {
                    (1200.0 * (peak.hz / fundamental).log2()).abs() < 35.0
                        && peak.amplitude > peak_max * 0.03
                });
                let independent = fit.notes.len() > 1
                    || fit.notes.iter().any(|n| {
                        let frequency = options.concert_a_hz
                            * 2.0_f64.powf((n.midi as f64 - 69.0 + n.cents / 100.0) / 12.0);
                        let harmonic = (frequency / fundamental).round();
                        harmonic < 1.0
                            || (1200.0 * (frequency / (fundamental * harmonic)).log2()).abs() > 25.0
                    });
                if explained / all.max(1e-15) > 0.96
                    && p.support > 0.86
                    && fundamental_observed
                    && absent & (1_u128 << (p.midi - MIN_MIDI)) == 0
                    && current_support(p) == voice_evidence::Continuation::Confirmed
                    && !fit.notes.iter().any(|n| {
                        temporal.independent(n.midi)
                            && fit
                                .notes
                                .iter()
                                .any(|other| other.midi == temporal.parent(n.midi))
                    })
                    && (!independent || tightly_explained / all.max(1e-15) > 0.98)
                {
                    single = Some(p);
                    fit.notes = vec![p];
                    bass = Some(p);
                }
            }
        }
        frames.push(segments::Frame {
            absent,
            dense: fit.notes.len() >= 6 && fit.residual > 0.25,
            notes: fit.notes,
            mono: single,
            bass: if tonal { bass } else { None },
            rms,
            silent: false,
            tonal,
        });
        progress(AnalysisProgress {
            processed_samples: ((i + 1) * HOP).min(mono.len()) as u64,
            total_samples: mono.len() as u64,
        });
    }
    let dense = frames.iter().filter(|f| f.dense).count() > 10;
    let low_signal = frames.iter().all(|f| f.rms < LOW_SIGNAL_RMS);
    let (harmony, monophonic_notes, polyphonic_notes, features) =
        segments::finish(frames, duration, options, cancelled)?;
    let mut warnings = Vec::new();
    if clipping {
        warnings.push(AnalysisWarning {
            code: WarningCode::Clipping,
            message: "Finite samples outside [-1,1] were clamped for spectral analysis.".into(),
        });
    }
    if low_signal {
        warnings.push(AnalysisWarning {
            code: WarningCode::LowSignal,
            message: "Recording is silent or below the nominal -65 dBFS signal floor.".into(),
        });
    }
    if tuning.is_none() {
        warnings.push(AnalysisWarning {
            code: WarningCode::TuningUncertain,
            message: "Stable peak evidence did not establish a global tuning offset.".into(),
        });
    }
    if dense {
        warnings.push(AnalysisWarning{code:WarningCode::DensePolyphony,message:"Residual tonal energy remained after the six-note fit; some voices may be unresolved.".into()});
    }
    let result = AnalysisResult {
        schema_version: 1,
        engine_version: ENGINE_VERSION.into(),
        options: options.clone(),
        duration,
        sample_rate_hz: SAMPLE_RATE_HZ,
        timing_resolution_seconds: 0.02,
        tuning: Tuning {
            reference_hz: options.concert_a_hz,
            estimated_offset_cents: tuning,
        },
        harmony,
        monophonic_notes,
        polyphonic_notes,
        warnings,
    };
    if cancelled() {
        return Err(AnalysisError::Cancelled);
    }
    if serde_json::to_vec(&result)
        .map_err(|e| AnalysisError::LimitExceeded(e.to_string()))?
        .len()
        > 1_048_576 - 2048
    {
        return Err(AnalysisError::LimitExceeded(
            "result JSON exceeds envelope allowance".into(),
        ));
    }
    progress(AnalysisProgress {
        processed_samples: mono.len() as u64,
        total_samples: mono.len() as u64,
    });
    Ok(AnalysisOutput { result, features })
}
#[cfg(test)]
mod live_cost_tests;
