# Local live listening with the shared Rust engine

Implementation contract, 2026-10-31. This is a design, not a completed build,
performance result, or music-accuracy claim. Scope is this checkout only. No
deployment, production access, branch changes, commits, or changes to the
independent evaluation corpora are implied.

## Decision and current boundaries

Add a public **Capture music** surface inside `/listen`: explicitly share a tab's
audio, or choose a microphone/audio interface; see provisional notes and harmony
during capture; stop, refine, play back, save locally, and export. Compile the
actual `fretbloom-analysis` crate to WebAssembly. Keep uploads, YouTube/server
analysis, the tuner, chord practice, and private Songbook working.

Use two dedicated browser workers: ingestion/resampling/recording and synchronous
Rust analysis. An AudioWorklet supplies bounded transferable buffers. No
SharedArrayBuffer, cross-origin isolation headers, server dependency, or automatic
capture. Captured sound never enters `analysisClient` or a network upload.

Inspected integration facts:

- `App.tsx` owns navigation/garden callbacks; `ListenMode.tsx` currently practices
  eight target chords using `engine.mic`, main-thread pitch/chroma and a diagram.
  Preserve this as a separately selected practice view. Unmounting either view
  releases its capture before mounting the other. Tuner/mic code stays untouched.
- `router.ts` protects built Songbook through `/api/session`; static HTML/404
  responses deliberately fail closed. Do not change the loader, pretend to be a
  local owner, read Songbook's browser keys from Listen, or call its save/sync APIs.
- `analysisV1.ts` already supplies strict options/result/features parsers and rich
  note, harmony, bass and uncertainty types. Reuse these. `Source`/`ResultEnvelope`
  represent **server** uploads/YouTube jobs, not local capture; do not forge those.
- `analysisAdapter.ts` projects results for legacy alignment and loses some rich
  information. Render live results directly from rich types. Do not route them
  through that projection or infer notes from chord names/diagrams.
- `useSongPlayback.ts` can fetch server YouTube audio and deliberately switches to
  supplied audio. Do not reuse it for the public local path. Use a small local
  audio transport and, optionally, `useYouTubeClock` for an explicitly linked
  iframe. Existing player/alignment/manual timing remain unchanged.
- Node retains auth, Postgres, captions and lyrics. The completed private backend
  and supervisor described in `crates/fretbloom-backend/README.md` need no redesign.
  `server/index.ts` needs only the WASM static MIME entry described below.

A/B/C have handed off their work. A **different DSP fixer exclusively owns
`crates/fretbloom-analysis/src/**` and its existing `tests/**`**. The WASM builder
must not edit those paths. Reviewed native executable was
`d933b4ef53fd70849c900203a9e5e31407a7d20da86f9ed933bdc7570e2ac659`;
see `rust-development-review.md`. All 18 quality paths exist, but real-note,
polyphony and chord gates remain unmet. In particular, a 60 ms truncated 440 Hz
input emitted MIDI 67–71; routing changes can reset support, and bass flicker can
demote harmony. Live integration must buffer context, preserve uncertainty, and
leave those DSP fixes to their owner. WASM parity can reproduce a defect; it does
not establish accuracy. GuitarSet and supplemental development evidence do not
establish full-band guitar recognition.

## Rust wrapper: exact contract, no fork of DSP

Add `crates/fretbloom-wasm`, `crate-type = ["cdylib", "rlib"]`, depending on
`fretbloom-analysis` with `default-features = false`, serde/serde_json and exactly
`wasm-bindgen = "=0.2.100"`. Reuse locked core dependencies. No web-sys, threading,
FFmpeg, file I/O, clock, randomness, or browser capture inside the Rust wrapper.

Only change the **core manifest**: make `clap`/`ctrlc` optional under a default
`cli` feature and declare `[[bin]] name = "analyze-pcm"` with
`required-features = ["cli"]`. Native existing commands retain their defaults;
WASM builds only the wrapper library with no CLI feature. If Cargo feature
unification is unexpected, inspect the target-specific tree and fix manifests;
do not add cfg edits to core source. Native workspace builds and core CLI tests
must still work. `Arc`/`Sync` in the core are not requests to spawn WASM threads.

Exports in `crates/fretbloom-wasm/src/lib.rs`:

```rust
#[wasm_bindgen]
pub fn engine_info_json() -> String;

#[wasm_bindgen]
pub fn analyze_pcm_json(
    mono: &[f32],
    sample_rate_hz: u32,
    options_json: &str,
) -> Result<String, JsValue>;
```

`engine_info_json` returns `{bridgeVersion:1, schemaVersion:1, engineVersion,
sampleRateHz:24000, maxSamples:7200000}`. `analyze_pcm_json` rejects empty,
nonfinite, >7,200,000-sample input and options JSON >4 KiB; accepts only 24 kHz,
`mode: auto|monophonic|polyphonic`, `concertAHz:432..446`,
`spelling:sharps|flats`. JS supplies all options using `parseOptions`; Rust also
validates. Call existing `analyze(mono, rate, &options, &|| false, &mut |_| {})`.
Return its unchanged serialized `AnalysisOutput {result,features}`; `engineVersion`
comes from the core. Do not introduce a live mode into native options.

Thrown `JsValue` is a JSON string `{code,message}` with
`INVALID_INPUT|LIMIT_EXCEEDED|CANCELED|SERIALIZATION_FAILED`; worker catches and
parses it as `unknown`. A panic/trap maps to `ENGINE_CRASH`, never an empty success.
Parse both output fields with existing TS parsers, checking matching duration and
engine version. Preserve unknown/no-chord alternatives, bass nullability and
separate note streams. Evidence scores are not percentages of correctness.

This synchronous function cannot receive a posted cancellation while running.
**Terminate its worker** on cancel/deadline, detach listeners, increment generation,
and instantiate a fresh worker for subsequent work. Ingestion retains canonical
PCM until discard, so canceling refinement leaves the captured session usable.
Do not advertise progress from callbacks that cannot reach the UI; refinement
shows elapsed time and an indeterminate status, not fabricated percentages.

## Frozen TypeScript boundary between the two builders

Runtime builder owns `src/audio/live/protocol.ts` and `runtime.ts`. UI/capture
builder imports them; it must not create an alternative protocol. Session IDs are
random UUIDs made on the main thread. Each operation carries a monotonically
increasing generation. Wire fields called `sample` refer to integer 24 kHz samples;
seconds are derived only at display/serialization boundaries.

```ts
import type { AnalysisOptions, AnalysisResult, AlignmentFeatures }
  from '../analysisV1'

export type Key = { sessionId: string; generation: number }
export type GapReason = 'paused' | 'muted' | 'context_suspended'
  | 'transport_overflow' | 'device_changed' | 'background_interruption'
export type CaptureBlock = Key & {
  type: 'pcm'; sequence: number; firstFrame: number; frameCount: number;
  sampleRateHz: number; channels: 1 | 2; interleaved: ArrayBuffer;
}
export type CaptureMessage = CaptureBlock | (Key & {
  type: 'boundary'; sequence: number; frame: number;
  action: 'pause' | 'resume' | 'end'; reason: GapReason | 'user_stop';
})
export type CaptureReply = Key & (
  | { type: 'credit'; sequence: number; recycled: ArrayBuffer }
  | { type: 'boundary_ack'; sequence: number;
      action: 'pause' | 'resume' | 'end' }
)
export type EngineRequest = Key & {
  type: 'analyze'; requestId: number; purpose: 'live' | 'refine';
  segmentId: number; startSample: number; pcm: ArrayBuffer;
  options: AnalysisOptions;
}
export type EngineReply = Key & { requestId: number } & (
  | { type: 'result'; result: AnalysisResult; features: AlignmentFeatures;
      computeMs: number; wasmBytes: number }
  | { type: 'error'; code: LiveErrorCode; message: string }
)
export type LiveErrorCode = 'INVALID_INPUT' | 'LIMIT_EXCEEDED'
  | 'CANCELED' | 'SERIALIZATION_FAILED' | 'ENGINE_CRASH'
  | 'WASM_LOAD_FAILED' | 'PROTOCOL_MISMATCH' | 'ANALYSIS_TOO_SLOW'
  | 'CAPTURE_OVERFLOW' | 'UNSUPPORTED_SAMPLE_RATE'

export type MissedLiveInterval = {
  segmentId: number; startSample: number; endSample: number;
}
export type LiveNoteEvent = AnalysisResult['monophonicNotes'][number] & {
  id?: string;
}
export type TimelinePatch = Key & {
  revision: number; segmentId: number;
  replaceFromSample: number; replaceToSample: number;
  settledThroughSample: number;
  // Starts/ends translated into session capture seconds, clipped to replacement.
  harmony: AnalysisResult['harmony'];
  monophonicNotes: LiveNoteEvent[];
  polyphonicNotes: LiveNoteEvent[];
  warnings: AnalysisResult['warnings'];
  missedLiveIntervals?: MissedLiveInterval[];
}
export type CaptureSegment = {
  id: number; startSample: number; endSample: number;
  sourceRateHz: number; channel: 'mean' | 'left' | 'right';
  precedingGap: null | { reason: GapReason; wallDurationMs: number | null };
}
export type LocalAnalysis = {
  schemaVersion: 1; engineVersion: string; options: AnalysisOptions;
  durationSamples: number; segments: CaptureSegment[];
  // Offsets are in capture time; result/features remain relative to this segment.
  results: { segmentId: number; offsetSample: number;
    result: AnalysisResult; features: AlignmentFeatures }[];
  completeness: 'live' | 'partial' | 'refined';
  missedLiveIntervals?: MissedLiveInterval[];
}
export type RuntimeEvent =
  | { type: 'ready'; key: Key; engineVersion: string }
  | { type: 'timeline'; patch: TimelinePatch }
  | { type: 'status'; key: Key; capturedSamples: number;
      capturePosition?: { segmentId: number; sample: number };
      captureEpoch?: number;
      analyzedThroughSample: number; queuedBlocks: number;
      processingMs: number; wasmBytes: number;
      ownedJsBytes?: number; sharedPcmBytes?: number;
      queuedHighWater?: number; skippedWindows?: number }
  | { type: 'stopped'; key: Key; analysis: LocalAnalysis }
  | { type: 'refined'; key: Key; analysis: LocalAnalysis }
  | { type: 'error'; key: Key; code: LiveErrorCode; message: string }

export interface LiveRuntime {
  prepare(key: Key, options: AnalysisOptions): Promise<void>;
  restore(key: Key, saved: LocalAnalysis, pcm: Blob,
    pcmSha256: string, signal: AbortSignal,
    options?: { allowEngineChange: true }): Promise<void>;
  attachCapturePort(port: MessagePort,
    options?: { channel: 'mean' | 'left' | 'right' }): void;
  stop(): Promise<LocalAnalysis>;
  refine(signal: AbortSignal): Promise<LocalAnalysis>;
  exportPcm(signal: AbortSignal): Promise<{
    pcm: Blob; pcmSha256: string; // mono f32le, not a WAV header
  }>;
  cancelRefinement(): void;
  dispose(): void;
}
export function createLiveRuntime(onEvent: (event: RuntimeEvent) => void): LiveRuntime;
```

Root coordination amendment: channel defaults to `mean`. For explicit `left` or
`right`, the worklet already selects that input and sends one channel; ingestion
must not select it a second time. Record the explicit choice in each segment.
For `mean`, send the available mono/stereo input; ingestion owns downmixing and
the documented cancellation fallback, recording its actual selected channel.
Changing the choice starts a new capture rather than relabeling existing PCM.

Root review amendment (R1): ingestion reports optional `capturePosition` from
the same recording state as `capturedSamples`, with its actual nonempty active
segment identity and canonical sample position. It is absent when there is no
valid active capture position. Validate safe integer bounds and correspondence
with the status sample count. Video anchors use this paired capture state,
never a segment ID inferred from analysis completion. Pause, resume and capture
interruptions invalidate the UI's prior anchoring state; queued pre-boundary
status and late analysis patches must not re-enable a stale association. Keep
strict saved annotation bounds and allow removal of an incorrect annotation.
Optional `captureEpoch` is the nonnegative safe-integer count of processed resume
boundaries in this capture generation, initially zero. Ingestion emits it with
the position; ordinary analysis and automatic segment discontinuities do not
advance it. The UI advances its expected epoch before explicit Resume and only
uses positions with that epoch, rolling back a failed resume. Repeated resume
requests are guarded. This distinguishes queued pre-resume status even when an
empty segment was discarded and segment zero is reused; segment numbers alone
must not serve as resume counters. Missing epoch cannot authorize a new anchor.

Root review amendment (R2): `ownedJsBytes` continues to include the runtime's
cached exported PCM Blob. Optional `sharedPcmBytes` identifies the portion of
that total shared with the UI; it is a nonnegative safe integer no larger than
`ownedJsBytes`. Subtract overlap only for the same proven Blob and generation,
not merely equal byte counts. Emit updated accounting when export/restore/cache
ownership changes. Missing or stale diagnostics cannot establish a measured
combined high-water bound. The combined budget includes runtime-owned bytes,
any additional UI PCM, prepared WAV and verification working buffers. Release
prepared playback before verification and serialize full-copy operations. Hash
and finite-sample verification runs off the main thread; its allocation and
worker lifecycle remain accounted and bounded. Preserve atomic IndexedDB saves.
The different review fixer owns the narrow protocol/runtime/ingestion and
UI/storage changes; packaging and generated artifacts remain root-owned.

W also owns `src/audio/live/validation.ts` and its focused tests, exporting
`parseLocalAnalysis(value: unknown): LocalAnalysis` for both runtime restore and
U's storage boundary. It composes the existing strict result/features/options
parsers and validates segment extents, identities, counts and total metadata
bounds. Reading saved metadata preserves its recorded engine version; engine
compatibility is checked separately before refinement.

Root coordination amendment: default restore still rejects a saved/current engine
version mismatch. After the user's explicit **Reanalyze with current engine**
action, U may call restore with `{allowEngineChange:true}`. This permits analysis
of verified retained PCM with the current engine; it does not rewrite or pretend
to upgrade any old result. Verify the PCM hash, duration, segments and saved
options before adopting it. Retain the old analysis as the displayed snapshot,
and track the current target engine separately until refinement fully succeeds.
Only that successful result gets the new engine version. Failure/cancellation
keeps the old snapshot and saved IndexedDB record intact; persistence still
requires the ordinary explicit save action. Option changes require their own
explicit new analysis rather than silently inheriting different settings.

Root coordination amendment: optional diagnostic fields above are backward
compatible, but W emits them on its live path. Validate any supplied value rather
than silently dropping malformed data. Missing fields mean unavailable, not zero.
Counters are finite nonnegative safe integers; `ownedJsBytes` reports accounted
application buffers, not total browser memory. U preserves interval diagnostics
through save/export and displays missing counters as unavailable.

Missed intervals use session capture sample coordinates, lie inside their named
segment, and have positive length. Coalesce adjacent/overlapping intervals in the
same segment, sort them, and cap the collection at 1,024 entries plus the existing
metadata budget. A patch supplies the cumulative missed-live set for its segment;
U replaces that segment's diagnostic set without deleting other segments. These
record live coverage history, not silence. Successful refinement may retain that
history, but U renders refined evidence over it and does not call those spans
missing from the refined result. Analysis completeness is validated separately.

Live note IDs are bounded strings (maximum 160 characters), generated from
segment, stream, MIDI and original onset sample. Preserve IDs when extending or
clipping an existing note; do not use ID changes as musical evidence. They apply
to patches, not the native note schema. Stored segment results retain the native
schema and may derive fresh display IDs on reload.

`runtime.ts` implements the main-thread facade; ingestion worker owns the ledger,
canonical recording and analysis worker scheduling. Internal facade requests also
carry `Key` and request IDs, and bounded replies resolve exactly one promise.
`stop` is idempotent, called after the worklet's acknowledged `end` barrier. The
ingestion worker sends `boundary_ack` on the capture port only after it processes
all preceding PCM and that boundary. The worklet forwards this acknowledgment to
its main-thread node port; posting an end message alone is not acknowledgment.
This avoids races between control messages arriving on different ports. A
missing barrier has a 1 s watchdog: stop with `partial`, do not hang. No future
PCM accepted after end. `refine` runs once per generation after stop, with at most
one Rust call at once. Disposing rejects pending promises and terminates both
workers. Runtime readiness must resolve before a capture button is enabled.

Validate messages at each boundary (finite values, safe integers, expected byte
length = frames × channels × 4, sequence/frame continuity, allowed rates and caps).
Typed unions alone do not validate worker data. Reject repeated/out-of-order input;
record a gap for missing input. Drop results from old session, generation, request,
segment or revision before touching UI/store. No `any` or unchecked casts of JSON.

## Signal transport, resampling and clocks

Create a fresh AudioContext for each capture. Actual context rate, not requested
device rate, determines the worklet stream. Support integer rates 8–96 kHz;
warn about limited bandwidth below 24 kHz and reject outside this range. Do not
assume render quanta are always 128 frames.

The worklet only copies 1–2 channels, counts input frames, supplies a low-rate level
meter, and writes **zeros** to its output. Graph:
`MediaStreamAudioSourceNode → capture worklet → zero-output destination`.
Never connect captured input directly to speakers; no monitoring/feedback gain
control. With >2 input channels, explicitly select the first stereo pair and show
that choice; support a user left/right selection for mono interface instruments.
Default stereo is mean; inspect the first 0.5 s for strong cancellation and select
one consistent channel with a visible warning if needed. Buffer that initial
decision so it applies to every sample; never switch channels silently mid-session.

Transfer a MessageChannel endpoint to the worklet and its peer to ingestion. The
worklet preallocates **8 blocks of 2048 frames × at most two channels**, sends a
block when full (partial block on boundary/end), and gets its buffer back in a
credit reply after ingestion copies it. No unbounded `postMessage` queue. If no
credit is available, drop input with exact frame counters and report overflow on
the next available block/control message. At 96 kHz this bounds outstanding audio
to about 171 ms; no DSP or heavy allocation in `process()`. Process explicit
pause/end messages, flush partial blocks, and acknowledge the last sequence before
the UI disconnects the graph. Keep control messages separate from buffer credits.

Resample **in ingestion**, not React/the worklet, using a 64-tap windowed-sinc
low-pass with fractional source-position accumulator. Cutoff is
`0.45 * min(inputRate, 24000)` Hz, normalized per fractional phase; use f64 phase
and accumulation, f32 output. A polyphase table is allowed if its resolution and
error are measured. Keep 32 samples of left history and wait for 32 future samples;
carry fractional phase and pending input across blocks. Output sample `k` is
centered at input time `k * inputRate / 24000`, **without** adding filter delay to
its timestamp. At start/end only, pad the FIR context; total output length is
`floor(totalInputFrames * 24000 / inputRate)` per segment. Reset history only at an
explicit gap, never at transport chunk boundaries. Verify anti-aliasing, not just
sample counts; naive decimation/linear interpolation is not this contract.

Three clocks remain distinct:

1. **Capture time**: accepted canonical samples / 24000. Includes recorded silence;
   excludes explicit pause/mute/suspension gaps. Source-frame counters detect lost
   transport. Session segment markers retain gap reasons/wall duration; adjacent
   samples across a gap are never one continuous musical event.
2. **Wall time**: UI elapsed/permissions/delay diagnostics. Never infer audio sample
   timestamps from main-thread timer arrival or `Date.now()`.
3. **Video time**: optional user-confirmed approximate mapping below. Arbitrary
   other-tab playback position, seeks, ads and pauses are inaccessible.

Record silence from a normally playing but quiet source as silence. A muted track,
suspended context, user Pause or changed device opens a discontinuity; close the
segment, reset resampler and start a new one on resume. Record the gap separately
rather than inventing silence or welding a held note across it. An arbitrary
external video seek is audible content in capture time, not a detectable clock
event; explicitly disclose this. At 300 s accepted audio **or 30 minutes wall
time**, stop all capture, finalize bounded data and explain the limit.

## Actual live analysis and bounded refinement

The inspected core uses 480-sample/20 ms hops, 4096/8192 centered FFT windows,
three-frame note support, neighboring-frame smoothing and bass support. It also
re-estimates tuning and noise state per `analyze` call. A transport block is not a
valid independent musical analysis. The following wrapper is deliberately a
bounded rolling batch adaptation, **not sample-for-sample equivalence to a future
stateful native streaming engine**.

- Keep a 10.24 s canonical ring and up to 300 s of chunked session PCM (7,200,000
  samples = 28,800,000 bytes). Do not retain spectrograms.
- First analysis after **1.28 s** of contiguous input, then every **0.64 s**;
  use the most recent **2.56 s** window. Starts and hops lie on the segment's
  480-sample grid, with 0.64 s also preserving bass/feature stride phase.
- Exclude the newest **0.32 s** from emitted evidence: it supplies future FFT and
  smoothing context. On sliding windows exclude the first **0.64 s** as warm-up.
  At a real segment start, retain that beginning only with the core's normal edge
  semantics and label it tentative; never create a succession of fake starts.
- A patch replaces only `[previous settledThrough, windowEnd - 0.32 s)`.
  Advance `settledThrough` to `windowEnd - 0.64 s`, clamped to the valid interval.
  Thus the recent tail can change, and older evidence stays visually stable.
  Endpoints are integer samples. **Settled means no more live revisions, not
  verified truth**; final refinement can revise the entire session.
- Maintain a 20 ms evidence ledger inside the mutable interval, then coalesce
  adjacent cells into intervals. Clip notes spanning replacement boundaries;
  preserve their original prefix/onset and stable ID. Join only contiguous same
  MIDI within the same stream and segment, with actual support on both sides.
  A positive gap, detected release or stream change is not bridged. Keep explicit
  mono/poly streams; do not discard one to conceal routing failures. IDs derive
  from segment, stream, MIDI and onset sample; extend existing IDs at a seam.
- Harmony merging requires the same kind, chord identity, alternatives and bass
  identity; retain unknown/no-chord cells and intermediate strum evidence. Do not
  turn alternatives into primary chords, bass into root, or chord tones into notes.
  Avoid extra frontend duration gates that recreate the reviewed bass-flicker bug.
  Current core cannot guarantee every same-pitch restrike is separately detected;
  do not claim a strum counter.

Only one analysis request runs, with one replaceable latest pending window. If
coalescing skips an interval beyond safe overlap, mark it **not analyzed live**;
do not overwrite it with silence, delete earlier events, or imply continuity.
Retained PCM permits refinement of that interval. If lag exceeds 3 s for three
consecutive status reports (reports every 0.5 s), or one live call exceeds 5 s,
stop capture with `ANALYSIS_TOO_SLOW`, preserve the partial session and offer
refinement/export. No unbounded catch-up backlog. This limit is enforced by the
responsive ingestion worker, not by timers in the blocked DSP worker.

Expected evidence delay is roughly 0.32–0.96 s **plus measured compute/transport**;
initial readiness takes at least 1.28 s. Show measured delay and “Recent notes may
change.” The 20 ms event grid is not a latency promise. Window-local tuning/noise
resets can alter classifications even away from the seam; test and report this
instead of pretending overlap solves every detector state issue.

On Stop: release all capture tracks promptly, flush input, process the last window
once, and retain the live snapshot. Segments shorter than 0.64 s receive no live
chord/note claims (“Too short to settle”); final native analysis may still be
insufficient, so final refinement also abstains on these fragments. The DSP fixer
owns any general short-input behavior improvement.

Refine each contiguous retained segment in a single `analyze_pcm_json` call, up
to 300 s total. No padding between segments and no joining across gaps. Analyze
eligible segments independently with the same options and offsets; native/WASM
parity compares that exact PCM and call shape. The last edge uses native batch
semantics, not fabricated future audio. Atomically replace live results only after
all eligible segments validate. Preserve the live snapshot on failure/cancel and
mark incomplete segments explicitly. Refinement deadline is **120 s total**;
cancel terminates the DSP worker immediately. This bounded full-context pass
removes rolling-window seams but does not guarantee more accurate music.

Limit sessions to 64 segments, 4,000 notes per stream, 3,000 harmony events and
2 MiB serialized local metadata overall. Stop with a partial/exportable session
when an event/segment cap would be exceeded; never silently truncate. Bound
alignment frames to the existing 0.08 s cadence. Main-thread UI receives interval
patches/status, not a growing PCM array or full recording on every update.

Root segment-edge correction: each independent segment can end with a partial
alignment frame. Validate at most `ceil(segmentSamples / 1920)` frames for that
segment, preserving its actual timestamps and all gap edges. With at most
7,200,000 samples and 64 nonempty segments this mathematically bounds the total
to 3,813 frames; the single-segment maximum remains 3,750. Do not apply a
single-contiguous-recording frame count to all segments or discard their final
frames to fit it. The 2 MiB metadata and existing note/harmony limits still apply.

## Browser capture and lifecycle

Prepare the workers/WASM while the source selector is visible. A source button's
direct click handler calls `getDisplayMedia({video:true,audio:true})` immediately
(and resumes/creates the AudioContext from that gesture); do not await WASM/network
before the picker. User chooses the source **and audio sharing**. Optional browser
hints cannot force selection, grant permission, or prove which tab was selected.

Keep the returned video track alive for the complete audio capture. It is not
rendered, recorded, sent to a worker or stored; retaining the track avoids browsers
ending coupled capture when it is stopped. Retain the original stream solely for
ownership/cleanup; create the audio graph from the selected audio track. Do not
stop video immediately after selection. On all exits stop **every owned track**,
including video and streams arriving after cancellation. Stop is idempotent.

Mic/interface uses `getUserMedia({audio: constraints, video:false})`; request
`echoCancellation:false`, `noiseSuppression:false`, `autoGainControl:false` where
supported, and exact selected `deviceId` only when chosen. Explain if actual
settings retain processing. Enumerate labeled inputs after permission; an audio
interface appears only when the OS/browser exposes it. This is audio capture,
not MIDI. Device changes refresh choices; removal pauses/stops with an actionable
message, never silently falls back to a different microphone.

State machine: `preparing → ready → requesting → capturing ↔ paused → stopping
→ captured → refining → ready-to-save`; errors retain whatever data is valid.
Capture lease lives outside component render. Every async permission/context step
checks the current request generation before adopting resources. Route unmount,
source switch, cancel, pagehide, errors and duration limits release tracks, nodes,
ports, listeners and AudioContext; revoke playback URLs and terminate workers on
session disposal. Keep runtime alive only while a stopped session is being used.

| Condition | Visible behavior/action |
| --- | --- |
| No secure context, AudioWorklet or WASM | Explain local listening is unavailable; preserve practice/tuner where supported, existing upload route when authorized |
| No `getDisplayMedia` | Disable tab action with explanation; microphone/interface remains available |
| Permission denied/dismissed | “Sharing did not start. Choose a source again, or use a microphone.” No automatic re-prompt |
| Stream has **no live audio track** | Stop every track immediately; “No audio was shared. Choose a browser tab and turn on Share audio, or use a microphone.” Offer retry |
| Live audio track but quiet signal | Meter plus “No sound yet”; do not confuse silence with missing audio permission |
| Audio/video track `ended` | Stop the session, retain captured results, offer refinement; handle explicit stop separately because `stop()` need not emit `ended` |
| `mute`/`unmute` | Open/close an interruption segment; show “Audio interrupted” and reset context across the gap |
| Context suspended/interrupted | Pause, mark a gap; show user-gesture Resume; no promise of background capture |
| Hidden page | Warn on return about detected loss/lag; frame continuity remains authority. Auto-stop at resource limits even if rendering pauses |
| Quota/storage unavailable | Keep current in-memory result, offer export; never claim Saved |

Desktop Chrome/Edge are initial tab-audio test targets, **not universal support**.
Firefox/Safari/mobile and OS/window/system-audio options must be capability-tested
and reported honestly. API presence does not prove audio availability. “Listen to
this tab” always has helper text: “Your browser will ask which tab to share. Select
the music tab and enable audio.” An arbitrary tab cannot be read through an iframe.

## YouTube position and local playback

Allow an optional YouTube link on public Listen, including a link from a blocked
server-analysis message. A URL parameter may prefill a valid video ID; it never
starts playback/capture or fetches private APIs automatically. Embed only after
the user's action; use the existing privacy-enhanced origin and clock hook.

Default timeline label is **Time since capture started**. The optional action
**Link this moment to the video** requires the user to confirm that the chosen
capture source is this video. Save `{videoId, segmentId, captureSample,
videoSeconds, rate, status:'approximate', userConfirmed:true}`. Display
`videoSeconds + (captureSeconds-anchorCaptureSeconds)*rate` only within that
uninterrupted mapped segment. This includes unknown capture/output delay; offer a
manual offset adjustment and never describe it as automatic song alignment.

Poll the existing iframe clock at 100 ms only while visible/linked. Explicit
seek, rate change, pause/buffering, source change, missing clock for >1 s, ended,
or a >0.35 s clock discontinuity invalidates the anchor and requires a new user
anchor. Do not extrapolate its clock across these events. The iframe API does not
provide a reliable complete ad detector: ads in an arbitrary captured tab are
unknown; show an **Ad or wrong section** action to break the mapping/segment.
Consequently anchors are annotations, never automatic Songbook timing. If embed
playback is blocked, offer opening YouTube and ordinary capture-time listening.

After capture, **Play captured audio** uses a locally created mono PCM16 WAV
quantized from retained f32 PCM, like native playback. Its clock follows the
captured, gap-compacted recording; show gap markers. Pause this playback before
starting another capture. Do not play it while listening to the same tab. Refining
uses retained f32 samples, not a re-decoded lossy/exported recording. WAV download
is a separate explicit action; detailed JSON exports retain capture-time metadata.
No lyric/caption fetching on the public local path.

## Local persistence without an owner bypass

Add IndexedDB database **`fretbloom-listening-v1`**, version 1, stores `sessions`
(UUID key) and `pcm` (session UUID key). UI builder owns all storage code. No reads,
migrations or writes to `src/data/songbook.ts` keys/journal or Postgres. Local
sessions are accessible publicly under Listen on static and full hosting and
clearly labeled **Saved on this browser**; browser clearing can remove them.

`SavedListeningSession` contains `schemaVersion:1`, UUID, bounded title (200
characters), created/updated ISO timestamps, source kind (`tab|microphone`),
`LocalAnalysis`, optional anchor annotations, capture warnings, and optional
`pcm:{sha256,byteLength,sampleRateHz:24000,format:'f32le'}`. Do not persist device
IDs, shared screen pixels, secret URLs or ownership credentials. Audio is stored
only when **Keep audio for playback and refinement** is selected; explain size.
Temporary capture PCM is kept in worker memory until save/discard/leave regardless
of that checkbox, with clear copy before recording.

Save validates and atomically writes metadata + optional PCM Blob, then reports
success after transaction completion. Failure leaves the previous save intact.
Hash canonical little-endian f32 bytes in a worker and verify hash/size before
rehydrating audio; never trust a filename. After reload, restore results without
rerunning detection; offer playback/refinement only when retained PCM verifies.
For refinement after reload, `restore` initializes a fresh stopped runtime with
validated segments/options/PCM and verifies its hash in ingestion (same facade
owner; no fake capture stream). Require ordered contiguous sample extents whose
lengths total the PCM length, with explicit gap markers; reject a different engine
version for refinement until the user explicitly chooses to reanalyze. Previously
saved results remain readable with their recorded engine version.

App storage budgets: 20 sessions, 2 MiB metadata each, **128 MiB total stored
audio**. Consult `navigator.storage.estimate()` as advice and handle actual quota
errors. No automatic eviction of user-saved recordings; prompt to delete selected
sessions or save results without audio. `persist()` is optional and never required.
List/open/rename/delete sessions; deletion removes its PCM in the same transaction.
JSON export (2 MiB cap) includes version, engine, options, segments, gaps,
completeness, rich results and anchors, but not base64 audio. WAV export is separate.
JSON import is not required in this slice; do not promise a one-file backup of
audio. Never describe this collection as synced Songbook.

## Minimal UI design

Apply the existing garden/panel/type/semantic color system in **Operate** mode.
No redesign or new global design system. The supplied brief settles product
choices; no PRODUCT.md/interview or extra design artifact is required for this
one-file contract.

Inside Listen use **Capture music / Practice a chord**. Preserve existing chord
practice behavior in its own component; default to Capture music for this feature.
Source choices, one Start action, input level, elapsed capture time and an obvious
Stop stay above one notes-and-harmony timeline. Advanced mode/tuning/spelling and
optional video linking are secondary; changing options mid-capture requires a new
session. Show “Still settling”, “Unclear chord”, “No chord” and alternative names
in plain language. Solid settled spans and outlined tentative spans also carry
text/state labels; color alone is insufficient. No green “accurate” badge.

After stop, show **Refine recording**, **Play captured audio**, **Save on this
browser**, **Download results** and optional WAV. The captured results remain
visible during refinement. Saved sessions sit below the current task. A permission
error stays next to its source action with a useful recovery, not a disappearing
toast. Announce lifecycle changes through `role=status`; do not announce every
pitch. Timeline is keyboard navigable, has a readable event-list alternative and
does not move focus as notes arrive. At 360 px, stack source/actions/video, keep
Stop reachable, and horizontally scroll only the timeline, not the page. At
1280 px give the timeline space without changing Songbook layout. Reduced motion
disables scrolling animations; use existing buttons/focus styles.

## Reproducible artifact and hosting plan

**Use a checked-in distributable plus a tested source bootstrap.** Normal npm-only
development/Netlify must not secretly require installed Rust. Generated bytes are
reviewable repository artifacts, not ignored local files or a remote CDN download.

Pin Rust **1.89.0**, target **wasm32-unknown-unknown**, wasm-bindgen crate and CLI
**0.2.100**, Node **24.22.2** (preserve current engine policy). Keep SIMD optional
and off for the initial WASM build, with no atomics/shared-memory target flags;
use RustFFT's portable path. These are selected compatible inputs, not a claim
that this design task compiled them. Builder must prove the complete dependency
graph builds under the pin before claiming feasibility complete.

Explicit bootstrap `npm run wasm:bootstrap` installs the pinned target and
`cargo +1.89.0 install wasm-bindgen-cli --version 0.2.100 --locked --root
.tools/wasm-bindgen-0.2.100`; it verifies versions and never silently uses another
global CLI. `npm run wasm:build` executes:

```sh
CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS='-C link-arg=--max-memory=134217728' \
cargo +1.89.0 build --locked --release -p fretbloom-wasm --lib \
  --target wasm32-unknown-unknown
.tools/wasm-bindgen-0.2.100/bin/wasm-bindgen \
  target/wasm32-unknown-unknown/release/fretbloom_wasm.wasm \
  --target web --out-dir src/generated/analysis-wasm --out-name fretbloom_wasm
```

Track generated `.js`, `.d.ts`, `_bg.wasm`, `_bg.wasm.d.ts` and `manifest.json` in
`src/generated/analysis-wasm/`. The manifest contains exact tools/flags, engine and
bridge versions, SHA256 of each artifact, and a canonical sorted-path source hash
over core `src/**`, core/wrapper manifests and wrapper sources, root Cargo.lock,
Cargo.toml, toolchain and WASM build scripts. Exclude tests from source hashing.
Write outputs to a temporary directory and replace the set only on success.
`wasm:verify` uses Node crypto to validate artifacts/source association without
Rust; stale/missing output fails with explicit rebuild instructions. A fresh Rust
build into a disposable directory must match checked-in artifact hashes; record
any reproducibility failure, do not hand-edit the manifest to conceal drift.
DSP fixer changes require one final regeneration after source freeze.

`npm run dev` and `npm run build` run `wasm:verify` first; build still runs tsc and
Vite. `dev:full` verifies first, then retains the existing supervisor. Preserve
`start:full`, server tooling and the existing real `e2e-rust-analysis.mjs` journey.
Verification must not write anything or install tools. Netlify explicitly sets
Node 24.22.2, keeps `npm run build`/`dist`; no Rust bootstrap on an npm-only host.

In the DSP worker import generated glue normally and `.wasm?url` explicitly;
initialize with that emitted URL, not a guessed `/src` or `/public` path. Create
both module workers using Vite's literal `new Worker(new URL('./name.worker.ts',
import.meta.url), {type:'module'})` pattern. Keep the worklet as a self-contained
`.js` module imported with `?url` and no runtime imports, with checked JSDoc/local
declarations. Avoid accidental bundling of browser code into Node's Vite config.
Vite must emit versioned worker/WASM/worklet assets and support non-root base URLs.
No new bundler plugin is required for generated `--target web` glue.

Serve `.wasm` as `application/wasm` (add only that mapping to Node's static MIME
table); JavaScript assets need JavaScript MIME. A missing WASM URL returning SPA
HTML is a visible `WASM_LOAD_FAILED`, not success. Test the actual built asset
paths on static and Node serving. No COOP/COEP headers: preserve YouTube embeds.
If a future CSP restricts WASM/workers, adjust narrowly after a measured failure,
not by removing existing security headers.

Docker retains the native Rust builder and Node24 runtime. Add a pinned WASM
builder that regenerates/verifies the same artifact set; copy validated outputs
into the Node builder before npm build. Copy verifier scripts, source hash inputs,
root manifests/lock/toolchain into the Node build stage (they need not enter the
runtime image); current Docker's restricted COPY list otherwise breaks verification.
Use the same CLI/install/flags as local bootstrap. Runtime still contains only
built frontend, Node production dependencies/server/supervisor, native backend and
existing media tools. Keep `.tools`, target caches and validation audio excluded;
do not exclude tracked generated `.wasm`. No infrastructure or live host changes.

Primary feasibility references, checked for this contract:

- [Rust target documentation](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html):
  browser target supports computation/allocation, not normal OS threads/files.
- [Pinned wasm-bindgen manifest](https://github.com/wasm-bindgen/wasm-bindgen/blob/0.2.100/Cargo.toml)
  declares Rust 1.57 minimum; the [CLI guide](https://rustwasm.github.io/docs/wasm-bindgen/reference/cli.html)
  and [deployment guide](https://rustwasm.github.io/docs/wasm-bindgen/reference/deployment.html)
  describe generated web glue/types. Full dependency compatibility still needs a build.
- [Vite workers/assets](https://vite.dev/guide/features.html#web-workers) support
  module workers and explicit asset imports; verify this checkout's Vite 8 output.
- [Screen Capture specification](https://www.w3.org/TR/screen-capture/) requires
  user-mediated selection and permits absent audio; [getDisplayMedia reference](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
  documents activation, video and compatibility constraints.
- [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode)
  supplies a processor/message-port boundary; [YouTube iframe API](https://developers.google.com/youtube/iframe_api_reference)
  supplies player controls/time, not cross-origin PCM access.

## Nonoverlapping implementation handoffs

Root launches the requested **two Sol 6.1 xhigh builders** and a separate **Sol
6.1 high tester** using the requested provider/settings. No child delegation. The
following ownership is exclusive; edits outside it require root to transfer the
specific file. C is now complete, so its listed files can be released. Existing
DSP fixer retains its source/tests throughout; native accuracy is separate work.

### W — WASM, runtime, transport receiver and packaging

Own new `crates/fretbloom-wasm/**`; new `src/audio/live/{protocol.ts,runtime.ts,
ingest.worker.ts,analysis.worker.ts,resampler.ts,rollingTimeline.ts}` and focused
same-name unit tests; new `src/generated/analysis-wasm/**`; new
`scripts/{wasm-bootstrap.mjs,wasm-build.mjs,wasm-verify.mjs}`.

After root transfer, own root `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`,
**only** `crates/fretbloom-analysis/Cargo.toml`, `package.json`, `package-lock.json`,
`Dockerfile`, `.gitignore`, `.dockerignore`, `netlify.toml`, `README.md`,
`scripts/start-local.mjs`, `scripts/start-production.mjs`, `vite.config.ts`,
`tsconfig.app.json` if necessary for worker types, and the **static MIME entry
only** in `server/index.ts`. No other server changes or existing test rewrites.

First handoff: compiling wrapper and generated artifacts, exported protocol and
facade signatures, bounded ingestion/engine worker skeleton with actual Rust
execution, agreed lifecycle acknowledgments. Then finish resampling, rolling
ledger/refinement, cancellation/limits and reproducible packaging. UI builder can
code against the frozen interface immediately; W owns any protocol additions.
Never edit core source to improve musical output or eliminate parity failures.

### U — capture, Listen UI and independent local persistence

Own new `src/audio/live/{capture.ts,capture.worklet.js,captureWorkletTypes.d.ts}`
and their same-name unit tests; new `src/data/listeningSessions.ts` and test;
new `src/components/{LiveListen.tsx,LiveTimeline.tsx,LiveVideo.tsx,
LocalSessionPlayer.tsx,ListeningSessions.tsx,PracticeChordMode.tsx}` and focused
same-name tests; new `src/components/live-listen.css`.

After root transfer, own existing `src/components/ListenMode.tsx`, `src/App.tsx`
(Listen copy only), and `src/components/YouTubeAnalysisPanel.tsx` (explicit Listen
fallback link only). New CSS is imported locally; do **not** edit `src/index.css`.
Read existing wire validators/clock hook; do not edit `analysisV1`, adapters,
server client, songbook data/router/auth, or existing player/tuner/mic code.

Implement direct-gesture picker/mic lifecycle, credit-based worklet transport,
source/device/gap states, rich timeline, approximate optional video anchoring,
stop/refine/playback, IndexedDB save/reload/delete and explicit exports. W provides
PCM Blob export and restore; U provides storage and WAV/player plumbing. No new
dependency or package script independently: request it from W. No main-thread DSP.

### T — independent tester, with separate triage/fixes after findings

Own **only new** `validation/live/**`, `e2e-live-listening.mjs`,
`docs/rust-live-validation.md`; none of the builders' files or existing evaluator
corpora/reports. Preserve `e2e-rust-analysis.mjs` and run it, do not rewrite it into
a mock. Tester may prepare independent fixtures and tests now, but reserve all
holdout detector runs until root freezes native/WASM source + binaries + options.

Root integrates W/U without shared file writes, then uses the separately requested
Astra high triage and Sol fixes for findings. A tester does not fix implementation,
relax gates or train against holdouts. Root owns sequencing of final DSP freeze,
artifact regeneration and musical evaluation; changes to core public API require
explicit coordination, never parallel edits from W.

## Acceptance evidence and exact resource gates

No manual QA is assigned to the user. Automated evidence must identify which
parts use genuine capture, injected PCM, mocks or unsupported environment paths.

1. **Native/WASM parity:** independently render actual f32 PCM (sine controls,
   plucked/harmonic notes, overlapping guitar voicings, silence/noise, detuning,
   attacks/releases, both rates and gains); use the frozen native CLI and actual
   browser WASM export on identical canonical samples/options. Compare identities,
   streams, unknown alternatives and boundaries exactly on stable fixtures;
   allow <=1e-5 numeric score/cents differences, reporting any identity change
   rather than hiding it behind numeric tolerance. Include all three modes,
   spelling and A4 settings. Separate comparisons for equal rolling windows and
   equal full refinement segments. Threshold-near differences need triage.
2. **Streaming properties:** random chunk partitions versus one contiguous
   resample must differ <=1e-6 in samples, with equal count/timestamps; test
   8/16/24/32/44.1/48/96 kHz, rejected rates, channel selection/cancellation,
   >12 kHz aliases (>=40 dB attenuation on documented test frequencies), impulses
   and long phase continuity. Test notes held through many window seams, true
   silence gaps, nearby repeated plucks and staggered strums. No seam-only
   duplicates, erased prefix, crossed gap or silent mono/poly remapping.
3. **Real browser worker:** feed a known independently generated or prerecorded
   guitar fixture through a real AudioBufferSource → worklet → ingestion → WASM
   graph in paced real time; assert notes/harmony appear **before Stop**. No
   mocked detector, precomputed labels or fake worker. Compare expected labels
   separately from plumbing; report native musical misses honestly.
4. **Actual capture:** on an isolated browser profile, serve a fixture in another
   tab and exercise actual `getDisplayMedia` with browser automation-supported
   selection/audio; exercise fake-device-file `getUserMedia` separately. Verify
   actual audio track/settings and observed fixture signal. A WebAudio injection
   alone is not display capture evidence. Picker denial, video-only selection,
   track ending and unsupported capability paths may use controlled browser/API
   stubs and must be labeled as lifecycle tests. If the environment cannot expose
   real tab audio, record that acceptance gap; do not ask the user to finish QA.
5. **End-to-end:** capture → changing live timeline → Stop → bounded refine →
   local playback → Save → reload results/audio → delete; also metadata-only save,
   quota failure, cancel while permission is pending, live and refine cancellation,
   immediate restart, stale replies, wrong generation, late stream cleanup,
   option/source switches, device removal, mute/context pause and page unmount.
   Assert all owned tracks including video end, contexts close and workers/ports
   terminate. Spy on network: no capture/audio content or local session sent out.
6. **Static/full preservation:** clean npm-only build without Cargo on PATH;
   plain static serving of `dist` without Vite API middleware or Node backend;
   Listen works while `/songbook` stays locked for 404, HTML and invalid session
   responses even with old Songbook local data. Full app keeps authenticated
   uploads, YouTube paths, captions/lyrics, save/reload/hash reattachment and
   manual timing. Existing tuner/practice and real Rust e2e pass. New isolated
   Docker build/run uses only test ports/data; no daily-driver or production host.
7. **Interface:** one desktop (1280 px) and narrow (360 px) browser pass for focus,
   keyboard access, visible Stop/errors, saved-state honesty and no page overflow;
   fixes then one confirming pass. Include built worker/worklet/WASM URLs, MIME,
   missing-asset failure and non-root base-path evidence.

Hard enforced bounds: 8 transferable input buffers; 10.24 s ring; one running +
one pending analysis window; 300 s PCM/30 min wall session; 64 segments; event and
metadata caps above; 120 s refinement; 5 s live-call watchdog. Compile WASM with
maximum linear memory **128 MiB** (`--max-memory=134217728`, recorded target-only
linker flag), catch traps and retain a partial session. Application-owned JS/PCM
buffer budget is **96 MiB**: account for canonical chunks, transfer/refinement copy,
export Blob and WAV copy; serialize expensive operations so they do not coexist.
Expose byte counters; this does not claim a hard cap on browser-native AudioContext,
Blob storage, YouTube iframe or total browser process memory. Termination releases
the WASM instance; GC timing is measured, not guaranteed synchronous.

Measure named hardware/OS/browser versions on 30 s and full 300 s polyphonic
fixtures, not just silence/sine. Record wasm artifact size/load time, p50/p95/max
window compute, signal-to-visible-event delay, queue high-water, skipped windows,
main-thread long tasks, JS buffer counts, WASM memory and process-memory delta
(state instrumentation limitations). Targets: p95 live window compute <=500 ms,
p95 steady event delay <=1.5 s, no accumulating backlog, user cancel settles
<=250 ms after handler execution, full refinement <=120 s. Report actual numbers
and failures. Measure retained memory after five start/stop/refine/discard cycles;
no growing owned buffers/tracks/workers. If the real engine cannot meet live
throughput, report the gate failure and fix/profile it; do not ship “record then
analyze” as live or silently shrink context into the known short-window defect.

Freeze source hashes, Cargo.lock, artifact manifest, native executable, browser,
options and preprocessing before independent holdouts. Re-run separate-stream
native accuracy and WASM parity after the DSP fix, without changing labels or
existing acceptance gates. Passing browser flows is additive evidence, never a
replacement for the currently failed musical gates.

## Root decisions and tradeoffs

No product permission is needed to begin these packages. Root must assign the
exclusive file transfers above, announce protocol readiness, and sequence final
artifact generation **after** the separate DSP fix. No deployment is authorized.

Deliberate limits: five-minute local captures (native server remains ten minutes),
two workers rather than a new stateful core API, checked-in generated binaries for
npm-only hosting, a short settling delay rather than unsupported instant results,
and a separate local collection rather than weakened Songbook access. The primary
remaining risks are actual portable-WASM throughput, window-local tuning/noise
variation, browser tab-audio availability/background interruption, storage quotas,
and the independently documented musical misses. Build and measure these; none
is solved by frontend polish or by changing the executable format.
