# Independent Astra integration review

2026-10-31. Source/evidence review following independent Sol testing. Only this new report was written. No browser, Cargo, build, service, database, holdout, commit, branch, deployment or agent runs. One non-mutating Node probe transpiled the production metadata parser in memory. This is actionable triage, not final acceptance or a music-accuracy assessment.

Read the complete architecture contract, including root amendments, current validation report, live implementation, listed UI/storage surfaces and focused tests. Sources continued evolving during review. The inventory below hashes the files at report publication, not an atomic initial snapshot. Recheck findings if their owning files change; historical test hashes must not be reassigned to current code.

## Accepted current findings, ordered by impact

### R1 — P2: an ordinary video anchor after Resume can prevent saving the recording

**Evidence:** `src/components/LiveListen.tsx:140` updates `latestSegment` only when an analysis timeline patch arrives; line 974 passes it alongside independently updated `capturedSamples` to LiveVideo. `src/components/LiveVideo.tsx:178–200` immediately persists those two values together when Link this moment is clicked. After Resume, ingestion already records segment 1 and status advances capture samples, but its first timeline patch waits for at least 1.28 s of contiguous input plus computation. Throughout that interval the UI still supplies segment 0. A delayed final patch from the previous segment is also not an authoritative capture-segment clock.

Concrete sequence: record two seconds, pause, resume, link the playing confirmed video when captured time reaches 2.5 seconds but before the resumed segment's first patch, then Stop. The annotation names segment 0 with sample 60,000, outside segment 0's end at 48,000. `src/data/listeningSessions.ts:99–109` correctly rejects it. Both Save and Download results validate the complete metadata, so both fail; no UI removes that bad stored annotation. Subsequent linking does not replace it. PCM/WAV remains recoverable.

**Probe actually run:** production `parseSavedListeningSession` with segments `[0,48000)` and `[48000,72000)`, and anchor `{segmentId:0,captureSample:60000}`, returned `Video annotation is outside its capture segment.` Changing only segmentId to 1 passed. This proves the parser consequence; the UI timing sequence is a source-supported repro, not a claimed browser run.

**Smallest coherent fix:** source segment identity and sample position from the same authoritative ingestion capture state, or disable anchoring until that association is known after every interruption. Do not derive capture identity from whichever analysis finishes last, or weaken the storage validator. Prevent an invalid annotation from poisoning export and allow correction/removal of an existing annotation.

**Owner:** root routes to a different Sol after U handoff (`LiveListen`, `LiveVideo`); coordinate W protocol/runtime ownership only if adding segment state. **Verification:** a focused delayed-patch integration test must resume, advance capture status before the next patch, attempt linking, then successfully save and export valid metadata. Include a late previous-segment patch and a resumed fragment too short to emit a patch.

### R2 — P2: Save after playback preparation exceeds the declared audio-buffer budget and hides its full-copy allocation

**Evidence:** `src/components/LiveListen.tsx:510–520` saves without releasing the prepared local player. `src/components/LocalSessionPlayer.tsx:125–128` retains the WAV Blob, while `src/data/listeningSessions.ts:125–144,226` allocates a full PCM ArrayBuffer for verification and loops through it on the main thread. The stopped runtime retains canonical recording chunks/ring; the UI/runtime also retain the exported PCM Blob. `src/audio/live/ingest.worker.ts:405–419` cannot account for this storage verification copy; the UI counters account only for PCM and WAV.

At 300 seconds, these simultaneously retained application-owned audio objects account for at least 28,800,000 canonical bytes + 983,040 ring bytes + 28,800,000 exported PCM Blob bytes + 14,400,044 WAV bytes + 28,800,000 verification bytes = **101,783,084 bytes**, above the **100,663,296-byte (96 MiB)** contract. This excludes metadata, digest-internal storage, audio-element decoding and process overhead. The arithmetic was checked in memory. It is the architecture's explicit app-owned Blob accounting, not a claim about whether a browser physically keeps Blob backing in RAM or on disk. No measured process-memory or OOM claim is made.

**Impact:** the allowed capture → playback → Keep audio → Save path violates the buffer bound, and reported counters omit the allocation causing it. Seven million sample checks also execute synchronously on the UI thread; latency remains unmeasured.

**Smallest coherent fix:** release the WAV/player before audio verification, serialize verification with other full-copy work, and account its working allocation. Move integrity verification off the UI thread as the architecture requires; preserve hash/finite-sample checks and atomic IndexedDB writes. Do not simply delete verification or increase the cap. Count a single shared PCM Blob once across UI/facade references.

**Owner:** different Sol after U transfer (`LiveListen`, storage, player); W only for any shared accounting/API change. **Verification:** instrument the actual 300-second save-after-playback flow, assert WAV release precedes full PCM verification, and verify combined owned allocation high-water stays within 96 MiB. Verify corrupt audio still fails and a quota-aborted replacement preserves the previous metadata/audio. Browser-native/process memory must be reported separately.

## Independent findings triage

- **Real mic/worklet/live notes and IndexedDB journey: established for its recorded development artifact.** `ui-1793458265650/report.json` has changing A3 → C3/E3/G3 before Stop, real retained PCM of 300,032 bytes, rich refined metadata of 6,591 bytes, reload/playback/delete, no console/page errors or mutation requests, and unchanged frontend inventory. Its WASM is `198ab7fa22199b2565d3da182d4e90a7c9233cae2b42246dba0accdfd4279327`, historically associated with source `27bd0ebf37649a3fa60051971e7111a88b5e4ac9ce79905c3bb451a77989492e`. This is not tab capture, full music acceptance or the newly published binary's UI test.
- **Endpoint defect: fixed and independently rechecked during this review window.** The updated validation report and `2026-10-31T14-54-29.986Z/{report,offgrid-stop-refine}.json` record normal verification, unchanged inventory and actual worker Stop/export/refine success at exactly 65,536 and 61,696 samples. Final feature times equal exact duration, with 262,144 and 246,784 PCM bytes. Core `segments.rs:265` clamps `round6(...).min(duration)`. New source `c2dcca24b80554f3c81ef2fc620d7b87a56694c6a2426a9f3664dd50ad1f7f6a`; WASM `abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2`. Retain original failures as history; strict TS bounds remain correct. This new PCM-port evidence does not establish a new mic/worklet journey.
- **Resume revisions: known U fix now present, independent recheck outstanding.** `LiveTimeline.tsx:46` compares revisions per segment, matching runtime's per-segment map and RollingTimeline's per-instance counter. Its focused test explicitly accepts segment 1 revision 1 after segment 0 revision 10. Do not reopen the global-counter defect as a new discovery. R1 concerns capture identity, not this revision fix.
- **Cancel then refine: known U fix now present, independent recheck outstanding.** `LiveListen.tsx:395–470` preserves the displayed analysis, exports retained PCM, increments generation, disposes/recreates runtime, restores the saved analysis/options, and retains only previously explicit upgrade consent before retry. Runtime verifies PCM and rejects mismatched engines absent consent. Ingestion deliberately consumes one refinement per generation and atomically replaces its snapshot only after all results validate. Do not weaken that contract. The historical restore report establishes dispatch cancel/old identity/bad-hash rejection with metadata-only fixtures, not mid-DSP cancel or rich IndexedDB rollback. Current UI ignores unsolicited stopped/refined events and checks key/signal before adopting RPC results. Verify cancel during restore as well as during synchronous DSP, then successful retry without silently saving new results.
- **Held-note duplicate warning: observed historical failure, not reproduced in stable UI run; no current culprit established.** The earlier `ui-1793458195979` shows three A3 spans. Current RollingTimeline clips a prefix preserving ID, extends only contiguous same-MIDI evidence in the same ledger/stream, and emits clipped replacement spans. Current UI joins contiguous matching IDs; its held-note test expects one span and an unchanged previous view. A start suffix on the React key alone would only hide duplicate-key warnings, so the required recheck must assert the interval list, original onset and release gaps as well as console cleanliness. No evidence supports blaming runtime ID ownership merely because the original warning named an ID.
- **Partial-tail wire mismatch: fixed in source and subsequent graph/property evidence.** Worklet flush slices exact partial length; parser requires `frameCount * channels * 4`; receiver copies before returning credit and acknowledging the ordered end boundary. Missing end acknowledgments have bounded stop fallback with partial state. Keep the full/partial and cross-port race recheck on the frozen pair.
- **Legacy upload preservation timeout: unresolved evidence failure, not an established local-path regression.** Raw preservation result has exit status 1, not a causal trace. The unchanged e2e waits on localStorage song revision/audioAnalysis, not merely backend readiness. Harness sets the 5231 origin before creating Vite; `createAnalysisMiddleware` reads it when instantiated. Current Vite still installs analysis middleware; dev `/songbook` is reachable, and the built route still fails closed. No source-supported route removal or upload-state mutation from the local path was found. HMR during the failed run is a confounder, not a proven cause. Repeat the unchanged e2e on isolated stable processes, collect POST/job polling/result responses and browser errors plus the saved record at failure. Do not add an auth bypass or change the e2e success predicate.
- **Actual tab capture: environment limitation and unvalidated capability.** Raw tab report says `NotSupportedError: Not supported`; headed closure is not a successful capture. After handoff use an isolated headed Chromium/Edge environment supporting display audio, a second fixture tab, automation-supported source selection, and actual track/settings/signal checks. If unsupported there too, record the precise capability limit. No manual QA assignment and no substitution of fake mic/WebAudio evidence.
- **Cleanup evidence: incomplete, not proof of a current leak.** The successful UI resource arrays were reset by reload. Practice's shared engine context explains that particular running context; it does not prove LiveCapture closure. Source releases all owned tracks including video/late streams, closes context/node port, and facade termination owns ingestion and its child worker. The worklet retains its transport until context teardown; the ingestion port remains with a stopped runtime until disposal. Explicit five-cycle nested worker/port and before-reload context accounting is still needed; do not infer synchronous GC from termination.
- **Exploratory native/WASM mismatches: invalid source association, not portable DSP bugs.** Original comparison ran against changing sources. Node WASM computation/parity and browser throughput are different gates. The builder comparison helper's blanket numeric tolerance is also insufficient as final identity/boundary evidence; independent comparator must enforce the architecture's exact identity/boundary rules.

## Other inspected boundaries

No local capture upload, Songbook-key access, private credential access or new auth bypass was found in the inspected local path. YouTube embeds are explicit actions with bounded ID parsing and fixed origin; message listeners verify origin and iframe source. Do not treat network silence in one short test as a universal security proof.

Local metadata validates options/engine associations, ordered complete PCM extents, segment gaps, bounded streams/metadata and finite/hash-matched retained samples. IndexedDB save checks collection budgets inside one readwrite transaction and writes metadata/audio together, reporting success only after completion. Counts/quota still need actual fault/reload evidence. Corrupt metadata is rejected rather than rendered as trusted result data.

Scheduler has one current/one replaceable pending job. Live and refinement deadlines run in ingestion, separate from blocked WASM. Cancellation kills the analysis worker; engine generations reject late callbacks. Missed coverage survives storage and is hidden as a missing-evidence overlay once completeness is refined. Short fragments abstain. Emitted worker/worklet/WASM imports use Vite URL patterns, and Node maps `.wasm` to `application/wasm`; final built non-root hosting remains a test gate, not a diagnosed source defect.

## Remaining independent recheck sequence

1. After owners transfer files, fix R1/R2 with the separate Sol requested by root. Rehash changed sources. Preserve corpora and strict validators.
2. Against a stable normal-verified artifact, rerun actual mic/worklet/UI journey including Resume, held-note seams, cancel while DSP is busy, retry, explicit old-engine upgrade, failure/cancel preservation of rich old records/options/hash, and explicit-save-only replacement. Exact endpoint worker regression now has a development pass; rerun if core/artifact changes again.
3. Complete authoritative video anchoring and 300-second save/playback allocation checks above; record before-reload owned context/track closure, nested workers/ports, PCM deletion and five full cycles. Run 30s/300s polyphonic pacing for compute/delay/backlog/main-thread work and separately reported native memory. Counters alone do not prove allocation bounds.
4. Run stable legacy preservation, final npm-only/static/full/Docker/non-root/MIME/missing-WASM checks on isolated resources. Retain static Songbook fail-closed checks. Exercise actual tab audio only in a suitable isolated environment, with honest unsupported results where applicable.
5. Root freezes native/WASM source, binaries, preprocessing/options and environment before independent exact parity and separately authorized musical holdouts. Node 24.22.1 in tester reports is not the contract's 24.22.2 pin. No final acceptance follows from this report.

## Publication SHA256 inventory

Hashes below identify publication-time bytes inspected or used as evidence. They do not certify a stable whole-review snapshot or native executable association.

Captured UTC: 2026-10-31T14:56:40.356549+00:00

```text
7c61a4cdd2d64d4bd5d6a55dc28f8130aeb9fae661d5d8979330af3fd58aa0dc  /home/xtra/AGENTS.md
d07766116ecf3eb1d5aaa3104b47b4f6d4e8de539accbe450a37d6539133a680  docs/rust-live-architecture.md
b9993bd2a1e6c09abe93dd2fed1573a26115b0c3f8d304ba1515e886423420d9  docs/rust-live-validation.md
f27175486f168d5f43478932ae9dc63041de2cf497954dd2d6afc1419016ef1b  src/audio/live/analysis.worker.test.ts
8362c1663730cad59e1532bdbd08b53757a1485a9f1c02b6f845f1e766836dca  src/audio/live/analysis.worker.ts
93db7045f00f3b0b393f538e9c7e7c67273955be49d509c3c2f5a2ea59e36747  src/audio/live/capture.test.ts
cacf24b8d81bd54a6aa73475c151961f5418dec44a139f29808e4e684eadad30  src/audio/live/capture.ts
f6b0b670e0a84227ff2638882f36510a26a64815b4169d98c2e2b3eaab6ae535  src/audio/live/capture.worklet.js
39cf7a97de2ff86aae7fc89a9f727d75ddf0a611be35e6d13eac03eefd551ff3  src/audio/live/capture.worklet.test.ts
47dddef7d5cbf1fa59bdf139bd892306acdfd1dfbec6336e16f24de74b177ad4  src/audio/live/captureWorkletTypes.d.ts
37907492509716811a76dd64a7c0f046f8ab65c654240daea54b7e11fd0c3f0f  src/audio/live/ingest.worker.test.ts
52621c09e0e2e3a6d259cff158326d4c02c915918b38326cea714a335dc1c02d  src/audio/live/ingest.worker.ts
2cbd85956aeaaadc40507c3615cd72c8f4b48d9ffecedd1027cd2da6410cc314  src/audio/live/protocol.ts
4480f89932518b0fd02050ab829f865f489a0886b6ed42aea23b79cd23985630  src/audio/live/resampler.test.ts
68b5b7fbaaa0ef9eec7f5fed5a32e596348e0f58c040e50827a7b3e05b4b36b9  src/audio/live/resampler.ts
2a192980900d4680057fc0a2106b924fbae033c1a297f4ff02be45bb390d7815  src/audio/live/rollingTimeline.test.ts
4f36dd73a8b7cc027e45e4b73e5e682d26e741d1b8ce43997a4296e60ad30468  src/audio/live/rollingTimeline.ts
4a245ffe80a200635224b7a291e59d064cf76c5788e3db228a9b3dc528c17209  src/audio/live/runtime.test.ts
ada84f82cfc17f67c9c2febe806bf2b29276dce14401dd727a73ee1ad577657a  src/audio/live/runtime.ts
32f4ff1dc6771d5e3f756ea63182532ffc5af9fcb5b712989f5062c5353674e3  src/audio/live/validation.test.ts
dbf757ecc8a438aa19c1a55324a7722bd3156127dc097d1d8b896e89be45dd8a  src/audio/live/validation.ts
25534b919efa07128abce80568cba44832a0e0b3175fd82c72367f730c83f21e  src/components/LiveListen.browser.test.ts
bf3a906d580e32dc3a93609068329f03c81d9f6f175ff63a4aca43a9c80cc12e  src/components/LiveListen.tsx
04e4487d48b6d6f91ea9c3a0ae1c0784af2031d57452b18c7cba2523c369773d  src/components/LiveTimeline.test.ts
f90dda36e7e1cb7bce80b2e229d4b81f5e005c63761f090e2f86d448f9f260d8  src/components/LiveTimeline.tsx
6688f0f2e68760054bb2f4ff57523a2a56576e217e049dbbf8d1fd3b59354b7e  src/components/LiveVideo.test.ts
76f975e2220f7a36668e124be585fc1127a1b3d8b691867e63e2604a240526ab  src/components/LiveVideo.tsx
2a5ca9e02cc97ed3d9ace530134a63300f4e4f9a95945c679e9728c4efc35180  src/components/LocalSessionPlayer.test.ts
2d0acfd1d6d25ebd61aa834aed431a9ff2e3f0e5a1b56ebd1dca9b77f177a6e4  src/components/LocalSessionPlayer.tsx
cf588d4ac09fada1e93780f46f2202adf5c9679144a637ad447b4bed96d98644  src/components/ListeningSessions.tsx
610779af93a6fa06c095689585b223c8b95d7188c34e1b5063820bc17298d630  src/components/ListenMode.tsx
e92f320d6ab8f1702b2bae73c101129852511e4e3473f2f094227e8127c5cbd8  src/components/PracticeChordMode.tsx
13c2905c289ffef6cda4519a72fca4503a58cad635c2870c6b5050d216b06d49  src/data/listeningSessions.ts
b4bf4780cec1f8f6773752c580ec563c04556f68ecaf116e59ed78e97299ce49  src/data/listeningSessions.test.ts
1885e86e3215ee5980d4b7d35c527a89359ebdf0f90fbb9fb3e32cae06d1f9ea  src/audio/mic.ts
7520a8917676437e85d5c7abff9df34e6374ce7d00c47169ae89a9012df8170b  src/router.ts
9790e8dec79a4a81bc52429af49d743ca1c44309cef20e1727211b1d0e041532  vite.config.ts
1dd8348a0586ba462b614fd13bd2f03475875435ce921ef23ff39abe42ff61f7  server/analysisApi.ts
312f60d7fb4c4ba18ac5b0e1ddfbb3b48760db26beb7471d47d1c69ca02fabcb  server/index.ts
56ef0a3da27f083064b3daace3af2f6161c4385110f11360acb8d8117c493037  e2e-rust-analysis.mjs
845c741aaf5326260cb63e454b5a6cac49c9d5ae9831ff1904d4e6583b9fb3f9  validation/live/preservation.mjs
7bf621505fec61ca1a41dcb574106a1692cc05d9c4875229dcbe3ac91b14a6e3  crates/fretbloom-analysis/src/lib.rs
657fe0b54247af5fa68ec9a6103006c1d57bd9827d1f20239f4f4f9d477ecc35  crates/fretbloom-analysis/src/segments.rs
826fabf909bdf0e89d869aaec611c4b00bef748fe94dc7b881da06d26023da10  src/generated/analysis-wasm/fretbloom_wasm.d.ts
5d9f2ed959ec33aa08bf5d40720ebd0759e2761d4e26e0e21e03b2af62fd5a41  src/generated/analysis-wasm/fretbloom_wasm.js
abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2  src/generated/analysis-wasm/fretbloom_wasm_bg.wasm
8fb535b7d0a88b698f4b84cb1ce417e57e1ee0e06162177e34074ef37a664529  src/generated/analysis-wasm/fretbloom_wasm_bg.wasm.d.ts
fe5bb8f10bc0063dde1bcc7ae85b129ecb4641bba648c52d714c0c83b96c043c  src/generated/analysis-wasm/manifest.json
aad9565865c4678b25ba40e81a850c465869ed6b8902280291a958d1f5dc2008  validation/live/runs/2026-10-31T14-41-10.342Z/report.json
ef6f9f1ad2beaa9fbfd69bf1e1592f5d8e5fb98fdeff1260c2342b443dd374f7  validation/live/runs/2026-10-31T14-41-10.342Z/tab-capture.json
51ce3c402afd3018a72666834ffa40969dfd1466721b847d516616e277572295  validation/live/runs/2026-10-31T14-42-51.881Z/report.json
0a99b231f00016a59bb63de2fd5dcd875bd0fe18a76a7e49dd5ed19a918da607  validation/live/runs/2026-10-31T14-44-12.008Z/report.json
8b7a0b85e18d5ea5eb97c9a7092db3849ec48bf56534a9aa26c7cbf9310db699  validation/live/runs/2026-10-31T14-44-12.008Z/paced-graph.json
8a7157017fc321d06c79ebc9991b78490e19ba8a790f5634aa455f48571f6066  validation/live/runs/2026-10-31T14-46-15.290Z/report.json
9ab99d13c64e7a761196413ca66e563bd42322ab4212a023e26a0b178d4fa897  validation/live/runs/2026-10-31T14-46-15.290Z/paced-graph.json
d8c7225e8f2758a8889308e26eccfc2a2e7bd7e04f17496eefb19f59ea86802f  validation/live/runs/2026-10-31T14-46-58.007Z/report.json
975c603472b4e53d1feda3276456d06f7bf8dea460479a97fe705dde05af59ba  validation/live/runs/2026-10-31T14-48-06.692Z/report.json
7552f72189890908de18cb7c817bfd944e2a3a1a445af458d8ea59e8ac74624d  validation/live/runs/2026-10-31T14-48-06.692Z/paced-graph.json
167ba613a780a128e7fee5e86144854b914bec81677f8b3994cc8ba08d0e3f7f  validation/live/runs/2026-10-31T14-48-06.692Z/restore-lifecycle.json
a9ae245ea2facbc4dfb8b43a40462f81b402121bd4253cf0b062cb0f9a9a8593  validation/live/runs/2026-10-31T14-54-29.986Z/report.json
0a908f2b6ab9b18eca35e374bd625a40de9c0b1f1a25efa58a88f5248c266aaf  validation/live/runs/2026-10-31T14-54-29.986Z/offgrid-stop-refine.json
d722689f0b8b416cd15998cf6ea433610b5e10a18734119116a88250db9073cb  validation/live/runs/ui-1793458195979/report.json
dc2f80f6e5d6d881cdd091c3cf50c8511b0d9e0efa34422dcaa932f7c7329dfb  validation/live/runs/ui-1793458265650/report.json
3ad407b3b37c6c51c32b5cbb09c83e951d2c7112621813d1afe0e2e6a0576ee7  validation/live/runs/preservation-1793457840426/result.json
```
