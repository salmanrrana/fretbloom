# Rust music analysis: implementation contract

Status: design contract, not an implementation or an accuracy report. Prepared against
`ed6507981fb61804098be7bfc6d955bdcf2cae37` on `fix/song-playalong-audit` in
`/home/xtra/code/personal_projects/fretbloom-song-audit`.

Only this document belongs to the design agent. Builders must leave
`validation/audio/**` and `docs/rust-validation.md` to the independent validation
agent. No branch changes, commits, deployments, production access, live-data
migration, or work in `/home/xtra/code/personal_projects/fretbloom` are authorized
by this contract.

## 1. Decision and scope

Build a complete Rust media-analysis backend behind the existing Node gateway.
Rust owns uploaded media, YouTube acquisition for the new API, decoding, jobs,
resource limits, cancellation, spectral analysis, notes, chords, bass evidence,
and temporary playback audio. React consumes versioned results. Node retains the
public HTTP origin, owner authentication, static files, Postgres song API,
caption/lyrics providers, and existing compatibility routes.

This is a production-shaped local implementation, not a triad-only proof of
concept: both upload and accessible-YouTube flows must reach the player and
Songbook; every chord family below must have actual inference and independent
evaluation. Completing the plumbing does not prove the requested musical accuracy.

Keep the live tuner and Listen audio on-device. Keep the current browser analyzer
as an explicitly labeled, limited local option, not a silent substitute for Rust.
Do not add source-separation models, GPU infrastructure, training pipelines,
Redis, object storage, or a plugin architecture. FFmpeg and yt-dlp remain the
maintained codec/extraction tools. Rust is orchestration and DSP, not a codec or
YouTube implementation.

The first release can reasonably identify clear isolated guitar notes and useful
chord events in clean recordings. Recovering every guitar note from a dense mix,
distinguishing all harmonically equivalent chord names, and reconstructing actual
string/fret choices remain unproven. Bass means the lowest supported pitch in the
recording, which may be a bass guitar rather than the guitar being practiced.

## 2. Existing behavior that must survive

Read these before editing: `server/index.ts`, `ownerAccess.ts`, `clientAddress.ts`,
`songApi.ts`, `songStore.ts`, `youtube.ts`, `src/data/songbook.ts`, `songSync.ts`,
`src/audio/songAlignment.ts`, `youtubeAnalysis.ts`, and the playback components.

- All `/api/*` and `/songbook[/…]` are owner protected when hosted. Basic username
  remains `salmanrrana`; password minimum remains 20 characters. Preserve the
  constant-time secret comparison, bounded failure counter, cross-site rejection,
  security headers, trusted-proxy address handling, and fail-closed startup.
- Development without credentials/database remains loopback-only and browser
  persisted. `/api/session` stays `{ "owner": "local" }` in local mode and
  `{ "owner": "salmanrrana" }` behind hosted authentication.
- Songs use revision-checked PUT/DELETE, owner fixed server-side, soft deletion,
  a durable browser pending-write journal, and conflict handling. Preserve all.
- Manual timing survives analysis changes. Automatic timing has version and
  sequence identity and a section end time. Do not weaken the current refusal
  rules to make a new analyzer appear more successful.
- Preserve the shared video/audio clock, blocked/silent iframe fallback, seek
  rounding tolerance, ready/playing/finished states, one active lyric occurrence,
  sheet-lyrics recovery, and exact-video audio fallback.
- The current browser analyzer supports major/minor triads, not extended harmony.
  `chordEngine.ts` also approximates several unsupported shapes. A parsed symbol,
  pitch-class recognition, and a suggested playable shape are separate facts.

### Read-only comparison with main

The locally available `origin/main` is
`ad9fe0cbd665031c8cda0e69bcff8aa82c44f728`, titled “Redesign the song player around a
chord runway and stop double-counting held chords”. This is a local reference,
not a claim that the remote was freshly fetched. Comparison used `git diff HEAD
origin/main`; no merge or checkout was performed.

Main has `ChordRunway.tsx`, split `SongVideo` / `SongTransport`, a player rail/bar,
`chordRuns`, and lyrics rows with separate newly struck versus held chords. This
checkout has owner access, Postgres/revision semantics, improved alignment
refusal/section ends, and fractional-seek fixes that main lacks. Do not copy main's
whole player, songbook, router, package lock, or server over this branch. Keep new
analysis adapters independent of player layout. If root later integrates the
runway, preserve holds without merging across actual no-chord gaps, and retain
this branch's timing/security fixes. A main merge is outside the present work.

## 3. Workspace and file ownership

Use two crates. Root workspace uses Cargo resolver `2`, edition `2021`, and a
pinned stable toolchain selected and verified by the builders; record the exact
version in `rust-toolchain.toml`. Do not invent a minimum version without building.
Commit-ready `Cargo.lock` is required, but committing is not authorized here.

```text
Cargo.toml                         workspace, common dependency declarations [A]
Cargo.lock                         resolved once manifests stabilize [B]
rust-toolchain.toml                 verified compiler + rustfmt/clippy [A]
crates/
  fretbloom-analysis/               pure deterministic DSP + wire result types [A]
    Cargo.toml
    src/lib.rs                     public exports, analyze orchestration
    src/types.rs                   settings, result, feature, error types
    src/spectrum.rs                Hann FFT, peaks, noise/flatness, chroma
    src/pitch.rs                   monophonic F0, harmonic/octave checks
    src/polyphony.rs                sparse harmonic fitting, note evidence
    src/chords.rs                   vocabulary, scores, ambiguity, bass
    src/segments.rs                 onset/offset and temporal smoothing
    src/naming.rs                   pitch/chord spelling, no fingering lookup
    src/bin/analyze-pcm.rs          deterministic raw-PCM validation entry
    tests/                         focused DSP/type/serialization unit tests
  fretbloom-backend/                bounded private media service [B]
    Cargo.toml
    src/main.rs                    environment, listener, shutdown
    src/lib.rs                     router and testable service construction
    src/config.rs                  validated limits and executable paths
    src/api.rs                     jobs, uploads, status, result, media routes
    src/jobs.rs                    admission, state machine, leases, expiry
    src/media.rs                   probe/decode/hash, canonical playback WAV
    src/youtube.rs                 yt-dlp metadata/download orchestration
    src/process.rs                 bounded output, process-group cancellation
    src/error.rs                   safe HTTP error mapping
    tests/                         service/process/limit tests with local inputs
server/analysisApi.ts               authenticated gateway proxy [B]
server/analysisApi.test.ts          proxy/security tests [B]
server/index.ts                     mount proxy after existing access gate [B]
vite.config.ts                     development/preview proxy integration [B]
src/audio/analysisV1.ts             TS wire types + runtime validators [C]
src/audio/analysisClient.ts         create/upload/poll/cancel/results client [C]
src/audio/analysisAdapter.ts        Rust -> existing alignment/player shapes [C]
src/components/AudioAnalysisPanel.tsx upload/YouTube status and estimates [C]
scripts/start-local.mjs             local two-process lifecycle [C]
scripts/start-production.mjs        Node + Rust supervisor, signal forwarding [C]
Dockerfile                         multi-stage build and non-root runtime [C]
```

A = core builder; B = backend builder; C = frontend/packaging builder. Additional
ownership is explicit in section 13. No generated test inputs or expected answers
may be written under the validation agent's directories by these builders.

Dependencies: core `serde` (derive), `serde_json`, `thiserror`, `rustfft`; `clap`
only for its PCM CLI. Backend `axum`, `tokio`, `tokio-util` (cancellation), `serde`,
`serde_json`, `tempfile`, `uuid` (v4), `sha2`, `thiserror`, `tracing`, and
`tracing-subscriber`, plus core. Use `std::process`/Tokio process groups on supported
Linux/macOS; a small maintained Unix signal helper is allowed if required. Do not
hand-roll FFT or codec libraries. No C ABI, native Node addon, or WASM build is
needed. Freeze manifests before other builders use `--locked`.

## 4. Public Rust contract

These names/signatures are the interface, not implementation pseudonyms. All
wire structs/enums derive `Serialize, Deserialize`; field names serialize as
camelCase, enum values as the lower-case/snake-case strings in section 5. IDs
and time fields must be validated, not trusted merely because they deserialize.
Owned results contain no process handles or paths.

```rust
// fretbloom_analysis, re-exported from lib.rs
pub const SAMPLE_RATE_HZ: u32 = 24_000;
pub const ENGINE_VERSION: &str = "rust-dsp-1";

pub enum AnalysisMode { Auto, Monophonic, Polyphonic }
pub enum Spelling { Sharps, Flats }
pub struct AnalysisOptions {
    pub mode: AnalysisMode,
    pub concert_a_hz: f64, // 432..446; default 440
    pub spelling: Spelling,
}
impl Default for AnalysisOptions { /* auto, 440, sharps */ }

pub struct AnalysisProgress {
    pub processed_samples: u64,
    pub total_samples: u64,
}
pub enum AnalysisError {
    InvalidInput(String), Cancelled, LimitExceeded(String),
}
pub struct AnalysisOutput {
    pub result: AnalysisResult,
    pub features: AlignmentFeatures,
}

pub fn analyze(
    mono: &[f32],
    sample_rate_hz: u32,
    options: &AnalysisOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
    progress: &mut dyn FnMut(AnalysisProgress),
) -> Result<AnalysisOutput, AnalysisError>;

pub fn chord_vocabulary() -> &'static [ChordTemplate];
pub fn pitch_name(midi: u8, spelling: Spelling) -> String;
pub fn chord_label(chord: &ChordIdentity, spelling: Spelling) -> String;

// Types below mirror section 5 field-for-field.
// AnalysisResult excludes source/job metadata; ResultEnvelope adds that in backend.
pub struct ChordTemplate {
    pub quality: ChordQuality,
    pub intervals: &'static [u8], // this static vocabulary type is not deserialized
}
pub struct ChordIdentity {
    pub root_pc: u8,
    pub quality: ChordQuality,
    pub bass_pc: Option<u8>,
}
```

`analyze` accepts only finite mono samples at exactly 24 kHz, length 1..14,400,000.
No normalization that turns silence into sound. Reject out-of-domain rate, invalid
options, or non-finite samples with a typed error; clamp only finite clipping
samples for spectral processing and emit a warning. Core owns no I/O or threads;
backend uses one blocking analysis worker and a cancellation token checked at
least each 20 ms hop and each fitting/smoothing pass. Frames near either end are
zero padded; timestamps remain on the original, untrimmed media timeline.

Backend interface for tests and composition:

```rust
pub fn router(state: std::sync::Arc<AppState>) -> axum::Router;
pub async fn run(config: Config, shutdown: tokio_util::sync::CancellationToken)
    -> Result<(), BackendError>;

pub async fn decode_media(
    source: &std::path::Path,
    work_dir: &std::path::Path,
    config: &Config,
    cancel: &tokio_util::sync::CancellationToken,
) -> Result<DecodedMedia, BackendError>;
// DecodedMedia: mono Vec<f32>, sample_rate_hz u32, duration f64,
// playback_wav PathBuf, pcm_sha256 String, warnings Vec<AnalysisWarning>.

pub async fn acquire_youtube(
    video_id: &str,
    work_dir: &std::path::Path,
    config: &Config,
    cancel: &tokio_util::sync::CancellationToken,
) -> Result<AcquiredMedia, BackendError>;
// AcquiredMedia: source_path PathBuf, title Option<String>, duration_hint Option<f64>.
```

The core CLI contract is:

```sh
cargo run --locked --release -p fretbloom-analysis --bin analyze-pcm -- \
  --input /absolute/input.f32le --sample-rate 24000 \
  --mode auto --concert-a-hz 440 --spelling sharps --output /absolute/output.json
```

Input is raw mono little-endian float32. Output is one `AnalysisOutput`, with
`result` and `features` matching below; diagnostics go to stderr. Exit 0 means
success, 2 invalid input, 3 processing/limit failure, 130 cancellation. Reject a
byte length not divisible by four. SIGINT exits promptly without publishing a
partial JSON output. This gives the independent evaluator a stable interface
without importing private implementation modules or accessing YouTube.

## 5. Wire schema and frontend contract

API prefix is `/api/analysis/v1`. JSON is UTF-8, finite numbers only. Seconds are
relative to the first decoded audio sample, not wall time, frames or beats. Spans
are half-open `[start,end)`, with `0 <= start < end <= duration`. Empty result
arrays are valid; a successful silent recording is not an error. Internal routes
use the same suffix after `/v1` on loopback port 5210. Node is the only public
listener. Configure `FRETBLOOM_ANALYSIS_ORIGIN=http://127.0.0.1:5210`; refuse a
non-loopback origin/listener in this design. Do not pass Basic credentials to Rust.

The following TypeScript is the normative JSON shape. Rust uses equivalent
enums/structs (tagged unions for `kind`/`status`) and maps `u8` pitch classes to
0..11. Optional fields below are intentionally optional; nullable fields are
present with `null`. Frontend validators accept unknown extra object fields but
reject wrong types, invalid intervals, unknown schema versions, or excessive
arrays. No `any`, unchecked `as AnalysisResult`, or numeric coercion.

```ts
type AnalysisMode = 'auto' | 'monophonic' | 'polyphonic'
type Spelling = 'sharps' | 'flats'
type AnalysisOptions = {
  mode: AnalysisMode
  concertAHz: number
  spelling: Spelling
}
type Source =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'upload'; name: string; byteLength: number; contentType: string }
type CreateJob = { source: Source; options?: Partial<AnalysisOptions> }
type ApiError = {
  code: string // closed server codes listed below; client also handles future codes
  message: string
  retryable: boolean
}
type Job = {
  schemaVersion: 1
  id: string // UUIDv4, opaque, not a filesystem path
  source: Source
  options: AnalysisOptions // expanded defaults
  createdAt: string // UTC ISO8601
  expiresAt: string // retention deadline, not guaranteed processing finish
  status: 'awaiting_upload' | 'queued' | 'fetching' | 'decoding' | 'analyzing'
    | 'succeeded' | 'failed' | 'canceled'
  progress: { stage: string; fraction: number | null } // stage-local 0..1
  error: ApiError | null
}
type ChordQuality =
  | 'maj' | 'min' | 'dom7' | 'maj7' | 'min7'
  | 'sus2' | 'sus4' | 'add9' | 'madd9' | 'add11' | 'madd11'
  | '6' | 'm6' | 'dim' | 'dim7' | 'hdim7' | 'aug' | '5'
type Evidence = {
  score: number // 0..1 fit/support; NEVER probability
  margin: number // 0..1 winner minus strongest musically distinct competitor
  level: 'low' | 'medium' | 'high' // deterministic gates, not calibrated bins
}
type ChordIdentity = { rootPc: number; quality: ChordQuality; bassPc: number | null }
type ChordCandidate = {
  chord: ChordIdentity
  label: string
  evidence: Evidence
  supportedPitchClasses: number[]
  missingPitchClasses: number[]
}
type BassEstimate = {
  midi: number
  pitchClass: number
  evidence: Evidence
} // nullable below; does not assert instrument/string/fret

type HarmonyEvent = {
  start: number; end: number
  bass: BassEstimate | null
} & (
  | { kind: 'chord'; primary: ChordCandidate; alternatives: ChordCandidate[] }
  | { kind: 'no_chord'; reason: 'silence' | 'unpitched' | 'single_note' }
  | { kind: 'unknown'; reason: 'ambiguous' | 'insufficient_evidence';
      alternatives: ChordCandidate[] }
)
type NoteEvent = {
  start: number; end: number; midi: number; name: string
  cents: number // residual cents relative to options.concertAHz, -50..50
  evidence: Evidence
}
type AnalysisWarning = {
  code: 'clipping' | 'low_signal' | 'dense_polyphony' | 'tuning_uncertain'
    | 'channel_cancellation' | 'limited_bandwidth'
  message: string
}
type AnalysisResult = {
  schemaVersion: 1
  engineVersion: string
  options: AnalysisOptions
  duration: number
  sampleRateHz: 24000
  timingResolutionSeconds: number // 0.02; precision, not accuracy guarantee
  tuning: { referenceHz: number; estimatedOffsetCents: number | null }
  harmony: HarmonyEvent[]
  monophonicNotes: NoteEvent[]
  polyphonicNotes: NoteEvent[] // overlapping pitches; tentative, separately scored
  warnings: AnalysisWarning[]
}
type ResultEnvelope = {
  schemaVersion: 1
  jobId: string
  source: Source
  title: string | null
  pcmSha256: string // hash of canonical f32le PCM after decode
  analysis: AnalysisResult
}
type AlignmentFeatures = {
  schemaVersion: 1
  engineVersion: string
  duration: number
  hopSeconds: number // 0.08, downsampled from internal 0.02s hop
  frames: Array<{
    time: number // center of first cell is .04, final center clipped to duration
    chroma: number[] // exactly 12 finite nonnegative bins, C..B, L2 normalized
    midi: number | null // monophonic estimate only
    rms: number // original-amplitude RMS, no peak normalization
  }>
}
```

Harmony covers the entire recording without overlap or uncovered gaps, including
unknown/no-chord spans. Notes need not cover it. In `auto`, emit the monophonic
stream on confidently single-voice spans and the polyphonic stream on supported
multi-voice spans; avoid duplicate notes across the streams. `monophonic` disables
the polyphonic output but still refuses ambiguous multi-voice note estimates;
`polyphonic` uses fitted notes (including supported singleton fits) and leaves the
monophonic stream empty. All modes still produce harmony/no-chord/unknown events. At most three alternatives;
exclude a duplicate primary, include musically equivalent candidates where
relevant. No confidence percentages in the UI. “Strong evidence”, “uncertain”,
and “could also be …” refer to fit and separation, with the score available in
expanded details and an explicit “not a probability” label.

Endpoints and responses:

| Method/path after prefix | Contract |
| --- | --- |
| `GET /capabilities` | 200 `{schemaVersion:1, engineVersion, modes:[...], qualities:[...], limits:{maxSourceBytes,maxDurationSeconds}, uploads:true, youtube:true}`; availability is not a promise that YouTube will permit acquisition |
| `POST /jobs` | JSON <=16 KiB; 202 full `Job`, `Location` header; upload -> awaiting_upload, YouTube -> queued |
| `PUT /jobs/:id/media` | Raw binary body, only for awaiting_upload; octet-stream permitted; count bytes while streaming; 202 updated `Job` after complete write; no multipart/base64 |
| `GET /jobs/:id` | 200 `Job`; renew processing lease while nonterminal |
| `DELETE /jobs/:id` | 202 canceled `Job`; idempotent for canceled jobs; also removes a completed job's temporary artifacts |
| `GET /jobs/:id/result` | 200 `ResultEnvelope` only after success |
| `GET /jobs/:id/features` | 200 `AlignmentFeatures`, transient alignment evidence |
| `GET /jobs/:id/audio` | Canonical mono 24 kHz PCM16 WAV, `audio/wav`; same decoded timeline as analysis; support HEAD and single byte Range (206/416) |

All API/job/media responses use `Cache-Control: private, no-store` and `nosniff`.
Job endpoints require the same owner gate as songs. Nonterminal result/features/
audio -> 409 `NOT_READY`; failed/canceled results -> 409 `JOB_FAILED`/
`JOB_CANCELED`; missing/expired jobs -> 404 `JOB_NOT_FOUND`. Error envelope is
`{error: ApiError}`. Other codes/statuses: 400 `INVALID_REQUEST`, 413
`SOURCE_TOO_LARGE`/`RESULT_TOO_COMPLEX`, 415 `UNSUPPORTED_MEDIA`, 422
`DURATION_LIMIT`/`DECODE_FAILED`/`YOUTUBE_UNAVAILABLE`, 429 `RATE_LIMITED` or
`QUEUE_FULL` with `Retry-After`, 503 `BACKEND_UNAVAILABLE`/`TOOL_UNAVAILABLE`, 504
`PROCESSING_TIMEOUT`. No subprocess stderr, local path, signed URL, or credential
may appear in public errors. A failed async job carries the same structured error
in `Job.error`; status polling itself still returns 200.

Concrete chord event (all note names are display aids, pitch classes are truth):

```json
{
  "start": 1.2, "end": 2.8, "kind": "chord",
  "bass": {"midi": 52, "pitchClass": 4,
    "evidence": {"score": 0.82, "margin": 0.21, "level": "medium"}},
  "primary": {
    "chord": {"rootPc": 0, "quality": "dom7", "bassPc": 4},
    "label": "C7/E",
    "evidence": {"score": 0.81, "margin": 0.18, "level": "medium"},
    "supportedPitchClasses": [0, 4, 7, 10], "missingPitchClasses": []
  },
  "alternatives": []
}
```

These example scores illustrate serialization only, not measured accuracy.

## 6. DSP that builders can implement now

Use fixed, inspectable algorithms and measured thresholds. These starting
parameters are engineering defaults, not established accuracy claims. Keep them
in one core configuration/constants location; changing them bumps engine version.

1. **Preprocessing and timing.** Decode once to mono 24 kHz f32. Retain original
   amplitude for RMS/silence; remove DC for spectral work. Analyze 4096-sample
   Hann windows every 480 samples (20 ms). Use an additional 8192-sample spectrum
   every 80 ms for low bass resolution. Center windows at analysis times; refine
   boundaries using short-window energy/spectral flux rather than assigning the
   whole FFT window's delay to a note. Never trim initial silence.
2. **Silence and noise.** Combine absolute RMS floor (initially -65 dBFS), an
   adaptive noise estimate, spectral flatness, and tonal peak evidence. Record
   the applied thresholds in engine configuration. Relative normalization alone
   must not turn low-level room noise into a chord. A tonal lone note is
   `no_chord/single_note`, broadband sound `no_chord/unpitched`, and a tonal mix
   that cannot be resolved is `unknown`, not silence.
3. **Monophonic notes.** Use YIN-style difference/periodicity (FFT acceleration
   permitted with RustFFT), parabolic lag refinement, and harmonic spectral
   corroboration over MIDI 28..96. Compare octave/subharmonic candidates before
   selecting a fundamental. A weak fundamental is not automatically an octave
   error. `auto` emits a monophonic note only when the spectral residual does not
   support a second independent pitch. A user's `monophonic` hint does not exempt
   a recording from the polyphony/ambiguity checks. Export cent residuals and
   suppress unstable or noise-driven candidates.
4. **Polyphonic notes.** Extract whitened local peaks. Fit a nonnegative sparse
   mixture of harmonic combs for candidate MIDI 28..96, using up to eight
   harmonics below Nyquist with decaying weights and narrow detuning tolerance.
   Greedily add the candidate with greatest residual improvement, refit active
   amplitudes (bounded coordinate descent, e.g. 20 iterations), stop when
   improvement is insufficient or six pitches are active. Penalize octave
   duplicates supported only by another pitch's partials. Strong residual energy
   after six candidates yields a dense-polyphony warning, not a claim that all
   notes were found. Aggregate sparse pitch evidence into chroma; do not derive
   every reported note merely from the selected chord template.
5. **Tuning.** Estimate a global offset within +/-50 cents using the circular
   distribution of stable tonal peaks across up to the first 30 seconds. If
   evidence is scattered, use zero internally, return null offset and a warning.
   A4 reference remains the selected 432..446 Hz. Output cents use that reference;
   the global offset is a diagnostic, not an additional transposition applied to
   MIDI. Re-estimate spectral comb positions using the offset, with local
   tolerance for differently detuned strings. Do not promise bend transcription.
6. **Chord evidence.** Score all roots of the vocabulary below from note/chroma
   support. Start with `clamp(mean(required tone support) - 0.35 * outside-energy
   fraction - 0.25 * missing-required-tone fraction, 0, 1)`; normalize support
   against local tonal evidence, not a flat-chroma cosine score alone. Require
   evidence for characteristic thirds/sevenths/suspensions/additions. Penalize
   extensions whose defining tone is unsupported so larger templates do not win
   by covering more noise. A missing fifth may be tolerated with a score penalty;
   an inaudible seventh never becomes a verified seventh. Compare a richer chord
   with its simpler parent and pitch-class-equivalent competitors explicitly.
7. **Bass and inversion.** Estimate the lowest independently supported note with
   the longer spectrum, harmonic fit, and persistence (initially >=100 ms).
   Do not use the lowest nonzero FFT bin or assume the template root is the bass.
   Publish bass only above its own support/margin gate. Use slash naming when a
   confident non-root bass persists under a resolved chord; it may be a chord
   tone inversion or an external pedal tone. Uncertain bass leaves `bassPc:null`,
   rather than fabricating root position.
8. **Time smoothing.** Start with score/margin gating, 3-frame median smoothing,
   and hysteresis: require roughly 100 ms of supported chord evidence, allow
   onset flux to shorten change confirmation to 60 ms, and never bridge a silence
   or unknown gap merely to make a continuous chord. Notes require 60 ms stable
   evidence; reattacks can split same-pitch notes if onset evidence warrants it.
   Keep bass changes distinct even when the harmonic root/quality stays fixed.
   Refine onset/offset against energy and pitch evidence. If dynamic programming
   is needed, retain only candidate/state scores, not an unbounded full spectrum
   history. Avoid an all-pairs transition matrix for every chord/bass voicing.
9. **Uncertainty.** Initial primary gates: score >=0.65 and margin >=0.12;
   high evidence additionally needs score >=0.85 and margin >=0.20. These are
   tunable on the development set only. If the top competing explanations remain
   equivalent or too close, emit `unknown/ambiguous` with alternatives. Never
   upgrade a score because the pasted sheet suggests an answer. Bass and note
   thresholds are tuned separately, not inherited from chord scores.
10. **Alignment projection.** Pool evidence over fixed 80 ms cells for the
    existing TS aligner. Normalize chroma with L2 norm; keep all-zero silence.
    Supply single-note MIDI only for unambiguous monophonic cells. Round JSON
    feature values to six decimals to bound size. Preserve frame timing relative
    to original audio and compare alignment results on independent fixtures.

This is a concrete baseline, not a guarantee that harmonic fitting will reach
all acceptance targets. If extended-chord or bass metrics fail, improve spectral
weighting, note evidence, or segmentation within this scope; report remaining
failures. Do not replace the detector with fixtures, hard-coded song sequences,
reference-sheet labels, or a major/minor fallback labeled “full analysis”.

### Chord and note vocabulary

C=0, C#/Db=1, …, B=11. MIDI 60 is C4. Use equal temperament for numeric mapping.
`pitch_name` includes octave, with octave `floor(midi/12)-1`. Sharps spelling is
C,C#,D,D#,E,F,F#,G,G#,A,A#,B; flats is C,Db,D,Eb,E,F,Gb,G,Ab,A,Bb,B. There is no
inferred key signature in v1. Preserve user sheet spelling independently. Compare
notes/harmony by pitch class and quality, not display strings.

| Quality | Required pitch-class intervals from root | Label at C |
| --- | --- | --- |
| maj / min | 0,4,7 / 0,3,7 | C / Cm |
| dom7 / maj7 / min7 | 0,4,7,10 / 0,4,7,11 / 0,3,7,10 | C7 / Cmaj7 / Cm7 |
| sus2 / sus4 | 0,2,7 / 0,5,7 | Csus2 / Csus4 |
| add9 / madd9 | 0,2,4,7 / 0,2,3,7 | Cadd9 / Cmadd9 |
| add11 / madd11 | 0,4,5,7 / 0,3,5,7 | Cadd11 / Cmadd11 |
| 6 / m6 | 0,4,7,9 / 0,3,7,9 | C6 / Cm6 |
| dim / dim7 / hdim7 | 0,3,6 / 0,3,6,9 / 0,3,6,10 | Cdim / Cdim7 / Cm7b5 |
| aug / 5 | 0,4,8 / 0,7 | Caug / C5 |

This covers specific added-note families, not every possible jazz extension.
`add2` and `add9` collapse to `add9` because chroma cannot establish the octave of
the added tone; disclose that convention. `sus2` retains no third, `add9` requires
one. Other extensions remain unknown or explicit alternatives, not silently
accepted as a different requested quality. Double accidentals and theoretical
spellings such as B# are outside generated labels, but existing pasted text is
never rewritten.

C6 and Am7 share pitch classes; Csus2 and Gsus4 can too. Diminished sevenths and
augmented chords have symmetric root ambiguity. Bass/context may help rank these
but does not prove a composer's intended name. Keep equivalent alternatives and
low margin; return unknown when there is no defensible primary. A slash bass
field always describes an observation; no bass field means unknown, not “root
position”. Do not claim exact voicing register from chroma or exact fingering
from any result. A suggested shape must be labeled **Suggested fingering** and
must not replace a detected label with the shape engine's approximation.

## 7. Media flows and limits

### Upload

React lets the owner choose a file and clearly says it is sent to the server for
analysis (unlike the microphone tuner). Create an upload job with safe display
name, byte length and claimed MIME; get its ID; PUT the raw File with AbortSignal;
poll status; fetch result and features; align any pasted sheet; fetch canonical
WAV for playback. Keep filenames display-only (max 200 characters, strip controls).
Rust makes its own private directory and source filename. Never trust extension
or MIME to choose a decoder.

Accept FFmpeg-decodable single-file WAV, MP3, FLAC, Ogg, M4A/MP4, and WebM audio
inputs. Containers may contain video, which is ignored; choose the first audio
stream explicitly and reject files with none. Do not accept network playlists,
concat scripts, arbitrary input URLs, or filesystem references. Probe and decode
with an explicit demuxer allowlist appropriate to these containers and protocol
whitelist `file,pipe`; protocol restrictions alone do not prevent a local-file
playlist from reading other files. Run inside the job directory with only the
random server-generated path as input. Do not pass user codec/filter arguments.

### YouTube

Create a YouTube job using an 11-character `[A-Za-z0-9_-]{11}` ID, not a URL for
Rust to fetch. Construct the fixed HTTPS watch URL server-side. Reuse the existing
policy from `server/youtube.ts`: `--ignore-config`, no cookies or browser cookies,
no playlist, pinned yt-dlp, fixed `bestaudio/best`, metadata first, HLS-format retry
only when metadata permits, safe output directory, bounded capture and deadline.
Invoke yt-dlp and FFmpeg directly with argument arrays, never via a shell. Copy
and test the existing command policy, not the entirety of unrelated Node routes.
Pass a configured Node executable for yt-dlp's JS runtime as current code does.

Validate metadata duration and reject live streams. Monitor actual downloaded
bytes, including fragments and partial files, rather than relying only on
`--max-filesize` or advertised duration. Decode native downloaded audio directly
to 24 kHz; the old 12 kHz WAV is not the new analysis input. Label existing 12 kHz
inputs with limited-bandwidth warning if detected; never pretend upsampling
restores missing harmonics.

Return a clear unavailable error for bot challenges, private/deleted/restricted
videos and failed retries. No cookies, proxy rotation, access-block bypass, or
claim that local success implies cloud success. Captions/LRCLIB remain separate
Node requests and their failure must not erase a successful audio analysis.

### Hard limits (defaults; validate environment overrides against hard maxima)

| Resource | Bound and behavior |
| --- | --- |
| Encoded source | 50 MiB, counted during upload/download; early rejection from Content-Length plus streaming enforcement |
| Duration | 600 s from actual decoded sample count; do not silently truncate and report success |
| Probe | 10 s wall time, bounded output; decoder metadata is only a hint |
| Decode | 45 s wall time, one codec/filter thread, output capped at 14,400,001 mono samples |
| PCM | 24 kHz f32, at most 57.6 MB (decimal); keep one analysis buffer, no full spectrogram |
| Playback | PCM16 mono 24 kHz WAV, <=28.81 MB plus small header; derive from the same decoded PCM |
| New Rust jobs | one running acquisition/decode/analysis pipeline, two pending/reserved jobs; reject fourth with 429; upload reservations expire |
| Upload | 120 s total, 15 s without incoming data; mismatched declared/actual length fails |
| YouTube acquisition | 150 s including the permitted fallback attempt |
| Analysis CPU wall deadline | 120 s; total active-job deadline 300 s, counting acquisition/decode/analysis, not queue time |
| Queue wait | 60 s; fail clearly instead of holding indefinitely |
| Job lease | awaiting-upload expires after 60 s unless PUT starts; nonterminal job must be polled at least every 60 s, or cancel abandoned work |
| Process output | 2 MiB per captured stdout/stderr; kill runaway producers, redact diagnostics |
| Temp disk | 256 MiB per job, 512 MiB service total including retained artifacts; reserve space/admission, reject rather than exceed |
| Result/features JSON | 1 MiB result envelope, 8 MiB features, at most 7,500 feature frames; never truncate successful results silently |
| Event cardinality | at most 4,000 notes in each note array, 3,000 harmony events, 3 alternatives/event; byte-size cap still applies |
| Retention | completed artifacts 30 min maximum, at most 10 completed job records; evict oldest terminal artifacts to meet disk budget; never evict active work |
| Gateway admission | 10 job creations/minute/client (bounded 4,096-address map); status polling 120/minute/client; preserve existing auth limit |

Existing legacy YouTube route limits remain two concurrent processes and 150 s.
They are separate from the new single Rust pipeline: capacity planning must count
up to two legacy media operations plus one Rust operation. Do not claim a shared
global semaphore when there is none. Start with one container replica, 1 GiB
container memory and one Rust CPU worker; verify measured peak usage under legacy
and new traffic. Reduce legacy concurrency to one via existing middleware options
in resource-constrained local configurations if tests show contention; do not
silently change the public response contract. No automatic horizontal scaling.

For FFmpeg, use `-nostdin -hide_banner -loglevel error`, explicit audio mapping,
`-vn -sn -dn`, one decoding/filter thread, and explicit sample format/rate. Decode
up to 600 s plus at least one sample; seeing that extra sample means rejection,
not a successful cropped song. Count stdout bytes independently of the `-t`
argument. Reject corrupt/truncated decoding when FFmpeg exits unsuccessfully.
Canonical timeline starts at zero, retains leading silence, and accounts for
codec priming as FFmpeg decodes it. Do not mix timestamps from a separately
transcoded playback file without verifying offset and length.

Downmix is the mean of channels; for opposite-phase cancellation, compare channel
versus downmixed energy on bounded probe windows. If cancellation is substantial,
choose the stronger channel consistently and emit `channel_cancellation` instead
of analyzing silence. Reject excessive channel counts (>8), sample rates (>192
kHz), and malformed headers early, while keeping output/time limits authoritative.
FFmpeg thread/output limits are not a complete memory sandbox; container memory
limits are the final backstop and corrupt-media tests must measure this risk.

On cancellation, signal the job token, terminate the whole subprocess group,
wait up to 2 s, then kill and reap. Check cancellation before publishing any
result; a late worker must not transition canceled -> succeeded. Canceling a
queued job removes it immediately. An upload disconnect cancels its job; polling
or media-read disconnect alone does not (another request may still need it).
React explicitly DELETEs its known job on abort/source replacement, with a fresh
short-lived signal; if the create response was lost, the lease cleans it up.

On graceful shutdown stop admission, cancel work, reap children, and remove temp
artifacts. On restart remove only service-owned stale job directories under the
configured temp root, never arbitrary system temp files. In-memory jobs/results
are intentionally not restart durable; clients handle 404 by offering retry.

## 8. Node compatibility and security boundary

Mount `createAnalysisMiddleware` after owner access and before static fallback in
`server/index.ts`; export a Node middleware compatible with existing middleware
shape. In Vite, mount the same proxy after local session. Proxy only the fixed
analysis route set to the fixed loopback Rust origin; stream body/backpressure,
limit bytes, forward safe content/Range headers, strip Authorization and all
client-supplied forwarding headers, and forward cancellation appropriately.
Do not turn this into an arbitrary URL proxy. Treat a missing backend as a JSON
503, never SPA HTML or a fake successful capability response.

The private Rust listener has no public port and no database credentials. It
trusts the single-host Node gateway, so access to local machine processes is
outside this single-owner boundary. Supporting a separately hosted Rust service
would require an authenticated private transport; it is not configured here.
Supervision must pass an allowlisted environment to Rust/subprocesses rather than
inheriting `DATABASE_URL` or `FRETBLOOM_ACCESS_PASSWORD`. Media subprocesses get
only needed PATH/tool/runtime/temp settings, never owner or database secrets.

Backward compatibility is additive:

| Existing route | Required behavior |
| --- | --- |
| `/health` | Existing 200 `ok` liveness remains; add separate protected analysis capabilities/readiness for dependency status |
| `/api/session`, `/api/songs`, `/api/songs/:id` | Same auth, payload/revision/delete behavior; new analysis data is optional JSON inside songs |
| `/api/youtube-audio/:videoId` | Same bounded 12 kHz mono WAV and `X-Video-Title`, old error envelope, no automatic analysis; retain for old clients |
| Existing captions/lyrics paths | Same implementations, matching and source labels; no Rust rewrite |
| Static routes/tuner/Listen | Same public paths; no Rust requirement for microphone tuning |

Older clients remain usable during rollout. New clients query capabilities and
use Rust for the explicit full-analysis flow. A static or older backend may offer
**Use limited browser analysis** only as a visible user choice. No fallback after
an actual Rust decode/analysis failure that conceals the failure.

## 9. React, alignment and playback

Expose these frontend entry points from `analysisClient.ts`:

```ts
type ClientOptions = {
  signal: AbortSignal
  onStatus: (job: Job) => void
}
export async function analyzeUploadedAudio(
  file: File, options: AnalysisOptions, client: ClientOptions,
): Promise<{ result: ResultEnvelope; features: AlignmentFeatures; audio: Blob }>
export async function analyzeYouTubeAudio(
  videoId: string, options: AnalysisOptions, client: ClientOptions,
): Promise<{ result: ResultEnvelope; features: AlignmentFeatures; audio: Blob }>
```

Poll every two seconds, back off on transient network failure/429, stop at a
terminal state, and keep a finite client deadline (420 s including queue/upload).
Display real stages; only show percentages when stage progress is measurable.
Do not call the old `analyzeSongFile` in these functions. Keep at most two audio
blobs in memory; revoke object URLs on replacement/unmount and never persist them.
The legacy 16 MiB client WAV cap remains for the old route only; the new canonical
WAV needs a 30 MiB cap. Missing/expired audio offers reacquisition or reattachment.

`analysisAdapter.ts` converts to existing `SongAnalysis` without changing that
interface globally:

- `frames`/`hopSeconds` from features; `notes` from `monophonicNotes` only.
- `chords` from harmony: resolved labels and evidence scores; unknown/no-chord
  map to legacy label `N` but retain the complete rich result for display.
- Validate identical duration/engine identity between result and features.
- Use existing `alignSong` with sounding pitches from the sheet; do not synthesize
  exact fingerings/notes from chord labels. Update its label-quality handling
  narrowly if it assumes only triads. Keep section bounds, transposition checks,
  and manual timing precedence. New features require regression validation, not
  blind reuse of confidence thresholds tuned for different spectral evidence.

There is a second correctness requirement: extended chords in pasted sheets may
currently obtain approximate shape-derived pitches (`stepMidiNotes`). Add a
small `src/data/chordIdentity.ts` parser for the supported vocabulary and bass,
used for recognition/alignment targets independently of shape generation. Keep
numbered tabs' explicit sounding MIDI notes and capo/tuning handling. For chord-only targets,
pass canonical MIDI representatives `60 + pitchClass` to the existing chroma-based
chord aligner, transposed for capo; these are comparison values, never reported
observed notes or fingerings. Include a slash pitch class in the target set, but
recognize that current chroma alignment cannot distinguish inversions sharing
that set. Validate proposed placements against rich bass/characteristic-tone
evidence before claiming extended-quality or slash alignment; otherwise explain
that only harmonic timing is supported, or refuse automatic placement when the
sheet needs an unresolved inversion change. Do not
replace a written Cdim with minor-triad targets just because the diagram library
has only a minor shape. Unsupported shapes may omit the diagram, with a clear
message, while preserving the correct symbol and pitch-class target. If a
suggested shape is shown, verify its tones and mark approximation explicitly.

Upload songs may have no YouTube ID and no pasted sheet. Give them the same
analysis timeline, optional pasted sheet/lyrics, audio playback, and manual timing
controls. Extend `useSongPlayback` with a discriminated source (YouTube or upload
blob) while retaining its `VideoClock` interface for consumers. Never create an
iframe for an upload or return early merely because `youtubeId` is null. Use the
canonical server WAV for initial upload playback, so unsupported browser codecs
still work. On reload require reattachment if the source audio is gone; do not
pretend stored event timestamps constitute playable media.

The panel must show separate harmony, monophonic melody, and tentative polyphonic
notes, including ambiguity and silence. Unknown spans must not leave the last
chord lit as “now”. User-selected suggested diagrams cannot be presented as the
observed fingering. A display simplification cannot silently discard seventh,
added-note, inversion, or bass evidence.

## 10. Storage without schema migration

Keep the existing Postgres `songs` table exactly:

```text
owner_id text, song_id text, data jsonb, saved_at bigint,
revision integer default 1, deleted boolean default false,
primary key (owner_id, song_id)
```

No Rust database access, new table, live migration, bulk rewrite, or persistence of
source audio. Existing initialization remains the only table-setup path; tests
use a disposable local database only. Do not change server-owned `owner_id`, the
revision preconditions (428 missing, 409 conflict), tombstones, or pending-journal
retry semantics.

Add optional fields inside `SavedSong` JSON:

```ts
// Defined by the frontend builder, not a SQL migration.
type SavedAudioAnalysis = {
  schemaVersion: 1
  source: Source
  pcmSha256: string
  analysis: AnalysisResult // no frame arrays or job IDs/temporary URLs
  sequenceKey: string
  alignment: {
    times: number[] | null
    endTime: number | null
    transpose: number
    reason: string | null
  }
}
// SavedSong.audioAnalysis?: SavedAudioAnalysis
// SavedSong.uploadSource?: { name: string; byteLength: number; pcmSha256: string }
```

Keep `youtubeId` and `videoAnalysis` readable for existing songs. For new YouTube
results write a legacy `videoAnalysis` projection as well as rich `audioAnalysis`
when the complete song stays below the existing 2 MiB limit; bump
`VIDEO_ANALYSIS_VERSION` from 3 to 4 for changed automatic analysis/alignment.
Do not change the meaning of its `version` to API schema version. New uploads use
`youtubeId:null`, rich analysis, and the existing timing fields. Prefer rich
analysis when its source/engine/options/sequence match; otherwise retain the
stale result as historical evidence but do not use its automatic map as current.
Old-client edits may discard unknown fields, so cross-version editing is not a
lossless compatibility guarantee; document this, and avoid forced automatic saves
merely because a result loaded.

Treat schema version, engine version, and alignment sequence version separately.
An engine/options change invalidates automatic maps, never manual maps. A change
to source identity invalidates all timing, including manual timing for the old
recording. A sheet-note/capo/order change invalidates its map; wording-only edits
follow the current sequence policy. Preserve revision counters and queued writes.

For a reattached upload, obtain/verify the decoded PCM hash and duration before
reusing timing. Same filename and byte length are insufficient. YouTube metadata
may change under the same ID: compare decoded hash when reacquiring audio and
invalidate mismatched timing rather than playing a new recording against an old
map. Decoder-version-dependent hash changes should trigger verification/reanalysis,
not a claim that the user altered the file. Job IDs, features, object URLs, audio
blobs, and credentials never enter stored song JSON.

Validate the final serialized song size before PUT. If full detailed analysis
would exceed 2 MiB, retain it in the current session, offer a JSON download, and
explain that detailed analysis was not saved; do not silently strip user lyrics,
steps, manual timing, or alternatives. Save ordinary editable song data through
the same existing explicit save flow. Do not increase the database API body limit
just to accommodate unbounded spectral data.

## 11. Local run, packaging, and hosting

These are commands the builders must make work; they have not been run as part of
this architecture task. Use the existing Node 24.22.2/npm lock rather than
switching package managers during the Rust integration. Development ports here
are dedicated to this checkout; never stop or replace the other checkout's 5173
server.

```sh
# One-time local setup, from this checkout only:
npm ci
npm run setup:youtube
# Install FFmpeg/ffprobe and the toolchain declared in rust-toolchain.toml.
cargo build --locked --release --workspace

# Explicit two-terminal mode:
FRETBLOOM_ANALYSIS_HOST=127.0.0.1 FRETBLOOM_ANALYSIS_PORT=5210 \
  YTDLP_PATH="$PWD/.tools/youtube/bin/yt-dlp" \
  target/release/fretbloom-backend
FRETBLOOM_ANALYSIS_ORIGIN=http://127.0.0.1:5210 \
  npm run dev -- --host 127.0.0.1 --port 5202 --strictPort

# Builder C adds this convenience command for the same two processes:
npm run dev:full

# Built local app, no database and no hosted credentials:
npm run build
NODE_ENV=development HOST=127.0.0.1 PORT=5202 npm run start:full
```

`npm run dev` remains a frontend/Vite command and does not silently launch Cargo.
`dev:full` builds/starts Rust and Vite with signal cleanup, refuses occupied ports,
and reports missing tools. `start:full` starts the release binary plus existing
Node server and waits for private Rust readiness before admitting new analysis
jobs. The production supervisor stops both when either exits unexpectedly and
forwards SIGINT/SIGTERM, killing remaining descendants after a bounded grace.
Keep `npm start` usable for the existing Node-only compatibility path, with new
analysis returning unavailable if Rust is absent.

Environment owned by the backend: `FRETBLOOM_ANALYSIS_HOST` (must be loopback),
`FRETBLOOM_ANALYSIS_PORT` (5210), `FRETBLOOM_ANALYSIS_TEMP_ROOT` (service-owned
system temp subdirectory), `YTDLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`, and
`NODE_PATH_FOR_YTDLP`. Limits are fixed safe defaults for v1; only expose explicit
validated lower limits if configuration is needed. Node alone reads existing
`HOST`, `PORT`, `NODE_ENV`, `DATABASE_URL`, and `FRETBLOOM_ACCESS_PASSWORD`.
Local shell commands must not print secrets or inherit production configuration
from another checkout. The supervisor must refuse incomplete hosted credentials
using the same existing startup rules.

Docker plan:

1. Rust builder stage uses the pinned toolchain and `cargo build --locked
   --release --workspace`.
2. Node builder uses `node:24.22.2-bookworm-slim`, `npm ci --ignore-scripts
   --engine-strict`, and builds `dist`; retain production Node dependencies.
3. Runtime is Debian Bookworm with Node 24.22.2, CA certificates, FFmpeg/ffprobe,
   Python venv and the existing pinned yt-dlp setup; copy Rust backend, built
   frontend, Node server and supervisor. Do not ship Cargo, tests, validation
   corpus, compiler caches, or local environment files.
4. Retain unprivileged `node` user, writable service temp root, and current secret
   exclusions in `.dockerignore`; add `target`, validation generated media,
   and results. Expose only Node's port. Rust binds 127.0.0.1 inside the container.
5. Default command invokes `start-production.mjs`. For local Docker verification
   use `NODE_ENV=development`, bind the container Node server to `0.0.0.0`, and
   publish only `127.0.0.1:5203:4173`; no database needed. A separate disposable
   Postgres verification may use dedicated test credentials without touching the
   existing service. Verify both processes, API and playback, not just a build.

Railway can build a Dockerfile and route to the application port. The proposed
single-service container runs Node + private Rust, preserving the existing
Postgres connection held by Node. Keep one replica and the existing password
requirement. Persist song JSON only; temporary audio can disappear on restart.
Railway checks the configured application port and expects a successful health
response; supervisor readiness must prevent a healthy-looking gateway hiding a
crashed Rust child. This is a plan, not an instruction to deploy or inspect live
infrastructure. Current plan limits/costs and YouTube cloud access have not been
reverified. See official [Railway deployment reference](https://docs.railway.com/deployments/reference)
and [health checks](https://docs.railway.com/deployments/healthchecks).

Netlify's existing `dist/` deployment remains a static frontend. It cannot run
these long-lived Rust/FFmpeg jobs merely because Cargo files are present. Keep
static build success and public tuner/Listen functionality; Songbook remains
locked without its authenticated `/api/session`, as it does today. Do not fake
owner access on static hosting. A future Netlify UI could proxy APIs to the Node
origin, but Basic auth, same-origin security, upload limits, and proxy timeout
behavior need separate validation. Do not weaken CORS/cross-site protection or
embed credentials to make that work. [Netlify proxy documentation](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
describes the transport possibility, not a verified deployment for this app.

## 12. Independent acceptance and unknowns

`docs/rust-validation.md` and `validation/audio/**` belong exclusively to the
independent evaluator. At design handoff, the evaluator has produced a 102-file
Karplus–Strong corpus, frozen input inventory, separate dev/holdout splits,
scorer, historical TypeScript baseline, and `rust_eval.py` adapter matching this
CLI. Read that report for measured baseline findings; this document makes no
claim that the unbuilt Rust code has passed it.

Builders use only development audio while tuning. Root freezes source, lockfile,
engine settings, binary hash, machine and tool versions before the independent
holdout run. Preserve raw Rust output alongside the adapter's predictions. Never
manufacture note sets from predicted chord identities, bass from root, or results
from filename/expected labels. Existing detector-extracted chroma fixtures are
regression checks, not independent audio-front-end accuracy evidence.

The prepared corpus includes plucked-string transients/decays, multiple harmonics,
staggered string attacks, varied voicings/capos, detuning and noise, silence,
percussion, weak tails, inversions, and overlapping transitions. It does not yet
cover every requested family, real guitar body/mic/room response, stereo,
distortion, alternate tuning, or full-band mixtures. Ask the evaluator/root for
additional independent coverage of `madd9`, `add11`, `madd11`, `dim7`, and `hdim7`,
plus multiple disjoint voicings/registers per family. A passing result on an
unrepresented class is impossible; mark it unvalidated until covered.

Freeze these proposed controlled-corpus gates before holdout, aligned with the
independent validation plan:

| Measure | Proposed acceptance target |
| --- | --- |
| Monophonic exact MIDI, including octave | >=95% early stable windows; >=90% sustained windows; report per note/register and octave errors |
| Polyphonic notes | >=85% MIDI note F1, precision and recall each >=80%; pitch-class-set exact >=85%; report exact MIDI-set accuracy separately (80% target) |
| Unambiguous harmony | root and quality each >=90%; compatible equivalent identity >=85%; no intended-quality group below 70% |
| Bass/inversions | bass pitch-class accuracy >=85%; report root+quality+bass joint accuracy separately; no root-as-bass substitution |
| Silence/noise/percussion | <=1% dedicated-negative false-positive frames; inspect silent-margin errors separately (<=10% starting target) |
| Transitions | boundary F1 >=85% within 180 ms; report matched error, missed changes and extra flicker, not recall alone |

These are goals on controlled test data, not percentage promises for songs. The
scorer's eligible windows and denominators are defined by the evaluator. Abstained
frames count as misses on unambiguous examples; do not improve accuracy by hiding
coverage. For inherently ambiguous identities, use the explicitly compatible set
or report unresolved alternatives. Per-quality counts and tiny sample sizes must
accompany aggregates. Similarity/evidence scores are not calibrated confidence;
probability calibration would require an independent representative labeled set
and separate reliability evaluation, which is not part of this first release.

Additional functional gates are required even if the score table passes:

- Every supported family appears in actual inference and round-trips through
  Rust JSON, TS validation, persisted song, timeline and display without reduction
  to a major/minor label. Enharmonics and uncertain bass do not change pitch truth.
- Both upload and an actually accessible public YouTube source reach completed
  analysis and audio playback; verify extraction separately from mocked API/UI
  tests. A network block is reported as such, not waived as extraction success.
  Fully offline upload tests must remain sufficient to develop the backend.
- Cancel during upload, download, decode, queued work and DSP; verify no late
  success, temp leak, unreaped child or stranded semaphore. Assert full-capacity
  rejection, restart/expiry behavior, length overruns, corrupt/unsupported media,
  subprocess timeouts, and streaming byte limits without loading huge fixtures.
- Test the private backend isn't publicly bound, every public new route requires
  owner auth when hosted, cross-site jobs fail, proxying cannot target arbitrary
  destinations, and unauthenticated uploads cannot consume substantial resources.
- Preserve all existing unit/type/lint tests, parser/diagram behavior, revision
  conflict/tombstone tests, and focused playback/songbook journeys. Verify one
  active lyric/chord, boundaries/finished state, manual timing, changed source,
  reattachment, stale automatic analysis, and source-switch cancellation.
- Run full backend WAV/upload decoding on selected independently generated
  fixtures in addition to the raw-PCM core CLI. Test mono/stereo/antiphase,
  24/32/44.1/48 kHz, compressed input duration offsets, leading/trailing silence,
  declared-versus-decoded duration, and unsupported-network playlist rejection.
- Record release-mode CPU time, peak RSS, temp disk, and elapsed wall time for
  30 s and 600 s inputs on a named machine. Initial target: 600 s analysis <=120 s
  and Rust-process peak RSS <=256 MiB; complete service/container within 1 GiB
  under the documented concurrency. Timeouts are hard behavior, these speed/RSS
  targets must be measured. If they fail, report exact measurements and correct
  processing/limits rather than claiming fast Rust implies adequate performance.
- A clean local build and non-root Docker run exercise the same API; static
  frontend build succeeds without Rust available. No production access needed.

For real audio, the evaluator should add redistributable human-played holdouts
when verified licenses and reliable labels are available. Preserve original
files/hashes, recording and annotation license separately, attribution, player,
instrument/tuning/capo, and independent timing/voice review. Split by performer,
recording/take, and instrument rather than taking nearby frames from one song.
[GuitarSet's project page](https://guitarset.weebly.com/) is a candidate source
with guitar recordings and note annotations; its performed-chord annotations
also use lead-sheet segmentation/root, so those are not fully independent chord
identity ground truth. Verify the actual audio/annotation license before copying;
the license printed on a paper alone is not sufficient. No real audio was
acquired by this design task. If none can be vetted, explicitly withhold real-world
accuracy claims and report that acceptance gap.

## 13. Launch three builders after contract handoff

All builders use this existing checkout and base SHA. No branches/worktrees,
commits, push, deployment, production/secret access, or delegates. Work can overlap
only after file ownership and initial manifests/types are agreed. Root integrates
and resolves cross-owner changes; builders request them instead of editing others'
files. The evaluator retains exclusive control of validation inputs and scoring.

### A — core music analysis

Own only `Cargo.toml`, `rust-toolchain.toml`, and `crates/fretbloom-analysis/**`.
Implement all public result/feature types, naming/vocabulary, DSP, segmentation,
progress/cancellation and the `analyze-pcm` CLI. Focus on genuine signal evidence
for extended chords and bass, not returning more labels from triad evidence.
Write focused unit tests inside this crate, use independent dev audio for
measurement, and leave the independent corpus untouched. Supply representative
serialized output to B/C and document any threshold changes in code/engine version.

First deliverable is compiling wire types + `analyze` signature + vocabulary +
CLI argument contract; then implement full inference. Do not mark a type-only or
triad-only backend complete. Finish with per-family development metrics, resource
measurements and honest unsupported/unknown cases. Use `cargo fmt`, core tests,
and clippy with warnings denied once manifests are frozen.

### B — backend and gateway

Own only `crates/fretbloom-backend/**`, `Cargo.lock`, `server/analysisApi.ts`,
`server/analysisApi.test.ts`, `server/index.ts`, `server/index.test.ts`, and
`vite.config.ts`. No modifications to owner access, SQL schema/store, lyrics,
captions, legacy extractor, or frontend without root transferring ownership.
Implement the job state machine, media/resource limits, yt-dlp wrapper, FFmpeg
pipeline, private listener, errors, protected proxy and typed route tests.

Coordinate dependency declarations with A, then generate the workspace lock once;
other builders use `--locked`. Give C the exact binary/env/startup contract early.
Test with stub executables plus small actual local media; verify kill/reap behavior
and cleanup as well as happy paths. Verify existing server auth/session/song APIs
still pass. A separate actual accessible YouTube run is evidence of acquisition,
not music accuracy. No deployment or live database is needed.

### C — React integration and packaging

Own only these existing/new frontend and packaging paths:

- `src/audio/analysisV1.ts`, `analysisClient.ts`, `analysisAdapter.ts` and their
  same-named `.test.ts` files; `src/audio/youtubeAnalysis.ts` and its test;
  `src/audio/songAlignment.ts` and its test for narrowly required new features.
- `src/data/chordIdentity.ts` and its test; `src/data/songbook.ts` and its test;
  `src/data/songSync.ts` and its test if source handling requires it.
- `src/components/AudioAnalysisPanel.tsx`, `YouTubeAnalysisPanel.tsx`,
  `SongbookMode.tsx`, `SongbookMode.test.ts`, `SongbookPlayer.tsx`,
  `SongPlayback.tsx`, `useSongPlayback.ts`, and `src/index.css`.
- `package.json`, `package-lock.json`, `scripts/start-local.mjs`,
  `scripts/start-production.mjs`, `Dockerfile`, `.dockerignore`, `.gitignore`,
  `README.md`, and new `e2e-rust-analysis.mjs`.

Do not rewrite the tuner, microphone pipeline, existing browser DSP, router auth,
lyrics grouping, numbered-tab parser, or copy main's player redesign. Existing
shape behavior remains; use the new identity parser instead of rewriting the
shape engine. If a required dependency outside this list is discovered, request
an ownership transfer from root first. Keep changes to CSS local to analysis and
upload controls so a future runway integration remains tractable.

Implement upload and YouTube paths, typed validators, source lifecycle, audio
playback, honest rich results, independent alignment targets, persistence and
stale/manual timing behavior. Preserve same-origin auth. Build the multi-stage
Dockerfile and supervised local/production startup, then test local containers
only. UI/API mocks can unblock work before A/B finish but cannot substitute for
one complete actual upload -> Rust -> playback -> save/reload journey.

### Integration order and root's finish line

1. A freezes exported types/signatures/vocabulary; B and A settle manifests and
   B writes the lock. C can build validators/client UI from section 5 immediately.
2. A completes core/CLI, B completes bounded API/gateway, C completes adapters/UI
   and package scripts. Resolve contract discrepancies explicitly in this document
   through the design owner/root rather than each builder inventing a variant.
3. Root runs `cargo fmt --all -- --check`, `cargo clippy --locked --workspace
   --all-targets -- -D warnings`, `cargo test --locked --workspace`,
   `npm run check:fast`, `npm run build`, and focused new/retained browser flows.
4. Root/evaluator runs development evaluation and selected actual upload decoding,
   freezes the implementation, then independent holdout and resource measurement.
   Builders do not edit the evaluator to pass. If evaluator findings require fixes,
   assign the responsible existing owner; do not overwrite other builders' work.
5. Report completed functionality, exact frozen revision/binary, per-category
   results and failures, local Docker evidence, remaining real-audio gaps, and
   YouTube network limitations. A failed musical gate is unfinished accuracy work,
   even if all route/unit tests pass. No merge of main or production rollout is
   implied by acceptance of this local implementation.

The split keeps spectral decisions in one place, security/process lifecycle in a
second, and user-visible state/packaging in a third. Node persistence stays intact,
so the ambitious work is concentrated on useful music analysis rather than an
unrelated database/auth rewrite.

## 14. Technical references and decision provenance

These support algorithm/tool capabilities, not Fretbloom accuracy claims:

- [YIN paper by de Cheveigné and Kawahara](https://pubmed.ncbi.nlm.nih.gov/12002874/):
  a monophonic fundamental-frequency method; it is not polyphonic transcription.
- [RustFFT documentation](https://docs.rs/rustfft/latest/rustfft/): maintained FFT
  planner and transforms; build and lock the selected crate version.
- [FFmpeg command documentation](https://www.ffmpeg.org/ffmpeg.html) and
  [protocol restrictions](https://www.ffmpeg.org/ffmpeg-protocols.html): tool
  controls require independent byte, wall-time and process-lifecycle enforcement.
- Repository evidence: `docs/song-playalong-audit.md`, `audio-analysis-research.md`,
  `security-audit.md`, `youtube-backend.md`, and the implementation files in section
  2. Historical live checks in those documents are not fresh production checks.

Open risks at handoff: harmonic aliases and equivalent chord names; weak
fundamentals/quiet decays; spectral leakage around strums; source mixing and
unreliable guitar attribution; quality of current shape-derived alignment targets;
real-audio coverage; decoder/iframe timeline offsets; codec process memory use;
cloud YouTube blocks; ephemeral audio on reload; and concurrent old/new-client
song edits. Each has an explicit output, limit, compatibility rule or validation
gap above. None is solved merely by changing implementation language.
