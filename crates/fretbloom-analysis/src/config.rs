//! Inspectable DSP constants. Thresholds are support gates, never probabilities.
pub const HOP: usize = 480;
pub const WINDOW: usize = 4096;
pub const BASS_WINDOW: usize = 8192;
pub const MIN_MIDI: u8 = 28;
pub const MAX_MIDI: u8 = 96;
pub const SILENCE_RMS: f64 = 0.000_04;
pub const LOW_SIGNAL_RMS: f64 = 0.000_562;
pub const MAX_SAMPLES: usize = 14_400_000;
pub const MAX_NOTES: usize = 4000;
pub const MAX_HARMONY: usize = 3000;

// Local spectral evidence, independent of recording gain and previous attacks.
pub const PEAK_FLOOR_RATIO: f64 = 4.0;
pub const MIN_PEAK_ENERGY_FRACTION: f64 = 0.35;
pub const MAX_HARMONICS: usize = 8;
pub const MIN_FIT_IMPROVEMENT: f64 = 0.005;
pub const MIN_VOICE_SUPPORT: f64 = 0.10;
pub const MIN_CELL_WINDOW_RMS_RATIO: f64 = 0.25;
