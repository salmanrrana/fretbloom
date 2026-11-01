//! Rolling measured-partial trajectories. No chord identities or recording state.
use crate::{
    config::{MAX_MIDI, MIN_MIDI},
    spectrum::Spectrum,
    AnalysisError,
};
const CANDIDATES: usize = (MAX_MIDI - MIN_MIDI + 1) as usize;
const HISTORY: usize = 24;
const PARTIALS: usize = 8;
// Shared ownership needs 120 ms of predictive support. Three overlapping
// windows can all contain the same short attack and are not independent votes.
const CONFIRM_HOPS: f64 = 6.0;
// asin of the former 0.10/0.15 sine cutoffs preserves their near-zero angular
// boundaries. Circular distance now distinguishes a half-turn from no change.
const STABLE_PHASE_RADIANS: f64 = 0.1001674211615598;
const CHANGED_PHASE_RADIANS: f64 = 0.15056827277668602;
#[derive(Clone, Copy, Default)]
struct Partial {
    amplitude: f64,
    hz: f64,
    phase: f64,
    prominent: bool,
}
type Observation = [[Partial; PARTIALS]; CANDIDATES];
pub(crate) struct Evidence {
    strength: [f64; CANDIDATES],
    parents: [u8; CANDIDATES],
    shapes: [[f64; PARTIALS]; CANDIDATES],
}
impl Evidence {
    pub fn independent(&self, midi: u8) -> bool {
        self.strength[(midi - MIN_MIDI) as usize] >= CONFIRM_HOPS
    }
    pub fn parent(&self, midi: u8) -> u8 {
        self.parents[(midi - MIN_MIDI) as usize]
    }
    pub fn shape(&self, midi: u8) -> &[f64; PARTIALS] {
        &self.shapes[(midi - MIN_MIDI) as usize]
    }
}
pub(crate) struct VoiceEvidence {
    history: Vec<Observation>,
    cursor: usize,
    len: usize,
    strength: [f64; CANDIDATES],
    parents: [u8; CANDIDATES],
    shapes: [[f64; PARTIALS]; CANDIDATES],
}
impl VoiceEvidence {
    pub fn new() -> Self {
        Self {
            history: vec![[[Partial::default(); PARTIALS]; CANDIDATES]; HISTORY],
            cursor: 0,
            len: 0,
            strength: [0.0; CANDIDATES],
            parents: [0; CANDIDATES],
            shapes: [[0.0; PARTIALS]; CANDIDATES],
        }
    }
    pub fn reset(&mut self) {
        self.len = 0;
        self.strength.fill(0.0);
    }
    pub fn observe(
        &mut self,
        peaks: &[crate::spectrum::Peak],
        reference: f64,
        known: &[crate::polyphony::Pitch],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Evidence, AnalysisError> {
        let fundamental_gate = crate::ratio_gate::RatioGate::new(0.0, 45.0);
        let partial_gate = crate::ratio_gate::RatioGate::new(0.0, 12.0);
        let mut current = [[Partial::default(); PARTIALS]; CANDIDATES];
        for (ci, partials) in current.iter_mut().enumerate() {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            let nominal = reference * 2.0_f64.powf((ci as f64 + MIN_MIDI as f64 - 69.0) / 12.0);
            let fundamental = peaks
                .iter()
                .filter(|p| !fundamental_gate.rejects(p.hz, nominal))
                .filter(|p| (1200.0 * (p.hz / nominal).log2()).abs() < 45.0)
                .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude));
            let Some(fundamental) = fundamental else {
                continue;
            };
            for (h, slot) in partials.iter_mut().enumerate() {
                let expected = fundamental.hz * (h + 1) as f64;
                if let Some(p) = peaks
                    .iter()
                    .filter(|p| !partial_gate.rejects(p.hz, expected))
                    .filter(|p| (1200.0 * (p.hz / expected).log2()).abs() < 12.0)
                    .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude))
                {
                    *slot = Partial {
                        amplitude: p.amplitude,
                        hz: p.hz,
                        phase: p.phase,
                        prominent: p.prominent,
                    };
                }
            }
        }
        // Known pitches and reference are immutable for this observation. Fill only
        // entries reached after the MIDI exclusions, preserving any() short circuits.
        let mut known_hz = vec![None; known.len()];
        for upper in 0..CANDIDATES {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            let mut best = 0.0_f64;
            let mut parent = 0;
            let mut shape = [0.0; PARTIALS];
            if current[upper][0].amplitude > 1e-7 && current[upper][0].prominent {
                for lower in 0..upper {
                    let ratio = current[upper][0].hz / current[lower][0].hz.max(1e-9);
                    let multiple = ratio.round() as usize;
                    if !(2..=6).contains(&multiple)
                        || (1200.0 * (ratio / multiple as f64).log2()).abs() > 18.0
                    {
                        continue;
                    }
                    // Ratios at unshared lower partials predict its common envelope.
                    // Six hops separates measurements by 120 ms, rather than
                    // treating three highly overlapping FFT votes as independent.
                    for lag in [6, 12, 18, 21] {
                        if self.len < lag {
                            continue;
                        }
                        let prior = &self.history[(self.cursor + HISTORY - lag) % HISTORY];
                        let before = (self.len >= lag + 3)
                            .then(|| &self.history[(self.cursor + HISTORY - lag - 3) % HISTORY]);
                        let mut ratios = Vec::with_capacity(PARTIALS);
                        let mut changing_unshared = 0;
                        let mut assigned_elsewhere = 0;
                        let mut damping = Vec::with_capacity(PARTIALS);
                        let carrier_scale =
                            current[lower][0].amplitude / prior[lower][0].amplitude.max(1e-9);
                        for h in 0..PARTIALS {
                            let now = current[lower][h];
                            let old = prior[lower][h];
                            if (h + 1) % multiple != 0
                                && old.amplitude > prior[lower][0].amplitude * 0.08
                                && now.amplitude > current[lower][0].amplitude * 0.08
                            {
                                let shared = known.iter().enumerate().any(|(ki, p)| {
                                    if p.midi == lower as u8 + MIN_MIDI
                                        || p.midi == upper as u8 + MIN_MIDI
                                    {
                                        return false;
                                    }
                                    let hz = *known_hz[ki].get_or_insert_with(|| {
                                        reference
                                            * 2.0_f64.powf(
                                                (p.midi as f64 - 69.0 + p.cents / 100.0) / 12.0,
                                            )
                                    });
                                    let harmonic = (now.hz / hz).round();
                                    (1.0..=8.0).contains(&harmonic)
                                        && (1200.0 * (now.hz / (hz * harmonic)).log2()).abs() < 12.0
                                });
                                if h > 0 && shared {
                                    assigned_elsewhere += 1;
                                    continue;
                                }
                                let phase_error = phase_innovation(
                                    now,
                                    old,
                                    before.map_or(Partial::default(), |b| b[lower][h]),
                                    lag,
                                );
                                if h > 0
                                    && (phase_error.is_some_and(|p| p > STABLE_PHASE_RADIANS)
                                        || ((now.hz - old.hz).abs() > 0.3
                                            && (current[lower][0].hz - prior[lower][0].hz).abs()
                                                < 0.3))
                                {
                                    changing_unshared += 1;
                                }
                                ratios.push(now.amplitude / old.amplitude);
                                if h > 0 && phase_error.is_some_and(|p| p < STABLE_PHASE_RADIANS) {
                                    damping.push(
                                        ((now.amplitude / old.amplitude) / carrier_scale.max(1e-9))
                                            .ln()
                                            / (((h + 1) * (h + 1) - 1) as f64),
                                    );
                                }
                            }
                        }
                        if ratios.is_empty() || (ratios.len() < 2 && assigned_elsewhere == 0) {
                            continue;
                        }
                        ratios.sort_by(f64::total_cmp);
                        let mut scale = ratios[ratios.len() / 2];
                        if !(0.25..=2.5).contains(&scale) {
                            continue;
                        }
                        let mut spread =
                            ratios.iter().map(|r| (r / scale - 1.0).abs()).sum::<f64>()
                                / ratios.len() as f64;
                        if spread > 0.10 {
                            // A new third source can contaminate the only other
                            // unshared partial of a sparse lower comb. Use its
                            // stable measured fundamental as carrier only when
                            // that contamination also has independent phase change.
                            if ratios.len() != 2
                                || changing_unshared != 1
                                || prior[lower][0].amplitude < 1e-7
                            {
                                continue;
                            }
                            scale = current[lower][0].amplitude / prior[lower][0].amplitude;
                            if !(0.25..=2.5).contains(&scale) {
                                continue;
                            }
                            spread = 0.0;
                        }
                        damping.sort_by(f64::total_cmp);
                        // One smooth loss term prevents a naturally darkening
                        // string from looking like independently decaying octaves.
                        let loss = if damping.is_empty()
                            || (current[lower][0].hz - prior[lower][0].hz).abs() > 0.3
                        {
                            0.0
                        } else {
                            damping[damping.len() / 2].clamp(-0.1, 0.1)
                        };
                        let mut changes = [0.0; PARTIALS];
                        let mut matched = 0;
                        let mut phase_votes = 0;
                        for (h, change) in changes.iter_mut().enumerate() {
                            let now = current[upper][h];
                            let old = prior[upper][h];
                            if !now.prominent || now.amplitude < current[upper][0].amplitude * 0.08
                            {
                                continue;
                            }
                            let low_harmonic = multiple * (h + 1);
                            let predicted = old.amplitude
                                * scale
                                * (loss * ((low_harmonic * low_harmonic) as f64 - 1.0))
                                    .clamp(-6.0, 3.0)
                                    .exp();
                            *change = (now.amplitude - predicted).abs()
                                / now.amplitude.max(predicted).max(1e-9);
                            // Beyond the lower track's eight measured partials,
                            // high-order aliases need phase corroboration too.
                            // Extrapolated damping alone cannot establish a new
                            // source at the fourth/sixth harmonic of a bright note.
                            if multiple >= 4 && h > 0 && old.amplitude > now.amplitude * 0.1 {
                                let independent_phase = phase_innovation(
                                    now,
                                    old,
                                    before.map_or(Partial::default(), |b| b[upper][h]),
                                    lag,
                                )
                                .is_some_and(|p| p > STABLE_PHASE_RADIANS);
                                if !independent_phase
                                    || (current[lower][0].hz - prior[lower][0].hz).abs() > 0.3
                                {
                                    *change = 0.0;
                                }
                            }
                            if *change > 0.10 + spread * 2.0 {
                                matched += 1;
                            }
                            // Phase is corroboration only, with stable measured
                            // frequency and sufficient amplitude at both ends.
                            if phase_innovation(
                                now,
                                old,
                                before.map_or(Partial::default(), |b| b[upper][h]),
                                lag,
                            )
                            .is_some_and(|p| p > CHANGED_PHASE_RADIANS)
                            {
                                phase_votes += 1;
                            }
                        }
                        // Fundamental plus two partials must change independently;
                        // a lone beating bin never establishes a second voice.
                        if changes[0] > 0.10 + spread * 2.0 && matched >= 3 {
                            let score = changes.iter().sum::<f64>() + phase_votes as f64 * 0.015;
                            if score > best {
                                best = score;
                                parent = lower as u8 + MIN_MIDI;
                                shape = changes;
                            }
                        }
                    }
                }
            }
            if best > 0.0 {
                let dot = shape
                    .iter()
                    .zip(self.shapes[upper])
                    .map(|(a, b)| a * b)
                    .sum::<f64>();
                let norm = (shape.iter().map(|a| a * a).sum::<f64>()
                    * self.shapes[upper].iter().map(|a| a * a).sum::<f64>())
                .sqrt();
                // Repeated windows must predict a consistent residual shape;
                // unrelated changes cannot accumulate a voice one bin at a time.
                self.strength[upper] =
                    if self.parents[upper] != parent || (norm > 0.0 && dot / norm < 0.75) {
                        1.0
                    } else {
                        (self.strength[upper] + 1.0).min(8.0)
                    };
                self.shapes[upper] = shape;
                self.parents[upper] = parent;
            } else {
                self.strength[upper] = (self.strength[upper] - 1.0).max(0.0);
            }
        }
        self.history[self.cursor] = current;
        self.cursor = (self.cursor + 1) % HISTORY;
        self.len = (self.len + 1).min(HISTORY);
        Ok(Evidence {
            strength: self.strength,
            parents: self.parents,
            shapes: self.shapes,
        })
    }
}

// Predict phase advance from a PRECEDING 60 ms baseline. Using only an
// interpolated FFT frequency leaves a systematic phase error; fitting advance
// with the current endpoint would instead absorb the change being tested.
// Return the shortest circular distance in radians, in [0, pi].
fn phase_innovation(now: Partial, old: Partial, before: Partial, lag: usize) -> Option<f64> {
    if old.amplitude < now.amplitude * 0.1
        || before.amplitude < old.amplitude * 0.1
        || (now.hz - old.hz).abs() > 0.3
        || (old.hz - before.hz).abs() > 0.3
    {
        return None;
    }
    let advance = std::f64::consts::TAU * old.hz * 0.06;
    let error = old.phase - before.phase - advance;
    let wrapped = error.sin().atan2(error.cos());
    let per_hop = (advance + wrapped) / 3.0;
    let residual = now.phase - old.phase - per_hop * lag as f64;
    Some(residual.sin().atan2(residual.cos()).abs())
}

/// Candidate-specific continuation from disjoint, windowed projections. The
/// longer baseline resolves low fundamentals; the central cell only checks
/// presence, never estimates a low pitch from a 20 ms FFT.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Continuation {
    Confirmed,
    Uncertain,
    Absent,
}

pub(crate) fn current_support(
    samples: &[f32],
    center: usize,
    pitch: crate::polyphony::Pitch,
    reference: f64,
    spectrum: &Spectrum,
) -> Continuation {
    let hz = reference * 2.0_f64.powf((pitch.midi as f64 - 69.0 + pitch.cents / 100.0) / 12.0);
    let fundamental_gate = crate::ratio_gate::RatioGate::new(0.0, 35.0);
    let partial_gate = crate::ratio_gate::RatioGate::new(0.0, 18.0);
    let fundamental = spectrum
        .peaks
        .iter()
        .filter(|p| !fundamental_gate.rejects(p.hz, hz))
        .filter(|p| (1200.0 * (p.hz / hz).log2()).abs() < 35.0)
        .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude));
    let Some(fundamental) = fundamental else {
        return Continuation::Absent;
    };
    let hz = fundamental.hz;
    // 2 periods per half, 40..120 ms total. Disjoint halves are not
    // independent votes: their phase and amplitude must predict each other.
    let half = (48000.0 / hz).round().clamp(480.0, 1440.0) as usize;
    let mut good = 0;
    let mut fundamental_good = false;
    let mut fundamental_present = false;
    let mut measured = 0;
    for h in 1..=4 {
        let target = hz * h as f64;
        let Some(peak) = spectrum.peaks.iter().find(|p| {
            !partial_gate.rejects(p.hz, target) && (1200.0 * (p.hz / target).log2()).abs() < 18.0
        }) else {
            continue;
        };
        if peak.amplitude < fundamental.amplitude * 0.08 {
            continue;
        }
        measured += 1;
        let left = isolated_projection(
            samples,
            center as isize - half as isize,
            half,
            peak,
            center,
            spectrum,
        );
        let right = isolated_projection(samples, center as isize, half, peak, center, spectrum);
        let central =
            isolated_projection(samples, center as isize - 240, 480, peak, center, spectrum);
        let a = left.0.hypot(left.1);
        let b = right.0.hypot(right.1);
        let advance = std::f64::consts::TAU * peak.hz * half as f64 / 24000.0;
        let coherence = ((left.0 * right.0 + left.1 * right.1) * advance.cos()
            + (left.0 * right.1 - left.1 * right.0) * advance.sin())
            / (a * b).max(1e-18);
        let supported = coherence > 0.55
            && a.min(b) > a.max(b) * 0.12
            && a.min(b) > peak.amplitude * 0.12
            && central.0.hypot(central.1) > peak.amplitude * 0.18;
        if h == 1 {
            fundamental_present = central.0.hypot(central.1) > peak.amplitude * 0.18
                && a.max(b) > peak.amplitude * 0.12;
            if !fundamental_present {
                return Continuation::Absent;
            }
        }
        if supported {
            good += 1;
            if h == 1 {
                fundamental_good = true;
            }
        }
        if fundamental_good && good >= 2 {
            return Continuation::Confirmed;
        }
    }
    if (fundamental_good && (good >= 2 || measured < 3)) || (fundamental_present && good >= 2) {
        Continuation::Confirmed
    } else {
        Continuation::Uncertain
    }
}

// Recurrence avoids a sin/cos per sample. Hann projections use their local
// origin, hence the explicit phase advance when comparing adjacent halves.
fn projection(samples: &[f32], start: isize, len: usize, hz: f64) -> (f64, f64) {
    let angle = std::f64::consts::TAU * hz / 24000.0;
    let (sin, cos) = angle.sin_cos();
    let (mut re, mut im) = (1.0, 0.0);
    let (ws, wc) = (std::f64::consts::TAU / len as f64).sin_cos();
    let (mut wr, mut wi) = (1.0, 0.0);
    let (mut real, mut imag) = (0.0, 0.0);
    for i in 0..len {
        let at = start + i as isize;
        let x = if at >= 0 {
            samples
                .get(at as usize)
                .copied()
                .unwrap_or(0.0)
                .clamp(-1.0, 1.0) as f64
        } else {
            0.0
        };
        let w = 0.5 - 0.5 * wr;
        real += x * w * re;
        imag -= x * w * im;
        (re, im) = (re * cos - im * sin, im * cos + re * sin);
        (wr, wi) = (wr * wc - wi * ws, wi * wc + wr * ws);
    }
    (real * 4.0 / len as f64, imag * 4.0 / len as f64)
}

// Remove predictable leakage from OTHER measured peaks. Otherwise a resolved
// semitone pair beats inside a short projection and looks like two releases.
fn isolated_projection(
    samples: &[f32],
    start: isize,
    len: usize,
    target: &crate::spectrum::Peak,
    center: usize,
    spectrum: &Spectrum,
) -> (f64, f64) {
    let (mut real, mut imag) = projection(samples, start, len, target.hz);
    for other in &spectrum.peaks {
        let delta = (other.hz - target.hz) * len as f64 / 24000.0;
        if delta.abs() < 0.01 || delta.abs() > 4.0 {
            continue;
        }
        let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
        let phase = other.phase
            + std::f64::consts::TAU
                * (other.hz * (start as f64 + len as f64 * 0.5 - center as f64)
                    - target.hz * len as f64 * 0.5)
                / 24000.0;
        real -= other.amplitude * response * phase.cos();
        imag -= other.amplitude * response * phase.sin();
    }
    (real, imag)
}
fn sinc(x: f64) -> f64 {
    if x.abs() < 1e-9 {
        1.0
    } else {
        (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
    }
}

#[cfg(test)]
impl VoiceEvidence {
    #[cfg(test)]
    pub(crate) fn observe_original(
        &mut self,
        peaks: &[crate::spectrum::Peak],
        reference: f64,
        known: &[crate::polyphony::Pitch],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Evidence, AnalysisError> {
        let mut current = [[Partial::default(); PARTIALS]; CANDIDATES];
        for (ci, partials) in current.iter_mut().enumerate() {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            let nominal = reference * 2.0_f64.powf((ci as f64 + MIN_MIDI as f64 - 69.0) / 12.0);
            let fundamental = peaks
                .iter()
                .filter(|p| (1200.0 * (p.hz / nominal).log2()).abs() < 45.0)
                .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude));
            let Some(fundamental) = fundamental else {
                continue;
            };
            for (h, slot) in partials.iter_mut().enumerate() {
                let expected = fundamental.hz * (h + 1) as f64;
                if let Some(p) = peaks
                    .iter()
                    .filter(|p| (1200.0 * (p.hz / expected).log2()).abs() < 12.0)
                    .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude))
                {
                    *slot = Partial {
                        amplitude: p.amplitude,
                        hz: p.hz,
                        phase: p.phase,
                        prominent: p.prominent,
                    };
                }
            }
        }
        for upper in 0..CANDIDATES {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            let mut best = 0.0_f64;
            let mut parent = 0;
            let mut shape = [0.0; PARTIALS];
            if current[upper][0].amplitude > 1e-7 && current[upper][0].prominent {
                for lower in 0..upper {
                    let ratio = current[upper][0].hz / current[lower][0].hz.max(1e-9);
                    let multiple = ratio.round() as usize;
                    if !(2..=6).contains(&multiple)
                        || (1200.0 * (ratio / multiple as f64).log2()).abs() > 18.0
                    {
                        continue;
                    }
                    // Ratios at unshared lower partials predict its common envelope.
                    // Six hops separates measurements by 120 ms, rather than
                    // treating three highly overlapping FFT votes as independent.
                    for lag in [6, 12, 18, 21] {
                        if self.len < lag {
                            continue;
                        }
                        let prior = &self.history[(self.cursor + HISTORY - lag) % HISTORY];
                        let before = (self.len >= lag + 3)
                            .then(|| &self.history[(self.cursor + HISTORY - lag - 3) % HISTORY]);
                        let mut ratios = Vec::with_capacity(PARTIALS);
                        let mut changing_unshared = 0;
                        let mut assigned_elsewhere = 0;
                        let mut damping = Vec::with_capacity(PARTIALS);
                        let carrier_scale =
                            current[lower][0].amplitude / prior[lower][0].amplitude.max(1e-9);
                        for h in 0..PARTIALS {
                            let now = current[lower][h];
                            let old = prior[lower][h];
                            if (h + 1) % multiple != 0
                                && old.amplitude > prior[lower][0].amplitude * 0.08
                                && now.amplitude > current[lower][0].amplitude * 0.08
                            {
                                let shared = known.iter().any(|p| {
                                    if p.midi == lower as u8 + MIN_MIDI
                                        || p.midi == upper as u8 + MIN_MIDI
                                    {
                                        return false;
                                    }
                                    let hz = reference
                                        * 2.0_f64
                                            .powf((p.midi as f64 - 69.0 + p.cents / 100.0) / 12.0);
                                    let harmonic = (now.hz / hz).round();
                                    (1.0..=8.0).contains(&harmonic)
                                        && (1200.0 * (now.hz / (hz * harmonic)).log2()).abs() < 12.0
                                });
                                if h > 0 && shared {
                                    assigned_elsewhere += 1;
                                    continue;
                                }
                                let phase_error = phase_innovation(
                                    now,
                                    old,
                                    before.map_or(Partial::default(), |b| b[lower][h]),
                                    lag,
                                );
                                if h > 0
                                    && (phase_error.is_some_and(|p| p > STABLE_PHASE_RADIANS)
                                        || ((now.hz - old.hz).abs() > 0.3
                                            && (current[lower][0].hz - prior[lower][0].hz).abs()
                                                < 0.3))
                                {
                                    changing_unshared += 1;
                                }
                                ratios.push(now.amplitude / old.amplitude);
                                if h > 0 && phase_error.is_some_and(|p| p < STABLE_PHASE_RADIANS) {
                                    damping.push(
                                        ((now.amplitude / old.amplitude) / carrier_scale.max(1e-9))
                                            .ln()
                                            / (((h + 1) * (h + 1) - 1) as f64),
                                    );
                                }
                            }
                        }
                        if ratios.is_empty() || (ratios.len() < 2 && assigned_elsewhere == 0) {
                            continue;
                        }
                        ratios.sort_by(f64::total_cmp);
                        let mut scale = ratios[ratios.len() / 2];
                        if !(0.25..=2.5).contains(&scale) {
                            continue;
                        }
                        let mut spread =
                            ratios.iter().map(|r| (r / scale - 1.0).abs()).sum::<f64>()
                                / ratios.len() as f64;
                        if spread > 0.10 {
                            // A new third source can contaminate the only other
                            // unshared partial of a sparse lower comb. Use its
                            // stable measured fundamental as carrier only when
                            // that contamination also has independent phase change.
                            if ratios.len() != 2
                                || changing_unshared != 1
                                || prior[lower][0].amplitude < 1e-7
                            {
                                continue;
                            }
                            scale = current[lower][0].amplitude / prior[lower][0].amplitude;
                            if !(0.25..=2.5).contains(&scale) {
                                continue;
                            }
                            spread = 0.0;
                        }
                        damping.sort_by(f64::total_cmp);
                        // One smooth loss term prevents a naturally darkening
                        // string from looking like independently decaying octaves.
                        let loss = if damping.is_empty()
                            || (current[lower][0].hz - prior[lower][0].hz).abs() > 0.3
                        {
                            0.0
                        } else {
                            damping[damping.len() / 2].clamp(-0.1, 0.1)
                        };
                        let mut changes = [0.0; PARTIALS];
                        let mut matched = 0;
                        let mut phase_votes = 0;
                        for (h, change) in changes.iter_mut().enumerate() {
                            let now = current[upper][h];
                            let old = prior[upper][h];
                            if !now.prominent || now.amplitude < current[upper][0].amplitude * 0.08
                            {
                                continue;
                            }
                            let low_harmonic = multiple * (h + 1);
                            let predicted = old.amplitude
                                * scale
                                * (loss * ((low_harmonic * low_harmonic) as f64 - 1.0))
                                    .clamp(-6.0, 3.0)
                                    .exp();
                            *change = (now.amplitude - predicted).abs()
                                / now.amplitude.max(predicted).max(1e-9);
                            // Beyond the lower track's eight measured partials,
                            // high-order aliases need phase corroboration too.
                            // Extrapolated damping alone cannot establish a new
                            // source at the fourth/sixth harmonic of a bright note.
                            if multiple >= 4 && h > 0 && old.amplitude > now.amplitude * 0.1 {
                                let independent_phase = phase_innovation(
                                    now,
                                    old,
                                    before.map_or(Partial::default(), |b| b[upper][h]),
                                    lag,
                                )
                                .is_some_and(|p| p > STABLE_PHASE_RADIANS);
                                if !independent_phase
                                    || (current[lower][0].hz - prior[lower][0].hz).abs() > 0.3
                                {
                                    *change = 0.0;
                                }
                            }
                            if *change > 0.10 + spread * 2.0 {
                                matched += 1;
                            }
                            // Phase is corroboration only, with stable measured
                            // frequency and sufficient amplitude at both ends.
                            if phase_innovation(
                                now,
                                old,
                                before.map_or(Partial::default(), |b| b[upper][h]),
                                lag,
                            )
                            .is_some_and(|p| p > CHANGED_PHASE_RADIANS)
                            {
                                phase_votes += 1;
                            }
                        }
                        // Fundamental plus two partials must change independently;
                        // a lone beating bin never establishes a second voice.
                        if changes[0] > 0.10 + spread * 2.0 && matched >= 3 {
                            let score = changes.iter().sum::<f64>() + phase_votes as f64 * 0.015;
                            if score > best {
                                best = score;
                                parent = lower as u8 + MIN_MIDI;
                                shape = changes;
                            }
                        }
                    }
                }
            }
            if best > 0.0 {
                let dot = shape
                    .iter()
                    .zip(self.shapes[upper])
                    .map(|(a, b)| a * b)
                    .sum::<f64>();
                let norm = (shape.iter().map(|a| a * a).sum::<f64>()
                    * self.shapes[upper].iter().map(|a| a * a).sum::<f64>())
                .sqrt();
                // Repeated windows must predict a consistent residual shape;
                // unrelated changes cannot accumulate a voice one bin at a time.
                self.strength[upper] =
                    if self.parents[upper] != parent || (norm > 0.0 && dot / norm < 0.75) {
                        1.0
                    } else {
                        (self.strength[upper] + 1.0).min(8.0)
                    };
                self.shapes[upper] = shape;
                self.parents[upper] = parent;
            } else {
                self.strength[upper] = (self.strength[upper] - 1.0).max(0.0);
            }
        }
        self.history[self.cursor] = current;
        self.cursor = (self.cursor + 1) % HISTORY;
        self.len = (self.len + 1).min(HISTORY);
        Ok(Evidence {
            strength: self.strength,
            parents: self.parents,
            shapes: self.shapes,
        })
    }
}

#[cfg(test)]
pub(crate) fn current_support_original(
    samples: &[f32],
    center: usize,
    pitch: crate::polyphony::Pitch,
    reference: f64,
    spectrum: &Spectrum,
) -> Continuation {
    let hz = reference * 2.0_f64.powf((pitch.midi as f64 - 69.0 + pitch.cents / 100.0) / 12.0);
    let fundamental = spectrum
        .peaks
        .iter()
        .filter(|p| (1200.0 * (p.hz / hz).log2()).abs() < 35.0)
        .max_by(|a, b| a.amplitude.total_cmp(&b.amplitude));
    let Some(fundamental) = fundamental else {
        return Continuation::Absent;
    };
    let hz = fundamental.hz;
    // 2 periods per half, 40..120 ms total. Disjoint halves are not
    // independent votes: their phase and amplitude must predict each other.
    let half = (48000.0 / hz).round().clamp(480.0, 1440.0) as usize;
    let mut good = 0;
    let mut fundamental_good = false;
    let mut fundamental_present = false;
    let mut measured = 0;
    for h in 1..=4 {
        let target = hz * h as f64;
        let Some(peak) = spectrum
            .peaks
            .iter()
            .find(|p| (1200.0 * (p.hz / target).log2()).abs() < 18.0)
        else {
            continue;
        };
        if peak.amplitude < fundamental.amplitude * 0.08 {
            continue;
        }
        measured += 1;
        let left = isolated_projection(
            samples,
            center as isize - half as isize,
            half,
            peak,
            center,
            spectrum,
        );
        let right = isolated_projection(samples, center as isize, half, peak, center, spectrum);
        let central =
            isolated_projection(samples, center as isize - 240, 480, peak, center, spectrum);
        let a = left.0.hypot(left.1);
        let b = right.0.hypot(right.1);
        let advance = std::f64::consts::TAU * peak.hz * half as f64 / 24000.0;
        let coherence = ((left.0 * right.0 + left.1 * right.1) * advance.cos()
            + (left.0 * right.1 - left.1 * right.0) * advance.sin())
            / (a * b).max(1e-18);
        let supported = coherence > 0.55
            && a.min(b) > a.max(b) * 0.12
            && a.min(b) > peak.amplitude * 0.12
            && central.0.hypot(central.1) > peak.amplitude * 0.18;
        if h == 1 {
            fundamental_present = central.0.hypot(central.1) > peak.amplitude * 0.18
                && a.max(b) > peak.amplitude * 0.12;
            if !fundamental_present {
                return Continuation::Absent;
            }
        }
        if supported {
            good += 1;
            if h == 1 {
                fundamental_good = true;
            }
        }
        if fundamental_good && good >= 2 {
            return Continuation::Confirmed;
        }
    }
    if (fundamental_good && (good >= 2 || measured < 3)) || (fundamental_present && good >= 2) {
        Continuation::Confirmed
    } else {
        Continuation::Uncertain
    }
}

#[cfg(test)]
impl Evidence {
    pub(crate) fn bit_snapshot(&self) -> Vec<u64> {
        self.strength
            .iter()
            .map(|v| v.to_bits())
            .chain(self.parents.iter().map(|&v| v as u64))
            .chain(self.shapes.iter().flatten().map(|v| v.to_bits()))
            .collect()
    }
}
#[cfg(test)]
impl VoiceEvidence {
    pub(crate) fn bit_snapshot(&self) -> Vec<u64> {
        self.history
            .iter()
            .flatten()
            .flatten()
            .flat_map(|p| {
                [
                    p.amplitude.to_bits(),
                    p.hz.to_bits(),
                    p.phase.to_bits(),
                    p.prominent as u64,
                ]
            })
            .chain(self.strength.iter().map(|v| v.to_bits()))
            .chain(self.parents.iter().map(|&v| v as u64))
            .chain(self.shapes.iter().flatten().map(|v| v.to_bits()))
            .chain([self.cursor as u64, self.len as u64])
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_frequency_cache_is_observation_local_and_indexed() {
        use crate::{polyphony::Pitch, spectrum::Peak};
        let mut cached = VoiceEvidence::new();
        let mut original = VoiceEvidence::new();
        for frame in 0..48 {
            let reference = if frame % 2 == 0 { 440.0 } else { 442.0 };
            let lower_hz = reference / 4.0;
            let peaks: Vec<_> = (1..=16)
                .map(|h| Peak {
                    hz: lower_hz * h as f64,
                    amplitude: (1.0 + ((frame + h) % 7) as f64 * 0.03) / h as f64,
                    phase: frame as f64 * 0.3 * h as f64,
                    prominent: true,
                })
                .collect();
            // Duplicate MIDI with distinct cents catches caches keyed only by MIDI.
            // Same positions change across calls; exceptional values remain legal seam inputs.
            let cents = [0.0, 31.0, -31.0, f64::NAN, f64::INFINITY, -0.0];
            let known: Vec<_> = (0..frame % 9)
                .map(|i| Pitch {
                    midi: if i % 2 == 0 { 64 } else { 69 },
                    cents: cents[(frame + i) % cents.len()],
                    support: 1.0,
                })
                .collect();
            let a = cached
                .observe(&peaks, reference, &known, &|| false)
                .unwrap();
            let b = original
                .observe_original(&peaks, reference, &known, &|| false)
                .unwrap();
            assert_eq!(a.bit_snapshot(), b.bit_snapshot(), "frame {frame}");
            assert_eq!(
                cached.bit_snapshot(),
                original.bit_snapshot(),
                "frame {frame}"
            );
        }
        eprintln!("CACHE_LAYOUT option_f64={} vec_header={} production_max_entries=6 requested_payload_max={}",
            std::mem::size_of::<Option<f64>>(), std::mem::size_of::<Vec<Option<f64>>>(),
            6 * std::mem::size_of::<Option<f64>>());
    }

    #[test]
    fn phase_prediction_removes_bin_bias_without_fitting_the_new_endpoint() {
        let at = |time| Partial {
            amplitude: 0.1,
            hz: 440.1,
            phase: std::f64::consts::TAU * 440.0 * time,
            prominent: true,
        };
        let before = at(0.0);
        let old = at(0.06);
        let now = at(0.42);
        assert!(phase_innovation(now, old, before, 18).unwrap() < 1e-9);
        // Circular phase is equal only modulo a full turn, never a half turn.
        for (shift, expected) in [
            (0.0, 0.0),
            (1e-5, 1e-5),
            (-1e-5, 1e-5),
            (std::f64::consts::PI, std::f64::consts::PI),
            (-std::f64::consts::PI, std::f64::consts::PI),
            (std::f64::consts::TAU, 0.0),
            (-std::f64::consts::TAU, 0.0),
            (std::f64::consts::TAU + 0.1, 0.1),
            (-std::f64::consts::TAU - 0.1, 0.1),
        ] {
            let actual = phase_innovation(
                Partial {
                    phase: now.phase + shift,
                    ..now
                },
                old,
                before,
                18,
            )
            .unwrap();
            assert!((actual - expected).abs() < 1e-9, "shift={shift}: {actual}");
        }
        assert!(
            phase_innovation(
                Partial {
                    phase: now.phase + 0.5,
                    ..now
                },
                old,
                before,
                18
            )
            .unwrap()
                > 0.4
        );
        assert!(phase_innovation(Partial { hz: 442.0, ..now }, old, before, 18).is_none());
        assert!(phase_innovation(
            now,
            Partial {
                amplitude: 0.0,
                ..old
            },
            before,
            18
        )
        .is_none());
        assert!(phase_innovation(
            now,
            old,
            Partial {
                amplitude: 0.0,
                ..before
            },
            18
        )
        .is_none());
    }

    #[test]
    fn bounded_history_allocation() {
        let state = VoiceEvidence::new();
        let history_bytes = state.history.capacity() * std::mem::size_of::<Observation>();
        assert_eq!(state.history.len(), 24);
        assert!(
            history_bytes
                + std::mem::size_of::<VoiceEvidence>()
                + std::mem::size_of::<Evidence>()
                + std::mem::size_of::<Observation>()
                < 512 * 1024
        );
        eprintln!(
            "history_heap_bytes={history_bytes} state_bytes={} evidence_bytes={} frame_bytes={}",
            std::mem::size_of::<VoiceEvidence>(),
            std::mem::size_of::<Evidence>(),
            std::mem::size_of::<crate::segments::Frame>()
        );
    }

    /// Run alone: meter the new rolling state, short FFT plan and maximum-size
    /// measured-peak scratch; account separately for the added frame layout.
    #[test]
    #[ignore]
    fn added_working_allocation_budget() {
        use crate::allocation_meter::{LIVE, PEAK, TOTAL};
        use std::sync::atomic::Ordering::Relaxed;
        let pcm: Vec<_> = (0..24000)
            .map(|i| (0.1 * (std::f64::consts::TAU * 220.0 * i as f64 / 24000.0).sin()) as f32)
            .collect();
        let anchors: Vec<_> = (0..552)
            .map(|i| crate::spectrum::Peak {
                hz: 35.0 + i as f64 * 11.7,
                amplitude: 0.01,
                phase: 0.0,
                prominent: true,
            })
            .collect();
        let base = LIVE.load(Relaxed);
        let total = TOTAL.load(Relaxed);
        PEAK.store(base, Relaxed);
        let mut state = VoiceEvidence::new();
        let mut fft = crate::spectrum::SpectralAnalyzer::new(1024);
        for _ in 0..24 {
            let measured = fft.measure(&pcm, 12000, &anchors, &|| false).unwrap();
            std::hint::black_box(state.observe(&measured, 440.0, &[], &|| false).unwrap());
        }
        let peak = PEAK.load(Relaxed).saturating_sub(base);
        let cumulative = TOTAL.load(Relaxed) - total;
        // The pinned before/after Frame layouts are 104/128 bytes. Both the
        // original frames and smoothing clone can coexist at 30,000 hops.
        let frame_delta = 24 * 30_000 * 2;
        let phase_delta = 8 * 552 * 2;
        let stack_allowance = 48 * 1024;
        let added_peak = peak + frame_delta + phase_delta + stack_allowance;
        println!("new_history_fft_scratch_peak_bytes={peak} cumulative_requested_bytes={cumulative} added_frame_bytes={frame_delta} added_peak_phase_bytes={phase_delta} stack_allowance={stack_allowance} added_working_bound_bytes={added_peak}");
        assert!(added_peak <= 2 * 1024 * 1024, "{added_peak}");
    }

    /// Developer diagnostics on explicitly supplied PCM; never used by analyze.
    #[test]
    #[ignore]
    fn measured_track_diagnostic() {
        let path = std::env::var("FRETBLOOM_DSP_DIAGNOSTIC_PCM").expect("explicit DEV PCM path");
        let times: Vec<f64> = std::env::var("FRETBLOOM_DSP_DIAGNOSTIC_TIMES")
            .unwrap()
            .split(',')
            .map(|s| s.parse().unwrap())
            .collect();
        let data = std::fs::read(path).unwrap();
        let pcm: Vec<_> = data
            .chunks_exact(4)
            .map(|v| f32::from_le_bytes(v.try_into().unwrap()))
            .collect();
        let mut fft = crate::spectrum::SpectralAnalyzer::new(crate::config::WINDOW);
        let mut state = VoiceEvidence::new();
        let mut local = crate::spectrum::SpectralAnalyzer::new(1024);
        let mut known = Vec::new();
        for (i, chunk) in pcm.chunks(480).enumerate() {
            let rms = (chunk.iter().map(|x| (*x as f64).powi(2)).sum::<f64>() / chunk.len() as f64)
                .sqrt();
            if rms < crate::config::SILENCE_RMS {
                state.reset();
                known.clear();
                continue;
            }
            let center = i * 480 + chunk.len() / 2;
            let spectrum = fft.compute(&pcm, center);
            let measured = local
                .measure(&pcm, center, &spectrum.peaks, &|| false)
                .unwrap();
            let e = state.observe(&measured, 440.0, &known, &|| false).unwrap();
            let time = center as f64 / 24000.0;
            let fit = crate::polyphony::fit(&spectrum, 440.0, 0.0, Some(&e), &|| false).unwrap();
            known = fit.notes.clone();
            if !times.iter().any(|t| (time - t).abs() < 0.009) {
                continue;
            }
            let values = |partials: &[Partial; PARTIALS]| {
                partials.iter().map(|p| serde_json::json!({"hz":p.hz,"amplitude":p.amplitude,"prominent":p.prominent,"phase":p.phase})).collect::<Vec<_>>()
            };
            let tracks:Vec<_>=(0..CANDIDATES).filter(|&c| state.history[(state.cursor+HISTORY-1)%HISTORY][c][0].amplitude>0.0).map(|c|{
                let obs=&state.history[(state.cursor+HISTORY-1)%HISTORY][c];
                let history:Vec<_>=[6,12,18].iter().map(|&lag| serde_json::json!({"lag":lag,"partials":values(&state.history[(state.cursor+HISTORY-1-lag)%HISTORY][c])})).collect();
                serde_json::json!({"midi":c+MIN_MIDI as usize,"strength":e.strength[c],"parent":e.parents[c],"shape":e.shapes[c],"partials":values(obs),"history":history})
            }).collect();
            let fitted:Vec<_>=fit.notes.iter().map(|p|serde_json::json!({"midi":p.midi,"support":p.support,"current":current_support(&pcm,center,*p,440.0,&spectrum)==Continuation::Confirmed})).collect();
            println!(
                "{}",
                serde_json::json!({"time":time,"tracks":tracks,"fit":fitted})
            );
        }
    }
}
