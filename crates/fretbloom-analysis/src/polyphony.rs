//! Sparse nonnegative fitting of measured spectral peaks. Chord templates never enter this module.
use crate::{
    config::{
        MAX_HARMONICS, MAX_MIDI, MIN_FIT_IMPROVEMENT, MIN_MIDI, MIN_PEAK_ENERGY_FRACTION,
        MIN_VOICE_SUPPORT,
    },
    spectrum::Spectrum,
    AnalysisError,
};
#[derive(Debug, Clone, Copy)]
pub(crate) struct Pitch {
    pub midi: u8,
    pub cents: f64,
    pub support: f64,
}
pub(crate) struct Fit {
    pub notes: Vec<Pitch>,
    pub residual: f64,
}
struct Comb {
    midi: u8,
    cents: f64,
    weights: Vec<f64>,
    fundamental: Option<usize>,
    observed_norm: f64,
}
pub(crate) fn fit(
    spectrum: &Spectrum,
    reference: f64,
    tuning: f64,
    temporal: Option<&crate::voice_evidence::Evidence>,
    cancelled: &(dyn Fn() -> bool + Sync),
) -> Result<Fit, AnalysisError> {
    let peaks = &spectrum.peaks;
    let max = peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
    if max < 1e-7 || !spectrum.supported || spectrum.peak_energy_fraction < MIN_PEAK_ENERGY_FRACTION
    {
        return Ok(Fit {
            notes: vec![],
            residual: 1.0,
        });
    }
    let observed: Vec<f64> = peaks
        .iter()
        .map(|p| (p.amplitude / max).powf(0.7))
        .collect();
    let mut combs = Vec::new();
    let fundamental_gate = crate::ratio_gate::RatioGate::new(tuning, 45.0);
    for midi in MIN_MIDI..=MAX_MIDI {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let nominal = reference * 2.0_f64.powf((midi as f64 - 69.0) / 12.0);
        let mut best: Option<(f64, Comb)> = None;
        // Each hypothesis starts at a measured fundamental, not at a chord tone
        // or a subharmonic of a higher peak. Its frequency anchors which partials
        // it can own; averaging shared upper peaks must not move that anchor.
        for (fundamental, peak) in peaks.iter().enumerate() {
            if fundamental_gate.rejects(peak.hz, nominal) {
                continue;
            }
            let cents = 1200.0 * (peak.hz / nominal).log2();
            if (cents - tuning).abs() > 45.0 {
                continue;
            }
            let partial_gate = crate::ratio_gate::RatioGate::new(cents, 12.0);
            let upper_partial_gate = crate::ratio_gate::RatioGate::new(cents, 18.0);
            let mut weights = vec![0.0; peaks.len()];
            let mut weighted_cents = 0.0;
            let mut weight_sum = 0.0;
            for (i, p) in peaks.iter().enumerate() {
                let harmonic = (p.hz / peak.hz).round() as usize;
                if !(1..=MAX_HARMONICS).contains(&harmonic) {
                    continue;
                }
                let gate = if harmonic <= 8 {
                    partial_gate
                } else {
                    upper_partial_gate
                };
                if gate.rejects(p.hz, nominal * harmonic as f64) {
                    continue;
                }
                let partial_cents = 1200.0 * (p.hz / (nominal * harmonic as f64)).log2();
                // High string partials may drift, but a candidate cannot freely
                // consume every peak within a semitone of an integer multiple.
                let tolerance = if harmonic <= 8 { 12.0 } else { 18.0 };
                if (partial_cents - cents).abs() > tolerance {
                    continue;
                }
                weights[i] = observed[i];
                let w = observed[i] / harmonic as f64;
                weighted_cents += partial_cents * w;
                weight_sum += w;
            }
            let norm = weights.iter().map(|w| w * w).sum::<f64>().sqrt().max(1e-9);
            for w in &mut weights {
                *w /= norm;
            }
            let comb = Comb {
                midi,
                cents: (weighted_cents / weight_sum.max(1e-9)).clamp(-50.0, 50.0),
                weights,
                fundamental: Some(fundamental),
                observed_norm: norm,
            };
            if best.as_ref().is_none_or(|(s, _)| norm > *s) {
                best = Some((norm, comb));
            }
        }
        if let Some((_, comb)) = best {
            combs.push(comb);
        }
    }
    let mut residual = observed.clone();
    let mut active: Vec<usize> = Vec::new();
    let mut amplitudes: Vec<f64> = Vec::new();
    let total = observed.iter().map(|v| v * v).sum::<f64>();
    for _ in 0..6 {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let mut winner = None;
        let mut best = 0.0;
        for (i, c) in combs.iter().enumerate() {
            if active.contains(&i) {
                continue;
            }
            let hz = reference * 2.0_f64.powf((c.midi as f64 - 69.0 + c.cents / 100.0) / 12.0);
            let explained_partial = active.iter().any(|&ci| {
                let lower = &combs[ci];
                if lower.midi >= c.midi {
                    return false;
                }
                let low_hz = reference
                    * 2.0_f64.powf((lower.midi as f64 - 69.0 + lower.cents / 100.0) / 12.0);
                let harmonic = (hz / low_hz).round();
                (2.0..=32.0).contains(&harmonic)
                    && (1200.0 * (hz / (low_hz * harmonic)).log2()).abs() < 25.0
            });
            let fundamental = c.fundamental.map(|k| observed[k]).unwrap_or(0.0);
            let independent = c
                .weights
                .iter()
                .zip(&residual)
                .enumerate()
                .filter(|(k, (w, r))| {
                    **w > 0.0
                        && **r > 0.07
                        && peaks[*k].prominent
                        && !active.iter().any(|&ci| {
                            let lower = &combs[ci];
                            let hz = reference
                                * 2.0_f64
                                    .powf((lower.midi as f64 - 69.0 + lower.cents / 100.0) / 12.0);
                            let h = (peaks[*k].hz / hz).round();
                            // Partial ownership extends past the fitted comb for
                            // admission: an unused ninth partial is not by itself
                            // a new fundamental. Frequency-separated voices survive.
                            (1.0..=64.0).contains(&h)
                                && (1200.0 * (peaks[*k].hz / (hz * h)).log2()).abs() < 12.0
                        })
                })
                .count();
            let matching = c.weights.iter().filter(|&&w| w > 0.0).count();
            let singleton = !explained_partial
                && c.fundamental
                    .is_some_and(|k| peaks[k].prominent && residual[k] > 0.15);
            let temporal_voice = temporal.is_some_and(|e| {
                e.independent(c.midi) && active.iter().any(|&ci| combs[ci].midi == e.parent(c.midi))
            });
            if fundamental < 0.10
                || (!temporal_voice && independent < if singleton { 1 } else { 2 })
                || (explained_partial && matching < 3)
            {
                continue;
            }
            // Static admission counts residual energy; temporal admission also
            // counts measured innovations, paying the same complexity gate.
            let improvement = c
                .weights
                .iter()
                .zip(&residual)
                .filter(|(w, _)| **w > 0.0)
                .map(|(_, r)| r.max(0.0).powi(2))
                .sum::<f64>();
            let improvement = if temporal_voice {
                let shape = temporal.unwrap().shape(c.midi);
                let innovation = c
                    .weights
                    .iter()
                    .enumerate()
                    .filter(|(_, w)| **w > 0.0)
                    .map(|(k, _)| {
                        let h = (peaks[k].hz / hz).round() as usize;
                        if (1..=8).contains(&h) {
                            observed[k].powi(2) * shape[h - 1].powf(1.4)
                        } else {
                            0.0
                        }
                    })
                    .sum::<f64>();
                improvement.max(innovation)
            } else {
                improvement
            };
            if improvement > best {
                best = improvement;
                winner = Some(i);
            }
        }
        if best < total * MIN_FIT_IMPROVEMENT {
            break;
        }
        let Some(i) = winner else {
            break;
        };
        // A temporally admitted voice reopens shared ownership. Its measured
        // innovation supplies a shape; subtract that allocation from earlier
        // combs before jointly refitting all amplitudes.
        let temporal_voice = temporal.is_some_and(|e| {
            e.independent(combs[i].midi)
                && active
                    .iter()
                    .any(|&ci| combs[ci].midi == e.parent(combs[i].midi))
        });
        if temporal_voice {
            let hz = reference
                * 2.0_f64.powf((combs[i].midi as f64 - 69.0 + combs[i].cents / 100.0) / 12.0);
            let shape = temporal.unwrap().shape(combs[i].midi);
            for (k, peak) in peaks.iter().enumerate() {
                let h = (peak.hz / hz).round() as usize;
                if combs[i].weights[k] == 0.0 || !(1..=8).contains(&h) {
                    continue;
                }
                let allocation = observed[k] * shape[h - 1].clamp(0.0, 0.85);
                combs[i].weights[k] = allocation;
                for &ci in &active {
                    // Recover physical (pre-normalization) amplitudes first.
                    combs[ci].weights[k] =
                        (combs[ci].weights[k] * combs[ci].observed_norm - allocation).max(0.0)
                            / combs[ci].observed_norm.max(1e-9);
                }
            }
        } else {
            for (w, r) in combs[i].weights.iter_mut().zip(&residual) {
                if *w > 0.0 {
                    *w = r.max(0.0);
                }
            }
        }
        for ci in active.iter().copied().chain(std::iter::once(i)) {
            let norm = combs[ci]
                .weights
                .iter()
                .map(|w| w * w)
                .sum::<f64>()
                .sqrt()
                .max(1e-9);
            for w in &mut combs[ci].weights {
                *w /= norm;
            }
            combs[ci].observed_norm = if ci == i {
                norm
            } else {
                combs[ci].observed_norm * norm
            };
        }
        residual.clone_from(&observed);
        amplitudes.fill(0.0);
        active.push(i);
        amplitudes.push(0.0);
        // Bounded coordinate descent refits all active nonnegative amplitudes after each addition.
        for _ in 0..20 {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            for (a, &ci) in active.iter().enumerate() {
                let c = &combs[ci];
                let norm = c.weights.iter().map(|w| w * w).sum::<f64>();
                let delta = c
                    .weights
                    .iter()
                    .zip(&residual)
                    .map(|(w, r)| w * r)
                    .sum::<f64>()
                    / norm.max(1e-9);
                let next = (amplitudes[a] + delta).max(0.0);
                let change = next - amplitudes[a];
                amplitudes[a] = next;
                for (r, w) in residual.iter_mut().zip(&c.weights) {
                    *r -= change * w;
                }
            }
        }
    }
    let mut notes: Vec<_> = active
        .iter()
        .zip(&amplitudes)
        .filter(|(i, a)| **a / combs[**i].observed_norm.max(1e-9) > MIN_VOICE_SUPPORT)
        .map(|(&i, &a)| Pitch {
            midi: combs[i].midi,
            cents: combs[i].cents,
            support: (a / combs[i].observed_norm.max(1e-9)).min(1.0),
        })
        .collect();
    notes.sort_by_key(|n| n.midi);
    Ok(Fit {
        notes,
        residual: residual.iter().map(|v| v.max(0.0).powi(2)).sum::<f64>() / total.max(1e-9),
    })
}

#[cfg(test)]
pub(crate) fn fit_original(
    spectrum: &Spectrum,
    reference: f64,
    tuning: f64,
    temporal: Option<&crate::voice_evidence::Evidence>,
    cancelled: &(dyn Fn() -> bool + Sync),
) -> Result<Fit, AnalysisError> {
    let peaks = &spectrum.peaks;
    let max = peaks.iter().map(|p| p.amplitude).fold(0.0, f64::max);
    if max < 1e-7 || !spectrum.supported || spectrum.peak_energy_fraction < MIN_PEAK_ENERGY_FRACTION
    {
        return Ok(Fit {
            notes: vec![],
            residual: 1.0,
        });
    }
    let observed: Vec<f64> = peaks
        .iter()
        .map(|p| (p.amplitude / max).powf(0.7))
        .collect();
    let mut combs = Vec::new();
    for midi in MIN_MIDI..=MAX_MIDI {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let nominal = reference * 2.0_f64.powf((midi as f64 - 69.0) / 12.0);
        let mut best: Option<(f64, Comb)> = None;
        // Each hypothesis starts at a measured fundamental, not at a chord tone
        // or a subharmonic of a higher peak. Its frequency anchors which partials
        // it can own; averaging shared upper peaks must not move that anchor.
        for (fundamental, peak) in peaks.iter().enumerate() {
            let cents = 1200.0 * (peak.hz / nominal).log2();
            if (cents - tuning).abs() > 45.0 {
                continue;
            }
            let mut weights = vec![0.0; peaks.len()];
            let mut weighted_cents = 0.0;
            let mut weight_sum = 0.0;
            for (i, p) in peaks.iter().enumerate() {
                let harmonic = (p.hz / peak.hz).round() as usize;
                if !(1..=MAX_HARMONICS).contains(&harmonic) {
                    continue;
                }
                let partial_cents = 1200.0 * (p.hz / (nominal * harmonic as f64)).log2();
                // High string partials may drift, but a candidate cannot freely
                // consume every peak within a semitone of an integer multiple.
                let tolerance = if harmonic <= 8 { 12.0 } else { 18.0 };
                if (partial_cents - cents).abs() > tolerance {
                    continue;
                }
                weights[i] = observed[i];
                let w = observed[i] / harmonic as f64;
                weighted_cents += partial_cents * w;
                weight_sum += w;
            }
            let norm = weights.iter().map(|w| w * w).sum::<f64>().sqrt().max(1e-9);
            for w in &mut weights {
                *w /= norm;
            }
            let comb = Comb {
                midi,
                cents: (weighted_cents / weight_sum.max(1e-9)).clamp(-50.0, 50.0),
                weights,
                fundamental: Some(fundamental),
                observed_norm: norm,
            };
            if best.as_ref().is_none_or(|(s, _)| norm > *s) {
                best = Some((norm, comb));
            }
        }
        if let Some((_, comb)) = best {
            combs.push(comb);
        }
    }
    let mut residual = observed.clone();
    let mut active: Vec<usize> = Vec::new();
    let mut amplitudes: Vec<f64> = Vec::new();
    let total = observed.iter().map(|v| v * v).sum::<f64>();
    for _ in 0..6 {
        if cancelled() {
            return Err(AnalysisError::Cancelled);
        }
        let mut winner = None;
        let mut best = 0.0;
        for (i, c) in combs.iter().enumerate() {
            if active.contains(&i) {
                continue;
            }
            let hz = reference * 2.0_f64.powf((c.midi as f64 - 69.0 + c.cents / 100.0) / 12.0);
            let explained_partial = active.iter().any(|&ci| {
                let lower = &combs[ci];
                if lower.midi >= c.midi {
                    return false;
                }
                let low_hz = reference
                    * 2.0_f64.powf((lower.midi as f64 - 69.0 + lower.cents / 100.0) / 12.0);
                let harmonic = (hz / low_hz).round();
                (2.0..=32.0).contains(&harmonic)
                    && (1200.0 * (hz / (low_hz * harmonic)).log2()).abs() < 25.0
            });
            let fundamental = c.fundamental.map(|k| observed[k]).unwrap_or(0.0);
            let independent = c
                .weights
                .iter()
                .zip(&residual)
                .enumerate()
                .filter(|(k, (w, r))| {
                    **w > 0.0
                        && **r > 0.07
                        && peaks[*k].prominent
                        && !active.iter().any(|&ci| {
                            let lower = &combs[ci];
                            let hz = reference
                                * 2.0_f64
                                    .powf((lower.midi as f64 - 69.0 + lower.cents / 100.0) / 12.0);
                            let h = (peaks[*k].hz / hz).round();
                            // Partial ownership extends past the fitted comb for
                            // admission: an unused ninth partial is not by itself
                            // a new fundamental. Frequency-separated voices survive.
                            (1.0..=64.0).contains(&h)
                                && (1200.0 * (peaks[*k].hz / (hz * h)).log2()).abs() < 12.0
                        })
                })
                .count();
            let matching = c.weights.iter().filter(|&&w| w > 0.0).count();
            let singleton = !explained_partial
                && c.fundamental
                    .is_some_and(|k| peaks[k].prominent && residual[k] > 0.15);
            let temporal_voice = temporal.is_some_and(|e| {
                e.independent(c.midi) && active.iter().any(|&ci| combs[ci].midi == e.parent(c.midi))
            });
            if fundamental < 0.10
                || (!temporal_voice && independent < if singleton { 1 } else { 2 })
                || (explained_partial && matching < 3)
            {
                continue;
            }
            // Static admission counts residual energy; temporal admission also
            // counts measured innovations, paying the same complexity gate.
            let improvement = c
                .weights
                .iter()
                .zip(&residual)
                .filter(|(w, _)| **w > 0.0)
                .map(|(_, r)| r.max(0.0).powi(2))
                .sum::<f64>();
            let improvement = if temporal_voice {
                let shape = temporal.unwrap().shape(c.midi);
                let innovation = c
                    .weights
                    .iter()
                    .enumerate()
                    .filter(|(_, w)| **w > 0.0)
                    .map(|(k, _)| {
                        let h = (peaks[k].hz / hz).round() as usize;
                        if (1..=8).contains(&h) {
                            observed[k].powi(2) * shape[h - 1].powf(1.4)
                        } else {
                            0.0
                        }
                    })
                    .sum::<f64>();
                improvement.max(innovation)
            } else {
                improvement
            };
            if improvement > best {
                best = improvement;
                winner = Some(i);
            }
        }
        if best < total * MIN_FIT_IMPROVEMENT {
            break;
        }
        let Some(i) = winner else {
            break;
        };
        // A temporally admitted voice reopens shared ownership. Its measured
        // innovation supplies a shape; subtract that allocation from earlier
        // combs before jointly refitting all amplitudes.
        let temporal_voice = temporal.is_some_and(|e| {
            e.independent(combs[i].midi)
                && active
                    .iter()
                    .any(|&ci| combs[ci].midi == e.parent(combs[i].midi))
        });
        if temporal_voice {
            let hz = reference
                * 2.0_f64.powf((combs[i].midi as f64 - 69.0 + combs[i].cents / 100.0) / 12.0);
            let shape = temporal.unwrap().shape(combs[i].midi);
            for (k, peak) in peaks.iter().enumerate() {
                let h = (peak.hz / hz).round() as usize;
                if combs[i].weights[k] == 0.0 || !(1..=8).contains(&h) {
                    continue;
                }
                let allocation = observed[k] * shape[h - 1].clamp(0.0, 0.85);
                combs[i].weights[k] = allocation;
                for &ci in &active {
                    // Recover physical (pre-normalization) amplitudes first.
                    combs[ci].weights[k] =
                        (combs[ci].weights[k] * combs[ci].observed_norm - allocation).max(0.0)
                            / combs[ci].observed_norm.max(1e-9);
                }
            }
        } else {
            for (w, r) in combs[i].weights.iter_mut().zip(&residual) {
                if *w > 0.0 {
                    *w = r.max(0.0);
                }
            }
        }
        for ci in active.iter().copied().chain(std::iter::once(i)) {
            let norm = combs[ci]
                .weights
                .iter()
                .map(|w| w * w)
                .sum::<f64>()
                .sqrt()
                .max(1e-9);
            for w in &mut combs[ci].weights {
                *w /= norm;
            }
            combs[ci].observed_norm = if ci == i {
                norm
            } else {
                combs[ci].observed_norm * norm
            };
        }
        residual.clone_from(&observed);
        amplitudes.fill(0.0);
        active.push(i);
        amplitudes.push(0.0);
        // Bounded coordinate descent refits all active nonnegative amplitudes after each addition.
        for _ in 0..20 {
            if cancelled() {
                return Err(AnalysisError::Cancelled);
            }
            for (a, &ci) in active.iter().enumerate() {
                let c = &combs[ci];
                let norm = c.weights.iter().map(|w| w * w).sum::<f64>();
                let delta = c
                    .weights
                    .iter()
                    .zip(&residual)
                    .map(|(w, r)| w * r)
                    .sum::<f64>()
                    / norm.max(1e-9);
                let next = (amplitudes[a] + delta).max(0.0);
                let change = next - amplitudes[a];
                amplitudes[a] = next;
                for (r, w) in residual.iter_mut().zip(&c.weights) {
                    *r -= change * w;
                }
            }
        }
    }
    let mut notes: Vec<_> = active
        .iter()
        .zip(&amplitudes)
        .filter(|(i, a)| **a / combs[**i].observed_norm.max(1e-9) > MIN_VOICE_SUPPORT)
        .map(|(&i, &a)| Pitch {
            midi: combs[i].midi,
            cents: combs[i].cents,
            support: (a / combs[i].observed_norm.max(1e-9)).min(1.0),
        })
        .collect();
    notes.sort_by_key(|n| n.midi);
    Ok(Fit {
        notes,
        residual: residual.iter().map(|v| v.max(0.0).powi(2)).sum::<f64>() / total.max(1e-9),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_partials_require_residual_refitting() {
        for interval in [7, 12, 19] {
            let pcm: Vec<_> = (0..24000)
                .map(|i| {
                    let t = i as f64 / 24000.0;
                    [
                        (60, -9.0, [0.07, 0.035, 0.02, 0.012]),
                        (60 + interval, 13.0, [0.055, 0.025, 0.017, 0.009]),
                    ]
                    .iter()
                    .map(|(m, c, amps)| {
                        let f = 440.0 * 2.0_f64.powf((*m as f64 - 69.0 + c / 100.0) / 12.0);
                        amps.iter()
                            .enumerate()
                            .map(|(h, a)| {
                                a * (std::f64::consts::TAU * f * (h + 1) as f64 * t
                                    + h as f64 * 0.7)
                                    .sin()
                            })
                            .sum::<f64>()
                    })
                    .sum::<f64>() as f32
                })
                .collect();
            let s = crate::spectrum::SpectralAnalyzer::new(4096).compute(&pcm, 12000);
            let fit = fit(&s, 440.0, 0.0, None, &|| false).unwrap();
            assert_eq!(
                fit.notes.iter().map(|n| n.midi).collect::<Vec<_>>(),
                vec![60, 60 + interval],
                "{interval}: {:?}",
                fit.notes
            );
        }
    }
}
