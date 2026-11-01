use crate::{config::PEAK_FLOOR_RATIO, SAMPLE_RATE_HZ};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::sync::Arc;
#[derive(Debug, Clone)]
pub(crate) struct Peak {
    pub hz: f64,
    pub amplitude: f64,
    pub prominent: bool,
    // Phase at the window center, not at the FFT buffer origin.
    pub phase: f64,
}
pub(crate) struct Spectrum {
    pub peaks: Vec<Peak>,
    pub flatness: f64,
    pub tonal_fraction: f64,
    pub supported: bool,
    pub peak_energy_fraction: f64,
    pub rms: f64,
}
pub(crate) struct SpectralAnalyzer {
    fft: Arc<dyn Fft<f64>>,
    window: Vec<f64>,
    buffer: Vec<Complex<f64>>,
    scratch: Vec<Complex<f64>>,
    magnitudes: Vec<f64>,
    neighborhood: Vec<f64>,
}
impl SpectralAnalyzer {
    pub fn new(size: usize) -> Self {
        let fft = FftPlanner::new().plan_fft_forward(size);
        let scratch = vec![Complex::default(); fft.get_inplace_scratch_len()];
        let window = (0..size)
            .map(|i| 0.5 - 0.5 * (std::f64::consts::TAU * i as f64 / size as f64).cos())
            .collect();
        Self {
            fft,
            window,
            buffer: vec![Complex::default(); size],
            scratch,
            magnitudes: vec![0.0; size / 2 + 1],
            neighborhood: Vec::with_capacity(44),
        }
    }
    /// Short-window complex measurements at already resolved long-window peaks.
    /// One shared transform serves every trajectory; it does not propose pitches.
    pub fn measure(
        &mut self,
        samples: &[f32],
        center: usize,
        anchors: &[Peak],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Vec<Peak>, crate::AnalysisError> {
        self.transform(samples, center);
        let n = self.buffer.len();
        let bin_hz = SAMPLE_RATE_HZ as f64 / n as f64;
        let mut observed = Vec::with_capacity(anchors.len());
        for peak in anchors {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            let q = peak.hz / bin_hz;
            let nearest = q.round() as isize;
            let mut z = Complex::default();
            // Dirichlet interpolation of the existing FFT, centered in time.
            // A Hann lobe decays cubically outside these neighboring bins.
            for k in nearest - 4..=nearest + 4 {
                let d = k as f64 - q;
                let response = if d.abs() < 1e-9 {
                    1.0
                } else {
                    (std::f64::consts::PI * d).sin()
                        / (n as f64 * (std::f64::consts::PI * d / n as f64).sin())
                };
                let phase = -std::f64::consts::PI * d / n as f64;
                let sign = if k.rem_euclid(2) == 0 { 1.0 } else { -1.0 };
                z += self.buffer[k.rem_euclid(n as isize) as usize]
                    * Complex::from_polar(response * sign, phase);
            }
            observed.push(z * (4.0 / n as f64));
        }
        let mut components: Vec<_> = anchors
            .iter()
            .map(|p| Complex::from_polar(p.amplitude, p.phase))
            .collect();
        // Bounded leakage reassignment at measured frequencies. The long-window
        // estimate regularizes unresolved short-window neighbors; no new bin or
        // pitch is introduced, and no transform is run per candidate.
        let cacheable = anchors.len() <= 552;
        let priors = cacheable.then(|| components.clone());
        let mut rows: Vec<Option<Vec<(usize, f64)>>> = if cacheable {
            (0..anchors.len()).map(|_| None).collect()
        } else {
            Vec::new()
        };
        for pass in 0..4 {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            for (i, peak) in anchors.iter().enumerate() {
                if cancelled() {
                    return Err(crate::AnalysisError::Cancelled);
                }
                let mut target = observed[i];
                // Construct at the original checked anchor, never in an unchecked prepass.
                if cacheable && pass == 0 {
                    rows[i] = leakage_row(anchors, i, bin_hz);
                }
                if let Some(row) = rows.get(i).and_then(Option::as_ref) {
                    for &(j, response) in row {
                        target -= components[j] * response;
                    }
                } else {
                    for (j, other) in anchors.iter().enumerate() {
                        let delta = (other.hz - peak.hz) / bin_hz;
                        if delta > 4.0 {
                            break;
                        }
                        if i == j || delta < -4.0 {
                            continue;
                        }
                        let sinc = |x: f64| {
                            if x.abs() < 1e-9 {
                                1.0
                            } else {
                                (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
                            }
                        };
                        let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
                        target -= components[j] * response;
                    }
                }
                let prior = priors
                    .as_ref()
                    .map_or_else(|| Complex::from_polar(peak.amplitude, peak.phase), |p| p[i]);
                components[i] = components[i] * 0.5 + (target * 0.9 + prior * 0.1) * 0.5;
            }
        }
        Ok(anchors
            .iter()
            .zip(components)
            .map(|(p, z)| Peak {
                hz: p.hz,
                amplitude: z.norm(),
                phase: z.arg(),
                prominent: p.prominent,
            })
            .collect())
    }
    fn transform(&mut self, samples: &[f32], center: usize) -> f64 {
        let size = self.buffer.len();
        let left = center as isize - size as isize / 2;
        let mut mean = 0.0;
        let mut energy = 0.0;
        for i in 0..size {
            let at = left + i as isize;
            let x = if at >= 0 {
                samples
                    .get(at as usize)
                    .copied()
                    .unwrap_or(0.0)
                    .clamp(-1.0, 1.0) as f64
            } else {
                0.0
            };
            self.buffer[i] = Complex::new(x, 0.0);
            mean += x;
            energy += x * x;
        }
        mean /= size as f64;
        for (x, w) in self.buffer.iter_mut().zip(&self.window) {
            x.re = (x.re - mean) * w;
        }
        self.fft
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        energy
    }
    pub fn compute(&mut self, samples: &[f32], center: usize) -> Spectrum {
        let energy = self.transform(samples, center);
        let size = self.buffer.len();
        for (m, z) in self.magnitudes.iter_mut().zip(&self.buffer) {
            *m = z.norm() * 4.0 / size as f64;
        }
        let max = self.magnitudes.iter().copied().fold(0.0, f64::max);
        let bin_hz = SAMPLE_RATE_HZ as f64 / size as f64;
        let lo = (35.0 / bin_hz) as usize;
        let hi = (6500.0 / bin_hz) as usize;
        let mut log_sum = 0.0;
        let mut sum = 0.0;
        let mut tonal = 0.0;
        for &v in &self.magnitudes[lo..hi] {
            log_sum += (v + 1e-12).ln();
            sum += v;
        }
        let flatness = (log_sum / (hi - lo) as f64).exp() / (sum / (hi - lo) as f64 + 1e-12);
        let mut peaks = Vec::new();
        let mut peak_energy = 0.0;
        for i in lo.max(2)..hi.min(self.magnitudes.len() - 1) {
            let v = self.magnitudes[i];
            if v < max * 0.008
                || v < 1e-7
                || v <= self.magnitudes[i - 1]
                || v < self.magnitudes[i + 1]
            {
                continue;
            }
            // Measure the noise floor outside this peak's Hann main lobe.
            self.neighborhood.clear();
            self.neighborhood.extend(
                (i.saturating_sub(24)..=(i + 24).min(hi - 1))
                    .filter(|&k| k.abs_diff(i) > 2)
                    .map(|k| self.magnitudes[k]),
            );
            let middle = self.neighborhood.len() / 2;
            let floor = *self
                .neighborhood
                .select_nth_unstable_by(middle, f64::total_cmp)
                .1;
            let prominent = v >= floor * PEAK_FLOOR_RATIO;
            // Log-parabolic Hann interpolation reduces bin quantization without snapping to notes.
            let a = (self.magnitudes[i - 1] + 1e-15).ln();
            let b = (v + 1e-15).ln();
            let c = (self.magnitudes[i + 1] + 1e-15).ln();
            let delta = (0.5 * (a - c) / (a - 2.0 * b + c)).clamp(-0.5, 0.5);
            let amplitude = (b - 0.25 * (a - c) * delta).exp();
            tonal += self.magnitudes[i - 1] + v + self.magnitudes[i + 1];
            // Prominence gates the window, not each voice: a quiet fundamental
            // can still be supported by its coherent partials in a dense mixture.
            if prominent {
                peak_energy +=
                    self.magnitudes[i - 1].powi(2) + v.powi(2) + self.magnitudes[i + 1].powi(2);
            }
            peaks.push(Peak {
                hz: (i as f64 + delta) * bin_hz,
                amplitude,
                prominent,
                phase: self.buffer[i].arg() + std::f64::consts::PI * i as f64,
            });
        }
        Spectrum {
            peaks,
            flatness,
            tonal_fraction: (tonal / (sum + 1e-12)).min(1.0),
            // A fixed-size comb cannot resolve narrow fundamentals when most of the
            // entire recording is padding. Abstain instead of fitting truncation lobes.
            supported: samples.len() >= size,
            rms: (energy / size as f64).sqrt(),
            peak_energy_fraction: peak_energy
                / self.magnitudes[lo..hi]
                    .iter()
                    .map(|v| v * v)
                    .sum::<f64>()
                    .max(1e-15),
        }
    }
}

// Preserve even the first delta>4 break for unsorted/exceptional anchors.
// Oversized rows use the original scan; no neighbors are truncated.
fn leakage_row(anchors: &[Peak], i: usize, bin_hz: f64) -> Option<Vec<(usize, f64)>> {
    let mut row = Vec::with_capacity(34);
    for (j, other) in anchors.iter().enumerate() {
        let delta = (other.hz - anchors[i].hz) / bin_hz;
        if delta > 4.0 {
            break;
        }
        if i == j || delta < -4.0 {
            continue;
        }
        if row.len() == 34 {
            return None;
        }
        let sinc = |x: f64| {
            if x.abs() < 1e-9 {
                1.0
            } else {
                (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
            }
        };
        let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
        row.push((j, response));
    }
    Some(row)
}

#[cfg(test)]
impl SpectralAnalyzer {
    #[cfg(test)]
    pub(crate) fn measure_original(
        &mut self,
        samples: &[f32],
        center: usize,
        anchors: &[Peak],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Vec<Peak>, crate::AnalysisError> {
        self.compute_original(samples, center);
        let n = self.buffer.len();
        let bin_hz = SAMPLE_RATE_HZ as f64 / n as f64;
        let mut observed = Vec::with_capacity(anchors.len());
        for peak in anchors {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            let q = peak.hz / bin_hz;
            let nearest = q.round() as isize;
            let mut z = Complex::default();
            // Dirichlet interpolation of the existing FFT, centered in time.
            // A Hann lobe decays cubically outside these neighboring bins.
            for k in nearest - 4..=nearest + 4 {
                let d = k as f64 - q;
                let response = if d.abs() < 1e-9 {
                    1.0
                } else {
                    (std::f64::consts::PI * d).sin()
                        / (n as f64 * (std::f64::consts::PI * d / n as f64).sin())
                };
                let phase = -std::f64::consts::PI * d / n as f64;
                let sign = if k.rem_euclid(2) == 0 { 1.0 } else { -1.0 };
                z += self.buffer[k.rem_euclid(n as isize) as usize]
                    * Complex::from_polar(response * sign, phase);
            }
            observed.push(z * (4.0 / n as f64));
        }
        let mut components: Vec<_> = anchors
            .iter()
            .map(|p| Complex::from_polar(p.amplitude, p.phase))
            .collect();
        // Bounded leakage reassignment at measured frequencies. The long-window
        // estimate regularizes unresolved short-window neighbors; no new bin or
        // pitch is introduced, and no transform is run per candidate.
        for _ in 0..4 {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            for (i, peak) in anchors.iter().enumerate() {
                if cancelled() {
                    return Err(crate::AnalysisError::Cancelled);
                }
                let mut target = observed[i];
                for (j, other) in anchors.iter().enumerate() {
                    let delta = (other.hz - peak.hz) / bin_hz;
                    if delta > 4.0 {
                        break;
                    }
                    if i == j || delta < -4.0 {
                        continue;
                    }
                    let sinc = |x: f64| {
                        if x.abs() < 1e-9 {
                            1.0
                        } else {
                            (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
                        }
                    };
                    let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
                    target -= components[j] * response;
                }
                let prior = Complex::from_polar(peak.amplitude, peak.phase);
                components[i] = components[i] * 0.5 + (target * 0.9 + prior * 0.1) * 0.5;
            }
        }
        Ok(anchors
            .iter()
            .zip(components)
            .map(|(p, z)| Peak {
                hz: p.hz,
                amplitude: z.norm(),
                phase: z.arg(),
                prominent: p.prominent,
            })
            .collect())
    }

    #[cfg(test)]
    pub(crate) fn compute_original(&mut self, samples: &[f32], center: usize) -> Spectrum {
        let size = self.buffer.len();
        let left = center as isize - size as isize / 2;
        let mut mean = 0.0;
        let mut energy = 0.0;
        for i in 0..size {
            let at = left + i as isize;
            let x = if at >= 0 {
                samples
                    .get(at as usize)
                    .copied()
                    .unwrap_or(0.0)
                    .clamp(-1.0, 1.0) as f64
            } else {
                0.0
            };
            self.buffer[i] = Complex::new(x, 0.0);
            mean += x;
            energy += x * x;
        }
        mean /= size as f64;
        for (x, w) in self.buffer.iter_mut().zip(&self.window) {
            x.re = (x.re - mean) * w;
        }
        self.fft
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        for (m, z) in self.magnitudes.iter_mut().zip(&self.buffer) {
            *m = z.norm() * 4.0 / size as f64;
        }
        let max = self.magnitudes.iter().copied().fold(0.0, f64::max);
        let bin_hz = SAMPLE_RATE_HZ as f64 / size as f64;
        let lo = (35.0 / bin_hz) as usize;
        let hi = (6500.0 / bin_hz) as usize;
        let mut log_sum = 0.0;
        let mut sum = 0.0;
        let mut tonal = 0.0;
        for &v in &self.magnitudes[lo..hi] {
            log_sum += (v + 1e-12).ln();
            sum += v;
        }
        let flatness = (log_sum / (hi - lo) as f64).exp() / (sum / (hi - lo) as f64 + 1e-12);
        let mut peaks = Vec::new();
        let mut peak_energy = 0.0;
        for i in lo.max(2)..hi.min(self.magnitudes.len() - 1) {
            let v = self.magnitudes[i];
            if v < max * 0.008
                || v < 1e-7
                || v <= self.magnitudes[i - 1]
                || v < self.magnitudes[i + 1]
            {
                continue;
            }
            // Measure the noise floor outside this peak's Hann main lobe.
            let mut neighborhood: Vec<_> = (i.saturating_sub(24)..=(i + 24).min(hi - 1))
                .filter(|&k| k.abs_diff(i) > 2)
                .map(|k| self.magnitudes[k])
                .collect();
            neighborhood.sort_by(f64::total_cmp);
            let floor = neighborhood[neighborhood.len() / 2];
            let prominent = v >= floor * PEAK_FLOOR_RATIO;
            // Log-parabolic Hann interpolation reduces bin quantization without snapping to notes.
            let a = (self.magnitudes[i - 1] + 1e-15).ln();
            let b = (v + 1e-15).ln();
            let c = (self.magnitudes[i + 1] + 1e-15).ln();
            let delta = (0.5 * (a - c) / (a - 2.0 * b + c)).clamp(-0.5, 0.5);
            let amplitude = (b - 0.25 * (a - c) * delta).exp();
            tonal += self.magnitudes[i - 1] + v + self.magnitudes[i + 1];
            // Prominence gates the window, not each voice: a quiet fundamental
            // can still be supported by its coherent partials in a dense mixture.
            if prominent {
                peak_energy +=
                    self.magnitudes[i - 1].powi(2) + v.powi(2) + self.magnitudes[i + 1].powi(2);
            }
            peaks.push(Peak {
                hz: (i as f64 + delta) * bin_hz,
                amplitude,
                prominent,
                phase: self.buffer[i].arg() + std::f64::consts::PI * i as f64,
            });
        }
        Spectrum {
            peaks,
            flatness,
            tonal_fraction: (tonal / (sum + 1e-12)).min(1.0),
            // A fixed-size comb cannot resolve narrow fundamentals when most of the
            // entire recording is padding. Abstain instead of fitting truncation lobes.
            supported: samples.len() >= size,
            rms: (energy / size as f64).sqrt(),
            peak_energy_fraction: peak_energy
                / self.magnitudes[lo..hi]
                    .iter()
                    .map(|v| v * v)
                    .sum::<f64>()
                    .max(1e-15),
        }
    }
}

#[cfg(test)]
impl SpectralAnalyzer {
    pub(crate) fn measure_cache_only(
        &mut self,
        samples: &[f32],
        center: usize,
        anchors: &[Peak],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Vec<Peak>, crate::AnalysisError> {
        self.compute_original(samples, center);
        let n = self.buffer.len();
        let bin_hz = SAMPLE_RATE_HZ as f64 / n as f64;
        let mut observed = Vec::with_capacity(anchors.len());
        for peak in anchors {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            let q = peak.hz / bin_hz;
            let nearest = q.round() as isize;
            let mut z = Complex::default();
            // Dirichlet interpolation of the existing FFT, centered in time.
            // A Hann lobe decays cubically outside these neighboring bins.
            for k in nearest - 4..=nearest + 4 {
                let d = k as f64 - q;
                let response = if d.abs() < 1e-9 {
                    1.0
                } else {
                    (std::f64::consts::PI * d).sin()
                        / (n as f64 * (std::f64::consts::PI * d / n as f64).sin())
                };
                let phase = -std::f64::consts::PI * d / n as f64;
                let sign = if k.rem_euclid(2) == 0 { 1.0 } else { -1.0 };
                z += self.buffer[k.rem_euclid(n as isize) as usize]
                    * Complex::from_polar(response * sign, phase);
            }
            observed.push(z * (4.0 / n as f64));
        }
        let mut components: Vec<_> = anchors
            .iter()
            .map(|p| Complex::from_polar(p.amplitude, p.phase))
            .collect();
        // Bounded leakage reassignment at measured frequencies. The long-window
        // estimate regularizes unresolved short-window neighbors; no new bin or
        // pitch is introduced, and no transform is run per candidate.
        let cacheable = anchors.len() <= 552;
        let priors = cacheable.then(|| components.clone());
        let mut rows: Vec<Option<Vec<(usize, f64)>>> = if cacheable {
            (0..anchors.len()).map(|_| None).collect()
        } else {
            Vec::new()
        };
        for pass in 0..4 {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            for (i, peak) in anchors.iter().enumerate() {
                if cancelled() {
                    return Err(crate::AnalysisError::Cancelled);
                }
                let mut target = observed[i];
                // Construct at the original checked anchor, never in an unchecked prepass.
                if cacheable && pass == 0 {
                    rows[i] = leakage_row(anchors, i, bin_hz);
                }
                if let Some(row) = rows.get(i).and_then(Option::as_ref) {
                    for &(j, response) in row {
                        target -= components[j] * response;
                    }
                } else {
                    for (j, other) in anchors.iter().enumerate() {
                        let delta = (other.hz - peak.hz) / bin_hz;
                        if delta > 4.0 {
                            break;
                        }
                        if i == j || delta < -4.0 {
                            continue;
                        }
                        let sinc = |x: f64| {
                            if x.abs() < 1e-9 {
                                1.0
                            } else {
                                (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
                            }
                        };
                        let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
                        target -= components[j] * response;
                    }
                }
                let prior = priors
                    .as_ref()
                    .map_or_else(|| Complex::from_polar(peak.amplitude, peak.phase), |p| p[i]);
                components[i] = components[i] * 0.5 + (target * 0.9 + prior * 0.1) * 0.5;
            }
        }
        Ok(anchors
            .iter()
            .zip(components)
            .map(|(p, z)| Peak {
                hz: p.hz,
                amplitude: z.norm(),
                phase: z.arg(),
                prominent: p.prominent,
            })
            .collect())
    }
    pub(crate) fn measure_transform_only(
        &mut self,
        samples: &[f32],
        center: usize,
        anchors: &[Peak],
        cancelled: &(dyn Fn() -> bool + Sync),
    ) -> Result<Vec<Peak>, crate::AnalysisError> {
        self.transform(samples, center);
        let n = self.buffer.len();
        let bin_hz = SAMPLE_RATE_HZ as f64 / n as f64;
        let mut observed = Vec::with_capacity(anchors.len());
        for peak in anchors {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            let q = peak.hz / bin_hz;
            let nearest = q.round() as isize;
            let mut z = Complex::default();
            // Dirichlet interpolation of the existing FFT, centered in time.
            // A Hann lobe decays cubically outside these neighboring bins.
            for k in nearest - 4..=nearest + 4 {
                let d = k as f64 - q;
                let response = if d.abs() < 1e-9 {
                    1.0
                } else {
                    (std::f64::consts::PI * d).sin()
                        / (n as f64 * (std::f64::consts::PI * d / n as f64).sin())
                };
                let phase = -std::f64::consts::PI * d / n as f64;
                let sign = if k.rem_euclid(2) == 0 { 1.0 } else { -1.0 };
                z += self.buffer[k.rem_euclid(n as isize) as usize]
                    * Complex::from_polar(response * sign, phase);
            }
            observed.push(z * (4.0 / n as f64));
        }
        let mut components: Vec<_> = anchors
            .iter()
            .map(|p| Complex::from_polar(p.amplitude, p.phase))
            .collect();
        // Bounded leakage reassignment at measured frequencies. The long-window
        // estimate regularizes unresolved short-window neighbors; no new bin or
        // pitch is introduced, and no transform is run per candidate.
        for _ in 0..4 {
            if cancelled() {
                return Err(crate::AnalysisError::Cancelled);
            }
            for (i, peak) in anchors.iter().enumerate() {
                if cancelled() {
                    return Err(crate::AnalysisError::Cancelled);
                }
                let mut target = observed[i];
                for (j, other) in anchors.iter().enumerate() {
                    let delta = (other.hz - peak.hz) / bin_hz;
                    if delta > 4.0 {
                        break;
                    }
                    if i == j || delta < -4.0 {
                        continue;
                    }
                    let sinc = |x: f64| {
                        if x.abs() < 1e-9 {
                            1.0
                        } else {
                            (std::f64::consts::PI * x).sin() / (std::f64::consts::PI * x)
                        }
                    };
                    let response = sinc(delta) + 0.5 * (sinc(delta - 1.0) + sinc(delta + 1.0));
                    target -= components[j] * response;
                }
                let prior = Complex::from_polar(peak.amplitude, peak.phase);
                components[i] = components[i] * 0.5 + (target * 0.9 + prior * 0.1) * 0.5;
            }
        }
        Ok(anchors
            .iter()
            .zip(components)
            .map(|(p, z)| Peak {
                hz: p.hz,
                amplitude: z.norm(),
                phase: z.arg(),
                prominent: p.prominent,
            })
            .collect())
    }
}
#[cfg(test)]
impl SpectralAnalyzer {
    pub(crate) fn transform_bits(&self) -> Vec<(u64, u64)> {
        self.buffer
            .iter()
            .map(|z| (z.re.to_bits(), z.im.to_bits()))
            .collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn short_transform_measures_amplitude_and_center_phase_at_long_anchors() {
        for hz in [110.0, 220.0, 329.63, 523.25, 1046.5] {
            let pcm: Vec<_> = (0..24000)
                .map(|i| {
                    (0.08 * (std::f64::consts::TAU * hz * i as f64 / 24000.0 + 0.37).sin()) as f32
                })
                .collect();
            let spectrum = SpectralAnalyzer::new(4096).compute(&pcm, 12000);
            let anchor = spectrum
                .peaks
                .iter()
                .min_by(|a, b| (a.hz - hz).abs().total_cmp(&(b.hz - hz).abs()))
                .unwrap();
            let measured = SpectralAnalyzer::new(1024)
                .measure(&pcm, 12000, std::slice::from_ref(anchor), &|| false)
                .unwrap();
            assert!(
                (measured[0].amplitude - 0.08).abs() < 0.002,
                "{hz}: {}",
                measured[0].amplitude
            );
            let expected = std::f64::consts::TAU * hz * 0.5 + 0.37 - std::f64::consts::FRAC_PI_2;
            let error = measured[0].phase - expected;
            assert!(error.sin().atan2(error.cos()).abs() < 0.025, "{hz}");
        }
    }
}
