use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisMode {
    Auto,
    Monophonic,
    Polyphonic,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Spelling {
    Sharps,
    Flats,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisOptions {
    pub mode: AnalysisMode,
    pub concert_a_hz: f64,
    pub spelling: Spelling,
}
impl Default for AnalysisOptions {
    fn default() -> Self {
        Self {
            mode: AnalysisMode::Auto,
            concert_a_hz: 440.0,
            spelling: Spelling::Sharps,
        }
    }
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProgress {
    pub processed_samples: u64,
    pub total_samples: u64,
}
#[derive(Debug, thiserror::Error)]
pub enum AnalysisError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("analysis cancelled")]
    Cancelled,
    #[error("analysis limit exceeded: {0}")]
    LimitExceeded(String),
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChordQuality {
    #[serde(rename = "maj")]
    Maj,
    #[serde(rename = "min")]
    Min,
    #[serde(rename = "dom7")]
    Dom7,
    #[serde(rename = "maj7")]
    Maj7,
    #[serde(rename = "min7")]
    Min7,
    #[serde(rename = "sus2")]
    Sus2,
    #[serde(rename = "sus4")]
    Sus4,
    #[serde(rename = "add9")]
    Add9,
    #[serde(rename = "madd9")]
    Madd9,
    #[serde(rename = "add11")]
    Add11,
    #[serde(rename = "madd11")]
    Madd11,
    #[serde(rename = "6")]
    Six,
    #[serde(rename = "m6")]
    M6,
    #[serde(rename = "dim")]
    Dim,
    #[serde(rename = "dim7")]
    Dim7,
    #[serde(rename = "hdim7")]
    Hdim7,
    #[serde(rename = "aug")]
    Aug,
    #[serde(rename = "5")]
    Five,
}
#[derive(Debug, Clone, Serialize)]
pub struct ChordTemplate {
    pub quality: ChordQuality,
    pub intervals: &'static [u8],
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordIdentity {
    pub root_pc: u8,
    pub quality: ChordQuality,
    pub bass_pc: Option<u8>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceLevel {
    Low,
    Medium,
    High,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub score: f64,
    pub margin: f64,
    pub level: EvidenceLevel,
}
impl Evidence {
    pub(crate) fn new(score: f64, margin: f64) -> Self {
        let score = score.clamp(0.0, 1.0);
        let margin = margin.clamp(0.0, 1.0);
        let level = if score >= 0.85 && margin >= 0.20 {
            EvidenceLevel::High
        } else if score >= 0.65 && margin >= 0.12 {
            EvidenceLevel::Medium
        } else {
            EvidenceLevel::Low
        };
        Self {
            score,
            margin,
            level,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordCandidate {
    pub chord: ChordIdentity,
    pub label: String,
    pub evidence: Evidence,
    pub supported_pitch_classes: Vec<u8>,
    pub missing_pitch_classes: Vec<u8>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BassEstimate {
    pub midi: u8,
    pub pitch_class: u8,
    pub evidence: Evidence,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NoChordReason {
    Silence,
    Unpitched,
    SingleNote,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnknownReason {
    Ambiguous,
    InsufficientEvidence,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum HarmonyKind {
    Chord {
        primary: ChordCandidate,
        alternatives: Vec<ChordCandidate>,
    },
    NoChord {
        reason: NoChordReason,
    },
    Unknown {
        reason: UnknownReason,
        alternatives: Vec<ChordCandidate>,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarmonyEvent {
    pub start: f64,
    pub end: f64,
    pub bass: Option<BassEstimate>,
    #[serde(flatten)]
    pub kind: HarmonyKind,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteEvent {
    pub start: f64,
    pub end: f64,
    pub midi: u8,
    pub name: String,
    pub cents: f64,
    pub evidence: Evidence,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningCode {
    Clipping,
    LowSignal,
    DensePolyphony,
    TuningUncertain,
    ChannelCancellation,
    LimitedBandwidth,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisWarning {
    pub code: WarningCode,
    pub message: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tuning {
    pub reference_hz: f64,
    pub estimated_offset_cents: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub schema_version: u8,
    pub engine_version: String,
    pub options: AnalysisOptions,
    pub duration: f64,
    pub sample_rate_hz: u32,
    pub timing_resolution_seconds: f64,
    pub tuning: Tuning,
    pub harmony: Vec<HarmonyEvent>,
    pub monophonic_notes: Vec<NoteEvent>,
    pub polyphonic_notes: Vec<NoteEvent>,
    pub warnings: Vec<AnalysisWarning>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlignmentFrame {
    pub time: f64,
    pub chroma: [f64; 12],
    pub midi: Option<u8>,
    pub rms: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentFeatures {
    pub schema_version: u8,
    pub engine_version: String,
    pub duration: f64,
    pub hop_seconds: f64,
    pub frames: Vec<AlignmentFrame>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisOutput {
    pub result: AnalysisResult,
    pub features: AlignmentFeatures,
}
