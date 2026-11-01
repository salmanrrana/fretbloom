# Independent live listening validation

2026-10-31, tester T. **Development evidence only; acceptance remains incomplete.**
Owned files are `validation/live/**`, `e2e-live-listening.mjs` and this report.
No holdout detector was run. Existing corpora/scorers/reports and implementation
files were not edited. No production, daily-driver server, commits or deployment.

## Reproducible checks

From this checkout:

```sh
node --test validation/live/fixtures.test.mjs
npx vitest run validation/live/properties.test.ts validation/live/timeline.test.ts --reporter=verbose
node e2e-live-listening.mjs --properties --static --capture-probes
node e2e-live-listening.mjs --properties --graph --restore
node validation/live/preservation.mjs
```

The runner owns an OS-assigned loopback static port and, when needed, an ephemeral
Vite harness with **no app middleware**. The static checks serve the existing
fingerprinted `dist`, never Vite preview. Preservation uses only 5230/5231 and
terminates its own processes. It runs the existing `e2e-rust-analysis.mjs`
unchanged, with its output working directory under `validation/live/runs`.
No package/dependency changes are needed. Exit 1 means a check failed; exit 2
means unfinished acceptance, including deliberately pending checks.

Engine commands first run `scripts/wasm-verify.mjs`; rejection prevents engine
calls by default. For browser plumbing only, root's already verified development
artifact can be pinned with the following explicit historical record. The runner
verifies all five generated files byte-for-byte, including the original manifest,
against that successful normal-verifier run. It still records current-source
rejection and makes no current-source claim. This option cannot enable parity:

```sh
node e2e-live-listening.mjs --properties --graph --restore \
  --recorded-development-artifact=validation/live/runs/2026-10-31T14-46-15.290Z/report.json
```

Parity additionally requires root's independently recorded matching native
build identity, not an assumption based on `engineVersion`:

```sh
LIVE_NATIVE_BIN=path/inside/this/checkout/to/copied-analyze-pcm \
LIVE_NATIVE_SOURCE_HASH=SOURCE_HASH_FROM_MATCHING_BUILD_RECORD \
LIVE_NATIVE_SHA256=EXECUTABLE_HASH_FROM_THAT_RECORD \
node e2e-live-listening.mjs --parity --properties --graph --static
```

Do not populate those identities by copying current manifest/hash values without
establishing the native build's source association. Root owns final freeze and
artifact regeneration. The initial exploratory parity run predates these guards;
it is explicitly inconclusive below. All generated media are development controls,
not an independent holdout or human-played guitar corpus.

## Executed evidence

Hardware: Linux 7.0.0-42-generic x86_64, Intel i7-1165G7 (8 logical CPUs).
Node observed `v24.22.1`, below the requested `24.22.2` pin; do not claim a
pin-exact environment. Exact browser version and before/after per-file SHA256
inventories are in each `runs/<timestamp>/report.json`. Source was changing.

| Check                           | Actual evidence and limitation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent fixture renderer    | 3 Node checks pass. A3 crossing-count control, finite/bounded gains, silence, exact f32le serialization, deterministic partitions, comparator sensitivity. Labels are renderer MIDI/onset/release truth, never detector predictions.                                                                                                                                                                                                                                                                             |
| Resampler                       | 19 property checks pass: 8/16/24/32/44.1/48/96 kHz arbitrary partitions <=1e-6; exact floor counts; centered impulse timing; 44.1 kHz fractional phase through 3.013 seconds; invalid rates/nonfinite data rejection. At 32/44.1/48/96 kHz, 14/15/16/18 kHz tones attenuate >=40 dB against equal-amplitude 997 Hz controls (128-sample edge exclusion). This is a documented subset, not every stopband frequency.                                                                                              |
| Shared wire/storage metadata    | Partial block and real-gap extent checks pass in the later property run. Uses W's strict validators, including `parseLocalAnalysis(unknown)`, without shadow local schema.                                                                                                                                                                                                                                                                                                                                       |
| Rolling ledger                  | 4 authored-evidence unit tests pass: held-note prefix/onset/ID over many seams; release and segment gaps; explicit mono/poly separation; skipped spans remain unknown; diagnostics preserved and invalid extents rejected. These are ledger tests, not a mocked-engine browser journey or proof of Rust seam accuracy.                                                                                                                                                                                           |
| Static Songbook fail-closed     | Existing `dist` rejects SPA HTML, controlled 404 and invalid JSON session responses even with old local Songbook data. No private title rendered. The latter two are explicitly auth fault fixtures. Fresh final build still pending.                                                                                                                                                                                                                                                                            |
| Actual fake-device mic          | Chromium `getUserMedia`, WAV file fake device, actual audio track: RMS 0.11375, dominant bin 210.94 Hz, context/device 44.1 kHz, 2 channels; all tracks ended/context closed. This is a browser capability probe, not application mic-flow acceptance.                                                                                                                                                                                                                                                           |
| Actual tab sharing              | Headless `getDisplayMedia` returned `NotSupportedError: Not supported`. Headed isolated retry ended with browser/page closure. Neither is successful tab audio capture. WebAudio injection is not offered as a replacement.                                                                                                                                                                                                                                                                                      |
| Actual paced graph, exploratory | Run `2026-10-31T14-44-12.008Z`: real AudioBufferSource → actual worklet → actual ingestion/analysis workers → generated Rust WASM; 11 timeline patches **before Stop**, first patch at 1761.9 ms, MIDI 57 observed. Captured/exported count 197,120 samples, 97 blocks including final 512-frame partial. Real ingestion end acknowledgment received before stop/export. Source changed and verifier rejected association afterward: this is exploratory plumbing only, not accepted verified-artifact evidence. |
| Exploratory parity              | Run `2026-10-31T14-42-51.881Z`: 72 actual native/browser calls, all 3 modes × 2 spellings × 432/440/446 Hz × full segment/rolling window/silence/60 ms tone. 47 agreed, 25 differed, including alternatives/evidence/notes. **Inconclusive:** native/source changed during the run; no matching source freeze. Preserve raw outputs; do not triage these as portable-DSP defects without rerunning matched binaries.                                                                                             |

Exploratory WASM SHA256:
`9bc07b3df39d523e82082709da6202f43cebf2e46743062a28220ff7f937a706`.
Initial parity native executable SHA256:
`a7b6a952dc6171da3aa6dc6bf0af12fd76c2f1856545292d8d3c50f1ac3dff57`.
Common engineVersion did not establish source identity. No accuracy gate is
inferred from agreement or from the MIDI 57 example.

Recorded graph's last status: 117.9 ms window compute, 2,818,048 WASM bytes,
1,900,800 accounted JS bytes, queue high-water 1, skipped windows 0. This is a
single short observation, **not** p95/30s/300s load evidence. Missing optional
counters must remain unavailable, not become zero. `ownedJsBytes` is app-owned
buffers only; it excludes browser-native/process/GC memory.

## Prioritized findings for root triage

Latest verified-artifact development graph: `2026-10-31T14-46-15.290Z`.
Normal verifier passed source hash
`27bd0ebf37649a3fa60051971e7111a88b5e4ac9ce79905c3bb451a77989492e`;
WASM SHA256
`198ab7fa22199b2565d3da182d4e90a7c9233cae2b42246dba0accdfd4279327`.
Actual runtime produced 11 patches before Stop, with changing MIDI evidence
57 → 48/52/55, retained 197,376 samples including final 768-frame partial, and
passed the same real worklet→ingestion acknowledgment/count check. All 25
resampler/wire/ledger properties and static fail-closed checks passed in this run.
Full source inventory changed during this development run; this is verified
development-artifact plumbing evidence, not a unified source freeze or musical
accuracy result. MIDI 60 from the renderer's chord did not appear in the observed
live MIDI union; that musical miss is not concealed by the successful flow.

The next `--graph --restore` run (`2026-10-31T14-46-58.007Z`) correctly refused
engine calls after DSP resumed editing and verification rejected drift. The new
`restoreLifecycle` harness was pending at that checkpoint. It uses an explicitly
metadata-only historical-engine fixture, actual workers/PCM SHA verification and
actual Rust for opt-in refinement. It checks default mismatch rejection, identity
retention before refinement, dispatch cancellation preserving the old snapshot,
successful explicit opt-in and bad-hash failure. Mid-DSP cancellation, historical
rich results, browser persistence and refinement-error rollback remain pending.

**Latest actual-worker restore run:** `2026-10-31T14-48-06.692Z` passed
`--graph --restore --properties` against the historically verified, unchanged
development artifact, with all five generated files checked against the original
normal-verifier record. Current source drift was recorded, never relabeled as a
current-source verification pass. `restore-lifecycle.json` confirms default engine
mismatch rejected, historical identity retained until refinement, dispatch cancel
left the previous snapshot unchanged, explicit opt-in produced validated current
`rust-dsp-2` results, bad PCM hash rejected and caller-owned saved metadata remained
unchanged. This does **not** establish IndexedDB saved-record rollback, rich
historical-result preservation or cancel while synchronous DSP is already busy.
The real paced graph/partial-tail check and all 25 property tests also passed.

One ledger test expectation was corrected after implementation tightened missed
coverage: the skipped interval begins at the previous analyzed end (23,040),
rather than settled-through (15,360). The already analyzed mutable tail is not a
missing interval. The test still requires unknown coverage and separate streams.

**Preservation failure requiring root triage:** the unchanged real
`e2e-rust-analysis.mjs` timed out after 180 seconds waiting for the first saved
upload result (`settled`, line 52; caller line 90). Isolated capabilities returned
200 and the form/save actions completed, but the expected persisted analyzed song
did not appear. Evidence: `runs/preservation-1793457840426/result.json`; backend
log was empty. Vite received ongoing UI source updates during this run. Reproduce
with `node validation/live/preservation.mjs` after builders settle, then inspect
actual upload/job/save errors; this run does not isolate the cause. Both owned
5230/5231 processes were closed. No full-app preservation pass is claimed.

**Actual UI/storage follow-up:** `node validation/live/ui-journey.mjs` uses a
separate 5230 server/profile, HMR disabled and the exact recorded development
artifact hashes. First run `ui-1793458195979` observed A3 then C3/E3/G3 in the
visible timeline before Stop, 360px Stop reachable with zero page overflow,
actual mic track ended on Stop, refinement, local WAV playback, and real IndexedDB
save→reload→open→playback→delete. Saved PCM was 359,424 bytes; metadata 6,806 bytes,
engine `rust-dsp-2`, completeness `refined`. No network mutation requests occurred.
The overall test failed at an overbroad cleanup assertion that also counted the
practice engine's context; a confirming run scopes closure to LiveCapture-owned
contexts and records context creation stacks. This correction does not waive a
capture-context leak. Nested-worker/port accounting remains separate.

**New UI finding for root's separate triage:** repeated React duplicate-key
errors for held note `0:mono:57:6240`, with three visible A3 spans after a seam.
Repro: the UI command above, sine A3 followed by independently rendered plucked
C-major voicing. Relevant owners/files: U's `LiveTimeline.tsx` patch composition
and rendering; W's note IDs/rolling patch extents. Do not infer the precise owner
without tracing the actual patch and resulting retained items. The confirming
run captures console errors and exact before/after frontend source hashes.

**Known accepted core endpoint defect:** root's lengths 65,536 and 61,696 at
24 kHz produce a rounded final feature time slightly above duration. Treat this
as a real Stop/refine failure even where other input lengths pass. Strict TS
validation remains unchanged. Invalid `LocalAnalysis` must not be saved/exported
as successful analysis; preserve retained PCM and valid live evidence for
WAV/refinement recovery. Exclusive DSP owner is fixing the endpoint and irregular
length tests; W must regenerate guarded artifacts before independent reruns of
those exact lengths. No old-artifact success can validate that future fix.

1. **Final matched native/WASM association blocks acceptance.** The current
   verifier reports source/tool drift while DSP work continues. Freeze source,
   build native snapshot and regenerate WASM together, record both identities,
   then rerun parity. Do not relax numeric/identity gates to accept contaminated
   exploratory comparisons. Comparison is exact for MIDI/identities/streams,
   alternatives, labels and boundaries; only score/margin/cents/RMS/chroma floats
   receive <=1e-5 tolerance.
2. **Actual tab audio remains unvalidated in this environment.** Repro command
   above with `--capture-probes`, optionally `--headed-capture`; inspect
   `tab-capture.json` and process error. This capability failure must stay separate
   from app behavior and microphone/WebAudio evidence.
3. **Earlier partial-tail incompatibility, subsequently fixed by builders.**
   Initial wire parser required a complete 2048-frame buffer while worklet
   `flush()` sliced partials. Focused repro is the last test in
   `validation/live/properties.test.ts`. Original run failed with
   `Invalid capture block byte length`; later run passes. No tester implementation
   fix was made. Confirm again against the frozen worklet/ingestion pair.
4. **Concurrent source edits invalidated one browser run.** The first graph was
   interrupted by Vite HMR navigation. Harness HMR is now disabled. Source/artifact
   fingerprints still must remain stable for acceptance.

## Exact remaining acceptance work

This is the handoff list, not a claim that the harness implements every test.
Root should launch a fresh actual recheck after W/U are ready. No manual QA is
assigned to the user.

Strict standalone TypeScript checking of the four test/harness `.ts` files passes
with TypeScript 6 `--ignoreConfig --noEmit --strict`, bundler resolution and
`vite/client,node` types. No `any`, alternate local wire schema or unchecked JSON
type cast was introduced. Optional old-engine restore tests are behind
`--graph --restore`; full IndexedDB/UI saved-record preservation is still a
separate acceptance requirement.

| Contract area                      | Remaining actual check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified graph and channel truth   | Run `--graph` after verifier succeeds; exercise mean/left/right against distinct stereo signals. Worklet selects explicit mono once; ingestion records selection, does not select twice. Assert changing note sets/harmony before Stop separately from expected-note accuracy. Exact full block + partial counts and ingestion-originated end acknowledgment must survive cross-port Stop race. Existing harness tests mean and orderly acknowledged Stop; selected L/R and premature/cross-port races are pending. |
| Native/WASM parity and correctness | Matching source/config/binaries, both whole refinement segments and equal rolling windows; extended independent dev signals/noise/gains/rates/weak fundamentals. Separate renderer-label note precision/recall, octave and chord/bass truth from parity. Existing 72-case matrix is an initial subset. No holdout detector until root freezes.                                                                                                                                                                      |
| Scheduler/late work                | One running/one pending, missing-live extents, >3s lag ×3 reports, 5s watchdog, short fragments <0.64s abstain in live/refine, actual early/late/stale replies, cancel during synchronous Rust, <=250ms handler-to-settle, fresh worker reuse, stopped PCM preservation.                                                                                                                                                                                                                                            |
| Capture lifecycle                  | Actual app tab and fake-file mic signal/track settings; permission late resolve/cancel, denial, no audio, video ended, device removal, mute/unmute, context suspend/resume, background/source/options changes, immediate restart/unmount/pagehide. Only permission/unsupported/no-audio faults may use labeled lifecycle stubs; no fake worker/engine. Count video/audio tracks, contexts, ports and workers through disposal.                                                                                      |
| Storage and UI                     | Actual browser IndexedDB capture→Stop→refine→playback→save→reload→delete, metadata-only, title/rename, hashes, old engine results readable without relabeling, unavailable audio, stale generations. Injected quota failure must be labeled separately from actual transactions. No false Saved status. No outbound capture/session payloads. Refined evidence renders over historical missed-live diagnostics; patch diagnostics replace only their segment's set.                                                 |
| Hosting/preservation               | Fresh npm-only build without Cargo, plain static `dist`, Node MIME, emitted worker/worklet/WASM and non-root base paths, missing WASM failure, real unchanged Rust e2e, tuner/practice, upload/YouTube/captions/lyrics/manual timing. Isolated Docker still pending. Never use W5203/U5202/daily-driver ports.                                                                                                                                                                                                      |
| Interface                          | Desktop1280/narrow360 reachable Stop, adjacent persistent errors, keyboard/focus unchanged by updates, readable event list, no page overflow. Actual UI still under construction during this pass.                                                                                                                                                                                                                                                                                                                  |
| Load and cleanup                   | Independently rendered polyphonic 30s and 300s controls (`phrase(seconds)` can render both); real-time paced graph and refinement; p50/p95/max compute and evidence delay, main-thread long tasks, high-water/drops, owned JS and WASM bytes, process-memory delta with limitations. Targets p95 compute <=500ms, delay <=1.5s, refinement <=120s, JS<=96MiB/WASM<=128MiB. Five complete cycles with owned resources returning to baseline. No long-load or five-cycle claim yet.                                   |

Final acceptance must also retain the 8-buffer/10.24s ring/300s PCM/30min wall/
64-segment/event/metadata/1024 missed-interval limits. Invalid supplied diagnostics
must be rejected; IDs <=160 characters and stable across clipping/seams. Counters
need direct instrumentation validation, not simply an assertion that a reported
number is below its cap. Browser-native AudioContext/Blob/iframe and process
memory are not covered by app buffer counters.

## Latest handoff and publication window

No tester browser/engine run is active; W can publish after DSP completes the
disclosed partial spectral edit and focused check. No further known-bad-artifact
runs are authorized by this handoff. The exact endpoint regression is prepared:

```sh
# Only after W reports new guarded hashes and normal verification succeeds:
node e2e-live-listening.mjs --offgrid --properties
```

This sends independently rendered 440 Hz PCM of exactly **65,536 and 61,696**
samples through a real ingestion MessagePort, bounded credit exchanges, actual
analysis worker/WASM, actual end acknowledgment, Stop, retained PCM export and
refinement. Strict production parsers validate every result. It is a **PCM-port
worker test**, not worklet/microphone/tab capture. It rejects worker errors,
lost samples, incomplete refinement and any final feature timestamp above exact
duration. It has not yet run against the pending endpoint-fixed artifact.

After that normal-verifier run provides a new recorded artifact inventory, use
`LIVE_VERIFIED_RECORD=validation/live/runs/<new-run>/report.json node
validation/live/ui-journey.mjs` for an actual mic/worklet/UI/IndexedDB recheck.
The environment variable selects a verified record, never skips byte validation.

Confirming actual UI run **`ui-1793458265650` passed**, with no console errors,
page errors, outbound mutation requests or frontend source changes. Actual saved
PCM was 300,032 bytes; rich metadata 6,591 bytes, `rust-dsp-2`/`refined`; reload
and playback verified it before collection deletion. The earlier duplicate-key
warning was not reproduced in this stable-source run; preserve its evidence for
root triage rather than silently removing it. Exact identities are in the report.

Cleanup limitation found while reviewing the harness: reload resets its browser
resource-reference arrays, so the successful post-reload cleanup assertion only
counts post-reload workers/contexts. The observed running context belongs to
PracticeChordMode's shared engine. A non-vacuous LiveCapture-context closure
assertion **before reload** is now prepared but has not run on the pending new
artifact. Owned mic track ending was actually checked before reload. Nested
workers/ports, PCM-store deletion count and five-cycle resource cleanup remain
unvalidated.

U separately reported Resume instability and successful reanalysis failing after
cancellation with HMR blocked. These remain open product findings; this tester
has not independently reproduced or waived them. Preserve old metadata/records
and PCM on every error. Full actual tab capture, quota fault handling, long loads,
final matched native/WASM parity and holdout acceptance remain pending as above.

## Fixed endpoint development recheck

Run `2026-10-31T14-54-29.986Z`, command
`node e2e-live-listening.mjs --offgrid --properties`, **passed the exact real-worker
Stop/refine endpoint regression**. Normal source/artifact verification passed;
the complete fingerprint inventory and WASM bytes stayed unchanged throughout.
Chromium `143.0.7499.4`, Node `24.22.1` (Node pin mismatch remains disclosed).

- Development source hash:
  `c2dcca24b80554f3c81ef2fc620d7b87a56694c6a2426a9f3664dd50ad1f7f6a`
- Actual WASM SHA256:
  `abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2`
- Engine `rust-dsp-2`. At **65,536 samples**, retained PCM was **262,144 bytes**;
  final feature time equaled exact duration **2.7306666666666666 seconds**.
- At **61,696 samples**, retained PCM was **246,784 bytes**; final feature time
  equaled exact duration **2.570666666666667 seconds**.
- Both stopped snapshots were `live`; both full refinements were `refined` with
  a valid single-segment result. No worker errors occurred. Existing strict
  validators remained unchanged. All 25 resampler/wire/ledger properties and
  3 fixture checks also passed.

Raw evidence: `validation/live/runs/2026-10-31T14-54-29.986Z/offgrid-stop-refine.json`
and `report.json`. This verifies the two concrete endpoint repros on the fixed
development artifact through actual ingestion/analysis workers. It is PCM-port
evidence, not a fresh real-mic/worklet or tab-capture journey. The original defect
and old failure evidence remain in this report. The runner exits 2 because other
acceptance areas remain explicitly pending; that is not an off-grid test failure.
No final source freeze, independent holdout or new music-accuracy claim is implied.

## Independent Sol 6.1 HIGH checkpoint pass — 2026-10-31, 14:57 UTC onward

This is a new independent tester pass after T's preparation. Earlier evidence is
preserved above. All commands use `.tools/node-v24.22.2-linux-x64/bin/node` and
matching PATH. No implementation, corpus, label, lock, production, database,
commit or deployment changes. No holdout detector. No current UI fix is accepted
from these historical checkpoint results. Root's R1/R2 and intermittent detached
Cancel-button findings remain open pending independently identified fixes.

### Proven native/source and browser artifact association

`validation/live/runs/independent-fixed-20261031/native-association.json` records
the complete checkpoint inventory before and after a **fresh compilation** from
`.tools/wasm-checkpoint/context/Cargo.toml`, exact command, compiler versions and
binary SHA256. `--locked --release -p fretbloom-analysis --bin analyze-pcm` used
explicit Rust 1.89.0 cargo/rustc/rustdoc and an owned `native-target` directory;
no shared target lock. Build completed in 38.94 s. The source inventory was
unchanged. Native SHA256:
`e3c00790bd8b63fdd934805c5a10af3b029b833d4a94ef6a36b50a2777c69dae`.
This association does not rely on W's copied executable or engineVersion.
The checkpoint's normal verifier passed (raw `snapshot-verifier.txt`).

An owned copy under that run's `context/` provides frozen browser sources and
artifacts, with a symlink to local test dependencies. The original checkpoint
was never edited. Every normal-verifier browser run identifies source
`c2dcca24b80554f3c81ef2fc620d7b87a56694c6a2426a9f3664dd50ad1f7f6a`
and WASM
`abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2`,
engine `rust-dsp-2`. Browser Chromium 143.0.7499.4. This is the endpoint-fixed
**development checkpoint**, not a final freeze and not moving current DSP.

Run paths below beginning `context/` are relative to
`validation/live/runs/independent-fixed-20261031/`.

- `context/validation/live/runs/2026-10-31T14-58-18.485Z/`: normal verifier,
  fixture tests, all property tests, and exact **65,536/61,696** worker
  ingestion/end-ack/Stop/export/refine tests passed with Node **24.22.2**.
  Strict production parsers were unchanged. This ran before parity/graph tests.
  It is PCM-port evidence, explicitly separate from capture graphs.
- `context/validation/live/runs/2026-10-31T14-58-31.873Z/`: **72/72 native versus
  actual browser WASM comparisons passed**, using the freshly built native CLI.
  All three modes, both spellings, 432/440/446 Hz and full/rolling/silence/60ms
  shapes were compared. Identities, boundaries and streams remain exact; only
  the established floating-evidence comparator tolerance applies. Raw per-call
  native/WASM outputs, PCM and hashes are retained. The real paced
  AudioBufferSource→worklet→ingestion→analysis-worker→WASM graph also passed,
  with note evidence before Stop, final partial block and ingestion-originated
  end acknowledgment. Old-engine default rejection, explicit opt-in, snapshot
  retention on dispatch cancellation, fresh restore/reanalysis and bad-hash
  rejection passed. This cancellation is **at dispatch**, not established
  cancellation during synchronous DSP. No musical accuracy claim follows parity.

Two initial runner setup failures are retained in `14-58-05.236Z` and
`14-58-09.995Z`: Node refused recursive copying into a descendant and the owned
mirror initially lacked its dependency link. These were harness setup errors,
not product failures; the final complete endpoint/property run above supersedes
neither old evidence nor product gates.

### Actual mic, built static app and preservation

`validation/live/runs/ui-1793458784173/report.json` passed on frozen checkpoint
sources with HMR disabled, with exact before/after frontend SHA256 inventories
and no source changes. It observed changing real fake-device-file microphone
notes before Stop, desktop 1280 and narrow 360px keyboard-reachable Stop with no
page overflow, real owned mic tracks ended, **nonempty capture-owned AudioContext
set closed before reload**, refinement, playback, actual IndexedDB audio+metadata
save/reload/playback/delete, route cleanup and no outbound mutation requests.
Main-thread worker instrumentation excludes nested workers/ports; five-cycle
resource accounting is not established. Source-served evidence is distinct from
the following fixed built-assets run.

`validation/live/runs/static-independent-1793458835116/report.json` passed with
**plain HTTP serving of checkpoint dist**, no Vite/API/backend application:
real fake-file mic→emitted worklet/workers/WASM, changing visible music before
Stop; 360px **Enter-key Stop**, refinement, playback, save/reload/playback/delete.
All requested built assets and MIME types are recorded and hashed, including
emitted WASM matching `abd14...`. A controlled missing-WASM 404 visibly failed
engine preparation. No capture/session network mutations occurred. Built main JS
SHA256 `93a68f1ef7ea396f6ac507f284b0e0328d4a0bf1b2767a23027f5de33ae73208`;
index SHA256 `6defc2fc55774fe0fb45fd9f4c51a40acb2374c55273be9efc4500d3c5036a12`.
The matrix run also passed built Songbook fail-closed against HTML/404/invalid
session fixtures with old private local data. A non-root-base rebuild and fresh
npm-only build remain untested in this pass.

`validation/live/runs/preservation-1793458742812/result.json`: **status 0** for
unchanged `e2e-rust-analysis.mjs`. The owned harness used ports 5230/5231, HMR off,
and documented disposable FFPROBE_PATH. Raw stdout and API response statuses are
retained in `independent-fixed-20261031/preservation.log` and `service.log`.
This reproduces successfully after the previous 180s timeout; it does not assert
the cause of that historical failure. Upload result, playback, lyrics/manual
clock, verified audio reattachment and replacement timing behavior passed the
existing script. This preservation run uses the current existing backend binary
and source-serving frontend; it is not checkpoint-native musical evidence.

### Actual tab-audio environment gap — two new concrete approaches

The runner now requests Playwright's **full Chromium** (`channel:'chromium'`),
rather than the default headless shell. Fresh profiles contain only the fixture
and capture probe. The fixture has title **Fretbloom Independent Audio Fixture**
and actively plays its WAV; selection is constrained by
`--auto-select-tab-capture-source-by-title` (the Chromium automation switch).
Primary reference: [Chromium capture browser tests](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/media/webrtc/webrtc_getdisplaymedia_browsertest.cc).
No daily-driver tabs/audio, unrelated screen selection, display/service changes
or installs were used.

Both **full Chromium headless** and **full Chromium headed on existing display
`:1`** crashed with **SIGSEGV**, `page.evaluate: Target page, context or browser
has been closed`, during real getDisplayMedia. Exact launch flags/profile paths,
process logs and stack traces are in `independent-fixed-20261031/`
`full-chromium-headless.log` and `full-chromium-headed-X1.log`; corresponding
runs `2026-10-31T14-57-57.259Z` and `2026-10-31T14-58-27.111Z`. Both separate
fake-file microphone probes passed. **No real tab audio track or known signal
was verified.** This remains an environment/acceptance gap; mic, synthetic PCM
and successful API presence do not replace it. Root needs a working isolated
Chromium display-audio environment; no manual user QA is assigned.

### Open fix-specific and broader acceptance work

R1 still needs an independently identified post-fix frontend build and an actual
resume→status advances before delayed patch→anchor attempt→Stop→save/export
journey, including late previous-segment patches and resumed segments shorter
than 1.28 s. Do not reuse these checkpoint passes as the fix check. R2 needs
300s **playback then save** allocation measurements including full validation
copies, main-thread work and atomic quota/invalid-PCM rollback on the post-fix
storage boundary. The intermittent Cancel button detaching before click also
remains open, separate from actual in-DSP cancellation <=250ms after handler.
No handed-off current UI files were silently mixed into the frozen core build.

Still pending: exact selected L/R PCM truth; pause/resume segment journey in this
independent pass; stale/late permission and immediate restart; proven mid-DSP
termination; nested workers/ports and five cycles; signal-to-visible latency and
full JS/WASM/process/copy accounting; tuner behavior; non-root serving and isolated
Docker; independent human guitar DEV accuracy. Existing full-band/music accuracy
gates remain unmet, and no holdout detector is authorized.

### Additional independent checkpoint channel/storage/resource checks

`ui-1793458865935/report.json` **passed** the extended source-frozen mic journey.
Beyond the previous UI checks, actual production storage methods and actual
IndexedDB transactions rejected altered PCM and invalid LocalAnalysis without
changing the previously saved record. A **controlled** QuotaExceededError thrown
at the PCM put **after metadata put** caused rejection and rollback; the original
record remained byte-for-byte unchanged. Metadata-only save (`pcm:null`), rename
and delete passed. This fault is not real disk exhaustion and does not establish
R2's peak-memory fix. The preceding extended run `ui-1793458847276` failed because
the harness omitted the required nullable PCM field; the corrected run is
preserved separately. The earlier `ui-1793458722341` changing-evidence assertion
matched an already present C# string; the harness now waits for actual event-list
change instead of that ambiguous substring. No production gate was relaxed.

`context/validation/live/runs/channels-1793458921071/report.json` passed all
**mean/left/right** through the real paced worklet, ingestion and Rust workers.
Stereo right input was deliberately `-0.5 * left`; canonical retained PCM was
compared against independently rendered source samples with expected gains
`0.25 / 1 / -0.5`, allowing capture start alignment and mean-square error <=1e-8
for FIR filtering. This verifies actual selected PCM, not just segment labels or
detector notes. Per-channel measured alignment/error/sample count and real
partial-tail/end-ack results are retained. This covers two related signals;
distinct independent-frequency stereo and cancellation fallback remain broader
coverage opportunities.

`context/validation/live/runs/cycles-1793458939878/report.json` passed **five
paced start/stop/export/refine/dispose cycles** in one page. Nonempty owned
AudioContext and main-thread worker reference lists accumulated one context per
cycle; all contexts closed and all facade-owned workers terminated after every
cycle. Chrome DevTools Target discovery observed the actual ingestion **and
nested analysis worker** while active, with worker-target count returning to the
initial baseline after every disposal. Raw target URLs/counts and owned references
are retained. This is stronger than a post-reload empty-list assertion, but does
not enumerate MessagePort closure or prove application-buffer/GC/process memory
baseline; no device tracks are used in this WebAudio graph test. The separate
mic run proves nonempty owned tracks ended before reload.

Publication boundary: root is regenerating active generated assets from newly
frozen final DSP source. All results in this section still identify **c2/abd**.
No new mutable-root engine run was started. They cannot validate final-source
parity/accuracy or the separately owned R1/R2 fixes. W's Docker/native-upload
proof is recorded separately in `rust-wasm-runtime-handoff.md` and is not
relabeled as this tester's execution.

### Paced polyphonic load, independent renderer

`context/validation/live/runs/load-1793458768896/30.json` completed a paced
30-second independently rendered alternating sine/plucked polyphonic control
through actual WebAudio/worklet/workers/WASM, followed by full refinement.
The graph retained **730,368 samples (30.432s)**, including startup silence;
46 timeline patches arrived before Stop. Status-sampled compute p50 **112.2ms**,
p95 **177.0ms**, maximum **192.9ms**; refinement **651.1ms**. Maximum reported
WASM memory **2,818,048 bytes**, owned JS **9,906,176 bytes**, queue high-water **1**,
skipped windows **0**. These are status samples, which may repeat one call's
compute value, **not** a distribution with exactly one measurement per DSP call.
They do not establish signal-to-visible latency or memory-budget compliance:
full AudioBuffer/source/export/WAV/validation copies and browser process delta
are not included in the runtime's JS counter. The associated fixture PCM hash
and full status/event records are retained. Renderer controls are not human guitar
DEV accuracy evidence.

`frontend-identity.json` records 68 source/artifact file hashes from the owned
mirror individually checked against the checkpoint inventory captured **before
fresh native compilation and copying**. Each frozen harness run also receives
`checkpoint-identity.json`; its text explicitly says this is a post-run check
against that original baseline, not a fabricated per-run before inventory.
Original checkpoint remains untouched. Frozen-harness strict TypeScript checking
passes with ES2023/DOM libraries; the initial ES2022 invocation lacked findLast's
standard-library type and was corrected without implementation edits.

Root has separately published final source `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`,
WASM `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`.
**No result in this independent checkpoint section applies to those bytes.**
Final-source and post-R1/R2 acceptance require separately coordinated runs after
fixer handoff. No unbounded evolving-source recheck is running here.

### 300-second cap outcome and provenance correction at handoff

The paced 300-second fixture ran to completion, but **did not complete the full
long-load/refinement acceptance check**. Its graph supplied **7,218,432** samples
including startup/tail; ingestion capped retained PCM at **7,200,000**, and export
returned exactly **28,800,000 bytes**. The harness's ordinary no-tail-loss equality
then failed (`load-1793458768896/report.json` contains the exact error), before
refinement/performance serialization. The graph source ran beyond the accepted
300-second budget; this is not evidence that the capped recording should have
retained those extra samples. Do not report 300s refinement, latency or peak-memory
pass. The 30s detailed evidence remains intact. A final cap-aware test should
preserve status/error/partial results at the boundary and independently refine the
retained full-length PCM. The tester did not relax the tail-equality assertion or
rerun another five-minute test against evolving sources.

**Important directory-provenance audit:** root subsequently found that the
original `.tools/wasm-checkpoint/context/` now verifies **9abc88c1... / 466aef70...**,
with remap script/flag changes. Its directory name is not a c2 identity. This
prompted an actual audit, retained as
`independent-fixed-20261031/provenance-audit.json`. The tester's owned `context/`
copy **still normally verifies c2**, and its actual WASM bytes hash **abd14...**.
Every manifest source input matches all three independently checked records:
(1) original `context.tar` entry bytes; (2) tester-owned consumed copy; and
(3) original native-build before **and** after inventories. Thus the native build
and these browser runs really consumed original **c2/abd**, rather than the now
changed named directory. The archive SHA256 and exact source-file hashes are in
the audit. No source was extracted over the original directory, no historical
reports were rewritten as 9abc, and no blanket invalidation is warranted. The
preparation script now refuses a non-c2 context even if its own verifier succeeds;
future reproduction must extract the original archive into a new owned fixture.

All tester-owned browsers and servers from this pass have closed. Current-source
R1/R2/Cancel fixes and final fc324/52205 acceptance are intentionally handed back
to the coordinated next pass, not silently mixed into these records.

## Root tab-capture crash diagnosis and real capability check

After the independent handoff, root reproduced the same Chromium143 SIGSEGV in
a two-page test with no Fretbloom code. Both the original flag set and a minimized
test crashed. Scratch commands/evidence are under `.tools/tab-capture-debug/`:
`node probe.mjs` and `node probe.mjs --minimal` failed. The minimized server uses
only a user-started 440Hz oscillator in the explicitly selected fixture tab and
a real user-gesture `getDisplayMedia({audio:true,video:true})` call in the other.

Removing Playwright's default `--disable-infobars` stopped the crash. This matches
the confirmed upstream [Chrome for Testing issue](https://github.com/microsoft/playwright/issues/39158).
The resulting real audio/video tracks were silent while Playwright's default
`--mute-audio` remained. Removing that flag as a separate change produced actual
fixture audio: one audio/one video track, `displaySurface:browser`, RMS .0304751,
peak439.453125Hz for the known440Hz tone. All tracks/context/browser closed cleanly.
The passing command was `node probe.mjs --minimal --keep-infobars --unmute`;
report `report-1793459627002.json` identifies Chromium143.0.7499.4. This changes
the isolated automation launch only, not app capture behavior or user permissions.

Root then applied those two explicit `ignoreDefaultArgs` entries to the tab
branch of the existing independent capture harness and reran the original path:
Node24.22.2 `node e2e-live-listening.mjs --capture-probes`. Both actual tab-audio
and fake-file microphone capability checks passed, with fixture invariants.
Evidence: `validation/live/runs/2026-10-31T15-14-01.181Z/`. Actual tab capture
returned48000Hz mono, one audio/one video track, nonzero phrase signal, all tracks
ended and context closed. The harness exits2 because unrequested integration
checks remain explicitly pending; it has no failed capability check. No other
tabs, profiles, system audio settings or user browser were accessed.

This resolves the particular test-browser crash and silence, not full app tab
acceptance. A fixed built-app fixture-tab -> capture/worklet/WASM -> live results
-> Stop/refine/save/playback journey remains an independent follow-up. Keep the
earlier crashes as historical evidence; microphone checks were never substituted
for this now-successful real tab-audio capability check.
