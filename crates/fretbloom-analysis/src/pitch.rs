//! FFT-accelerated YIN differences, without a quadratic lag-by-sample loop.
use crate::{
    config::{MAX_MIDI, MIN_MIDI},
    polyphony::Pitch,
    SAMPLE_RATE_HZ,
};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::sync::Arc;
pub(crate) struct Yin {
    forward: Arc<dyn Fft<f64>>,
    inverse: Arc<dyn Fft<f64>>,
    buffer: Vec<Complex<f64>>,
    scratch: Vec<Complex<f64>>,
    energy: Vec<f64>,
}
impl Yin {
    pub fn new() -> Self {
        let mut p = FftPlanner::new();
        let forward = p.plan_fft_forward(8192);
        let inverse = p.plan_fft_inverse(8192);
        let scratch = vec![
            Complex::default();
            forward
                .get_inplace_scratch_len()
                .max(inverse.get_inplace_scratch_len())
        ];
        Self {
            forward,
            inverse,
            buffer: vec![Complex::default(); 8192],
            scratch,
            energy: vec![0.0; 4097],
        }
    }
    pub fn estimate(&mut self, samples: &[f32], center: usize, reference: f64) -> Option<Pitch> {
        let left = center as isize - 2048;
        let mut mean = 0.0;
        for i in 0..4096 {
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
        }
        mean /= 4096.0;
        self.energy[0] = 0.0;
        for i in 0..4096 {
            self.buffer[i].re -= mean;
            self.energy[i + 1] = self.energy[i] + self.buffer[i].re.powi(2);
        }
        self.buffer[4096..].fill(Complex::default());
        self.forward
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        for z in &mut self.buffer {
            *z = Complex::new(z.norm_sqr(), 0.0);
        }
        self.inverse
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        let min = (SAMPLE_RATE_HZ as f64
            / (reference * 2.0_f64.powf((MAX_MIDI as f64 - 68.5) / 12.0)))
        .floor() as usize;
        let max = (SAMPLE_RATE_HZ as f64
            / (reference * 2.0_f64.powf((MIN_MIDI as f64 - 69.5) / 12.0)))
        .ceil() as usize;
        let mut difference = vec![1.0; max + 2];
        let mut cumulative = 0.0;
        for (lag, d) in difference.iter_mut().enumerate().skip(1) {
            let raw = (self.energy[4096 - lag] + self.energy[4096]
                - self.energy[lag]
                - 2.0 * self.buffer[lag].re / 8192.0)
                .max(0.0);
            cumulative += raw;
            *d = raw * lag as f64 / cumulative.max(1e-15);
        }
        let mut lag = min.max(2);
        while lag <= max {
            if difference[lag] < 0.16 {
                while lag < max && difference[lag + 1] < difference[lag] {
                    lag += 1;
                }
                break;
            }
            lag += 1;
        }
        if lag > max {
            return None;
        }
        let a = difference[lag - 1];
        let b = difference[lag];
        let c = difference[lag + 1];
        let offset = (0.5 * (a - c) / (a - 2.0 * b + c)).clamp(-0.5, 0.5);
        let hz = SAMPLE_RATE_HZ as f64 / (lag as f64 + offset);
        let midi = 69.0 + 12.0 * (hz / reference).log2();
        if midi < MIN_MIDI as f64 - 0.5 || midi > MAX_MIDI as f64 + 0.5 {
            return None;
        }
        Some(Pitch {
            midi: midi.round() as u8,
            cents: ((midi - midi.round()) * 100.0).clamp(-50.0, 50.0),
            support: 1.0 - b,
        })
    }
}
