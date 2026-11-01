# Independent frozen UI acceptance — 2026-10-31

Independent Sol 6.1 high tester, working alone. All execution used the disposable
`validation/ui-final/context` source copy, never evolving root Rust. No app/runtime
implementation edits, holdouts, detector tuning, production, external database,
secrets, deployment, commits, pushes or sibling checkout changes. IndexedDB below
is a fresh disposable browser profile, not an external/live database.

## Identity and reproduction

`validation/ui-final/provenance.json` preserves the supplied inventory and all
individual file hashes. Its embedded inventory hash is
`5e614a6bad9b5488b7c8e29705833cca7187848a91a0eeea66de4ba364b92919`;
the inventory JSON file itself hashes to `8046dfd76148e33e2e6ad5d9da56b7974bdcc3755449df26fc0ed80bcaccdd3c`.
Every listed copied file was individually verified before build and afterward.
Canonical source `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`,
WASM `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`,
engine `rust-dsp-2`, Node **24.22.2**, Chromium **143.0.7499.4**.
`built-identity.json` records all 13 built files, byte-identical to root's frozen
original dist. Normal `npm run build` ran the unmodified WASM verifier, TypeScript
and Vite. No Rust installation or manifest-verification bypass was used.

Preparation errors are preserved: initially mistook the embedded inventory hash
for the JSON file hash, then assumed an incorrect aggregate serialization; both
stopped before copying. Individual SHA256 checks established the association.
The first normal build inherited the fixture's shared node_modules cache paths.
I corrected my cache isolation oversight by replacing only the owned copy's
node_modules symlink with a directory of dependency symlinks and owned `.tmp`,
`.vite`, `.vite-temp` directories. A second normal build with those private caches
passed and emitted the identical dist. Original fixtures were never edited.

Commands from repository root (servers must be started only on unused ports):

```sh
export PATH="$PWD/.tools/node-v24.22.2-linux-x64/bin:$PATH"
npm --prefix validation/ui-final/context run build
node validation/ui-final/serve.mjs
node validation/ui-final/tab-journey.mjs
node validation/ui-final/busy-traced.mjs
node validation/ui-final/empty-resume.mjs
node validation/ui-final/load.mjs
node validation/ui-final/summarize.mjs
```

`serve.mjs` owns plain static **5273** (SPA fallback plus named independent WAV
fixture) and HMR-disabled isolated module test server **5274**. It uses a private
Vite cache and no application server, backend, auth bypass or DB connection.
Focused test commands, executed inside the owned context with the pinned Node:

```sh
LIVE_BROWSER_URL=http://127.0.0.1:5274 TMPDIR="$PWD/.." \
  node node_modules/vitest/vitest.mjs run src/components/LiveListen.browser.test.ts \
  -t '300-second|links a short|saves audio atomically|requires explicit old-engine' --cache=false
node node_modules/vitest/vitest.mjs run \
  src/audio/live/ingest.worker.test.ts src/audio/live/runtime.test.ts --cache=false
```

The actual TMPDIR was the absolute `validation/ui-final` directory. Logs preserve
**4/4** selected browser cases and **14/14** focused runtime cases; two unrelated
browser cases were deselected. These are independently executed builder-authored
cases, not newly authored independent tests or quoted builder results. The extra
transport, allocation audit, tab, performance and busy-DSP probes are tester owned.

## Real built/static tab journey — PASS

`tab-1793459867501/report.json` records independently rendered 20s WAV in the
only explicitly named fixture tab -> app Start capture -> actual getDisplayMedia
-> actual worklet/ingestion/WASM -> changing DOM notes **before Stop** -> keyboard
Enter on Stop -> refinement -> actual audio-element playback progression -> Save
with audio -> IndexedDB reload -> playback -> delete. No fake microphone or
synthetic display stream was substituted. The script originally inherited three
mic-specific check labels from the earlier harness; those labels describe actual
tab resources here and are corrected in the current harness.

Real capture: one audio/one video track, **48 kHz mono**, video
`displaySurface:browser`, RMS **0.110405**. Both tracks ended, all capture/probe
contexts closed before reload, no mutation requests, no page/console errors.
Launch uses `channel:'chromium'`,
`ignoreDefaultArgs:['--disable-infobars','--mute-audio']` and automatic selection
restricted to `Fretbloom Independent Audio Fixture`. No old crashing setup,
another browser download or user/daily-driver browser capture was attempted.

`tab-1793460029110/report.json` repeats the journey with transparent allocation/
performance probes and stronger **before-reload** worker cleanup: Chrome target
discovery saw actual ingestion and nested analysis workers; switching to Practice
terminated all old main-thread worker references and both worker targets vanished.
Practice is permitted to own its separate shared engine context; this run observed
all pre-reload contexts closed and both tracks ended. This distinguishes ownership instead
of claiming that the entire app owns zero contexts. Later reload/playback/delete
also passed; mutation requests and console/page errors remained empty.

Preserved failures: `tab-1793459853507` used a nonexistent radio label (`Tab audio`
instead of `Browser tab`) and timed out before capture. The performance attempt
`tab-1793459958826` passed capture/Stop/refine/playback/Save but incorrectly asserted
zero workers after **Discard current / new capture**, which intentionally prepares
a fresh runtime. This was a harness expectation error, not evidence of a leak.
`tab-perf-attempt.mjs` retains that harness; the successful check leaves capture
mode before asserting zero worker targets. No failure record was overwritten.

Desktop 1280px and narrow 360px full-page screenshots were visually inspected.
Narrow view has no horizontal page overflow; Stop is keyboard focusable and Enter
actually stops capture. Timeline is intentionally horizontally scrollable. Basic
layout is coherent. One actionable contrast defect is documented below; no broad
UI polish or implementation edits were made. Note/chord mistakes remain DSP
accuracy findings in `rust-candidate-validation.md`, not plumbing failures.

## R1 anchoring and transport — PASS within explicit test layers

Actual fake-file microphone -> real capture/worklet/workers/WASM in the rerun
focused browser test; deliberately controlled iframe clock and replayed/delayed
transport envelopes. It rejects queued old status, releases authoritative resumed
position before any resumed patch, replays a late prior-segment patch, links within
a short resumed fragment, stops, saves strict metadata, exports valid JSON and
removes/saves the annotation. Failed Resume, repeated Resume and delayed completion
after Stop are exercised. Raw `fretbloom-anchor-fixes-*/anchor.json` retains saved
bounds and clock/transport qualifications. No actual YouTube timing claim.

The builder unit's pre-PCM empty pause/resume case was rerun. Independently,
`empty-resume.json` drives real browser ingestion/WASM using controlled port
boundaries before any PCM, then 12,288 actual generated samples. Epoch 1 reports
segment **0**, Stop has exactly one segment, export is **49,152 bytes**, no errors.
This extra probe tests the protocol in a browser; it is not an empty microphone
UI/iframe journey. The real-microphone UI cases and this protocol case are separate
layers, not a fabricated combined pass.

## R2 Save, copies and storage — PASS for application-owned accounting

The newly executed 300s focused test stores/restores **7,200,000 polyphonic
samples / 28,800,000 PCM bytes**, prepares playback, saves and rebuilds playback.
`fretbloom-save-fixes-uIwl53/300s-save.json` retains actual allocation constructors,
worker Blob reads, WAV URL revocation and UI counters. Own independent re-audit is
`independent-allocation-audit.json`, with raw evidence hash.

Baseline **58,714,112 bytes** includes the exact shared PCM Blob once. Actual WAV
ArrayBuffer and Blob **14,400,044 bytes each** coexist during synchronous
construction; this is observed separately because DOM batching can hide it.
Computed high-water **87,514,200 bytes**, below **100,663,296 (96 MiB)**, headroom
**13,149,096 bytes**. Verification peak reserves full PCM plus 32-byte digest and
has zero retained WAV. WAV URL release precedes the Save verification worker.
No full 28.8MB main-thread PCM Blob verification read; WAV reads are chunked.
Verification worker starts/stops balance. This result was executed and audited,
not adopted from the fixer's matching number.

Actual IndexedDB rerun rejects corrupt replacement before writes, preserves old
metadata and verified old audio after corruption, and rejects controlled quota
failure **after metadata put, before PCM put**, retaining verified old audio and
old title. Also covers direct persisted corruption, rename, metadata-only save,
20-record cap and deletion. Controlled quota exception is not real disk exhaustion.
Playback rebuilding after successful Save is exercised by the separate 300s case.

Counters measure declared application-owned buffers/reservations, not process RSS,
browser-native Blob/IndexedDB/WebCrypto/audio decoding allocations or GC timing.
Those native allocations and total physical memory remain unmeasured. The harness's
fixture source arrays are not mislabeled runtime-owned buffers.

## Genuine synchronous DSP cancellation — PASS

`busy.json` and stronger `busy-traced.json` restore real polyphonic 300s PCM with
explicit `legacy-test-engine` identity. UI requests current-engine reanalysis;
transparent worker instrumentation emits start immediately before calling the
real synchronous 7.2M-sample handler and completion only after it returns. Cancel
is clicked while start exists and **no completion exists**. No restore reply is
held, and no delay or fake DSP result creates the busy interval.

First run canceled state visible **34.4ms** after captured click-handler entry.
Second run also instruments the ingestion worker's actual nested Worker.terminate:
termination **0.7ms**, canceled state visible **9.8ms** after entry. Retained PCM
remains verified **28,800,000 bytes**; displayed and saved engine stay legacy.
Retry succeeds with generation **9** after canceled **8**, producing current
engine results while saved metadata/PCM remain identical. Only explicit Save
updates persisted engine identity. Raw messages, keys, metadata and timing remain
in both reports.

This is different from the independently rerun builder test that deliberately
holds a genuine restore-completion reply. That deterministic lifecycle test is
useful but not busy-DSP evidence. The historical fleeting Cancel-control failure
remains preserved in the fixer and earlier validation reports.

## Boundaries

Prior mean/left/right PCM selection, five resource cycles and root native/upload
preservation evidence remains as identified in `rust-live-validation.md` and
`rust-wasm-runtime-handoff.md`; not relabeled as new execution or final-source
musical accuracy. Native/WASM 72-case strict parity and DEV musical failures remain
in the separate candidate report. No holdout was rerun or threshold tuned.

## Measured built-app performance

`performance-summary.json` derives values from the successful instrumented static
tab run, not repeated status counters: **33 unique nested-worker result IDs**,
compute p50 **89.5ms**, p95 **127.2ms**, maximum **132.9ms**. For **33** DOM updates,
signal-frontier latency p50 **439.9ms**, p95 **479.1ms**, maximum **483.7ms**.
Definition: ingestion arrival of the first real PCM block whose end reaches a
patch's `replaceToSample` -> DOM event-list mutation adopting that patch. Absolute
`performance.timeOrigin + performance.now()` joins worker and main clocks.
Includes the intentional 320ms future window and block quantization. This is
retained-signal-frontier-to-DOM latency, **not** acoustic onset recognition latency
or physical screen frame presentation. Probe copies no PCM and fabricates no reply.
A single **57ms** main-thread long task occurred at page initialization; no live
capture long task appears in this short trace. These timings were collected while
other owned acceptance tests and the paced load were active, not on an idle device.

## Actionable visual finding — Stop hover contrast

`contrast.json` / `hover-stop.png`, independently reproduced against the real
built app. Start a tab capture, hover **Stop capture** on desktop. The button is
enabled but its text nearly disappears. Computed text `rgb(16,20,8)`;
hover background `color(srgb .560784 .788235 .486275 / .18)` over the same
`rgb(16,20,8)` control background gives contrast approximately **1.43:1**.
`live-listen.css:74` applies `.live-listen button:not(:disabled):hover` to every
button, overriding `.live-listen .live-stop`'s pink background at line 140 while
leaving its dark text. Repro command: `node validation/ui-final/contrast.mjs` with
the owned server running. Suggested root fix: restrict the general transparent
hover rule to secondary buttons, or specify an adequately contrasting hover
background/text pair for Stop. The desktop screenshot originally exposed this;
keyboard and narrow Stop still function. No substantive runtime failure or detector
quality conclusion follows from the contrast defect. Implementation remains untouched.

### Additional actual microphone UI empty-start case — PASS

`empty-mic-ui.json`, tester-authored independently from the builder case: controlled
first resume calls native `AudioContext.suspend()` as a startup gate; real fake-file
microphone, native subsequent resume, worklet, ingestion and WASM remain real.
Confirmed suspended context and a real zero-sample status before Pause. Resume then
reports epoch **1** with active segment **0**. With a separately labeled controlled
iframe clock, Link -> Stop -> Save -> JSON succeeds, retaining exactly one segment
and annotation segment 0. This establishes the empty-start UI association missing
from the protocol-only probe above. It does not claim actual YouTube alignment.

Two failed harness preparations are preserved as `empty-mic-ui-attempt{1,2}.json`
and matching scripts: Chromium's context started running even when the first
resume returned a resolved promise, so that setup correctly failed its suspended
prerequisite; the next setup really suspended it but read status before the first
500ms report existed. Waiting for that real report fixed the harness observation.
No product state, validator, detector response or saved metadata was fabricated.

## Paced 300s cap and retained refinement — CAP PASS, REFINEMENT FAIL

`load.json` preserves the first failed attempt: browser/page closed before its
final result could be serialized. No cause established; this is not a passing
five-minute test and is not blamed on evolving root sources. No raw browser
failure trace was available in that attempt.

A second actual **300-second** paced WebAudio -> real worklet -> ingestion/WASM
run uses the same generated 300s alternating mono/polyphonic phrase and exact
frozen engine, this time full Chromium channel and checkpoint reporting.
`load2.json`, `load2-checkpoints.jsonl`, `load-checkpoint-summary.json` preserve:

- Explicit real `LIMIT_EXCEEDED: Five-minute audio limit reached` at **301,182.7ms**
  harness elapsed, then source end, genuine ingestion end acknowledgment and Stop.
- Retained **7,200,000 samples**, exported **28,800,000 bytes**, strict valid Stop
  snapshot marked **partial**, with the cap's final missed-live interval preserved.
- Two retained segments: `[0,16384)` and `[16384,7200000)`, with an explicitly
  marked startup `transport_overflow`. The harness graph was connected before its
  large source decoding/allocation; its eight credits exhausted during startup.
  This marked startup gap is disclosed, not called uninterrupted perfect transport.
- Thirty periodic status checkpoints: observed runtime-owned JS maximum
  **29,884,672 bytes**, WASM maximum **2,818,048**, queue high-water **1**, skipped
  windows **0**. These are sparse checkpoints, not the exact high-water of every
  allocation or unique DSP calls. Full raw event serialization and long-task output
  were not reached because refinement rejected. Do not infer an end-to-end 300s
  DOM latency or a completed p95 compute distribution from them; the independently
  instrumented static tab run supplies separately scoped performance measurements.
- Full retained refinement was actually attempted and rejected with
  **`Local event cap exceeded`**, after export had succeeded. It is **not a 300s
  refinement pass**. The failed helper's `finally` closed its graph/context/ports
  and disposed its runtime; browser closes in the owning runner's finally.

The `BROWSER DISCONNECTED` line in `load2.log` is emitted by the runner's normal
finally-close after the recorded event-cap rejection; it is not a second unexplained
browser crash. The first attempt remains separately unattributed.

`process-memory.jsonl` is a separate late Linux process-tree sample: nine owned
browser child processes summed to **1,070,340 KiB RSS**. There is no prelaunch
baseline/delta; shared pages can be counted repeatedly. This is neither exclusive
physical memory nor browser-native-only memory and cannot be compared with the
96 MiB application buffer cap. Browser native backing stores, allocator/GC timing
and exact process peak remain unvalidated. All source fixture arrays and stereo
AudioBuffer allocations belong to the harness; no such bytes are labeled runtime-owned.

### Actionable retained-refinement finding — aggregate frame cap at segmented 300s

`segmented-cap.json` independently reproduces the failure without five minutes of
pacing. Command `node validation/ui-final/segmented-cap.mjs` against the owned
module server: construct real 300s PCM, restore strict partial metadata with the
two exact paced-stop extents above, then request actual Rust refinement. A
transparent nested-worker postMessage probe records actual result sizes:

- 16,384-sample segment: **9 alignment frames**, one harmony span, no notes.
- Remaining 7,183,616 samples: **3,742 frames**, three harmony spans, one mono note.
- Total **3,751 frames**, exceeding `parseLocalAnalysis`'s aggregate **3,750** bound
  at `src/audio/live/validation.ts:242`. Note/harmony counts are nowhere near their
  own caps. This isolates segment-edge frame rounding from musical complexity.

Both actual DSP calls complete (about 37ms and 10,317ms in this probe); the final
aggregate validator rejects before adoption. Previous stopped snapshot remains
identical; exported **28,800,000-byte** PCM retains its verified original hash.
The first quick-probe attempt omitted restore's AbortSignal; its harness failure
is retained as `segmented-cap-attempt1.json` and script, then corrected.

Root action: resolve the full-length segmented alignment-frame budget/serialization
interaction while keeping validated bounds and genuine per-segment timing. Do not
silently truncate frames, merge across the recorded gap, bypass the validator or
relax this acceptance result. Repro uses frozen fc324/52205; it does not characterize
the temporal builder's evolving replacement core. A final product acceptance is
withheld for this failed retained-refinement gate and the Stop hover contrast issue.

## Closeout and remaining limits

No user manual QA is requested. App/runtime files remain read-only. Original
source fixture and owned copied inventory hashes are rechecked by
`verify-identity.mjs`; artifact inventory is `built-identity.json`, final source
check `final-identity.json`, evidence hashes `evidence-sha256.json`. All owned
browsers and the 5273/5274 server are stopped at handoff.

Passed: built/static actual tab end-to-end local journey, visual/narrow/keyboard
operation with the contrast exception, R1 delayed/stale/failed/repeated/late Resume
cases and independent real-mic empty-start anchor case, R2 executed 300s allocation
and storage rollback, genuine busy-DSP cancellation and explicit-save-only retry,
and paced cap/partial/export behavior. Failed: segmented 300s full refinement;
Stop hover contrast. Unvalidated: attribution of the first browser closure, exact
300s per-call/DOM/long-task distribution after the failed serialization, physical
memory peak/native-only allocation and every MessagePort's direct browser resource
count. The scoped short-tab per-call/DOM timing, application-buffer ownership
bound and before-reload track/context/worker cleanup are measured independently.
Broader device/browser coverage and already documented musical failures are not
waived by these passes.

## Root follow-up: segmented refinement and Stop contrast

The two actionable findings above were fixed after the independent handoff. This
section records root's verification separately; it does not rewrite the original
failed acceptance or claim a new independent review.

`parseLocalAnalysis` now bounds alignment frames for each segment by
`ceil(segmentSamples / (sampleRate * hopSeconds))`. Both values remain fixed by
the existing strict schema at 24 kHz and 0.08 s. The 300-second/64-segment limits
therefore permit at most 3,813 frames, including independent partial segment
tails. A single segment still permits only 3,750. No frame, timestamp, gap, audio
sample, or result is discarded, and the 2 MiB metadata and note/harmony limits
remain unchanged. Two regression tests cover the reported 9 + 3,742 case, the
64-segment maximum, and rejection of an extra off-cadence frame. All four local
validator tests pass; the new cases reproduced the old rejection before the fix.

Stop's hover rule now preserves an opaque pink background and dark text instead
of inheriting the generic translucent button hover background.

Evidence is in `.tools/root-ui-fixes/`: `provenance.json`, `check.mjs`,
`serve.mjs`, `report.json`, `build.log`, and `stop-{1280,360}.png`. The disposable
context derives from `.tools/ui-acceptance-fc324-r1r2/context` with only the two
validator files, Stop CSS, and test/lint discovery configuration overlaid. The
normal pinned `npm run build` passed WASM verification, TypeScript, and Vite for
source `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`
and WASM `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`.
No generated manifest or DSP output was altered for this check.

The actual Chromium 143 browser runtime restored the reported 7,200,000-sample
two-segment PCM and completed genuine WASM refinement in 9,205.3 ms. It emitted
one refined event with **9 + 3,742 frames**, unchanged segment extents, no error
events, and the original verified 28,800,000-byte PCM. Strict JSON serialization
and reparsing preserved every frame. This is one full-context timing observation,
not a five-minute live latency distribution or musical accuracy result.

The built app captured real audio from the fixture tab. Computed Stop hover
contrast was **6.77:1** at both 1280 and 360 px widths, with an opaque background
and no horizontal overflow. Keyboard Stop reached Review and save. Root inspected
both saved screenshots after the fix; no additional visual changes were needed.
All owned browsers and the 5283/5284 server were closed afterward.

The current working tree's `npm run check:fast` passed lint, typecheck, three
independent fixture checks, and 237 Vitest tests, with seven expected opt-in/DB
skips. One actual WASM/native association test correctly failed because the
temporal DSP builder had already changed core sources while the published
artifact remained fc324/52205. This is not an all-green current-source build;
regeneration and integration checks must follow that builder's source freeze.
A full-check attempt inside the hidden disposable `.tools` context stopped at
lint's “No files found” rule; it is not counted as a suite pass. Archived context
copies are now excluded from normal test/lint discovery without excluding the
intentional validation suites. The new browser result and normal frozen build
are recorded independently of those full-suite limitations.

The segmented-refinement and hover findings are resolved by these scoped checks.
The musical failures, original browser-closure attribution, full 300-second live
performance distribution, physical-memory peak, and direct port counts retain
their earlier limitations.
