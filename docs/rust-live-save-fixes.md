# R1/R2 implementation handoff — 2026-10-31

Development implementation and focused verification in `fretbloom-song-audit`,
branch `fix/song-playalong-audit`. No commits, pushes, sibling checkout edits,
production/database/deployment access, dependency changes, packaging/Cargo/WASM
writes, DSP edits, holdout detector runs or independent-validation-file edits.
Root explicitly transferred the runtime files before those edits began.

## Changes

R1 uses optional, validated status `capturePosition:{segmentId,sample}` from the
same nonempty active ingest recording state. Paused, ended and empty captures do
not emit a position. Optional `captureEpoch` counts processed resume boundaries;
UI expects that exact epoch, clears position immediately on interruption/resume,
and cannot authorize linking from queued pre-resume status or analysis patches.
An empty pre-PCM pause/resume may still use segment 0. Failed Resume rolls back
its expectation; repeated calls are guarded, and late completion after Stop or a
new generation cannot restore the capturing phase. Video annotations can be
removed after capture (including an incorrect existing annotation) and relinked
during capture. Saved metadata bounds remain strict.

R2 releases player/audio source, WAV reference and playback/download URLs before
Save verification. WAV preparation and full verification copies share a bounded
serial queue. SHA256, byte length and finite little-endian f32 validation run in
a short-lived dedicated module worker for both Save and reload. Every outcome
terminates it and detaches handlers: success, invalid reply/content, worker or
transport error, cancellation, startup failure and a 15-second watchdog. At most
eight audio operations are admitted; queued cancellation is checked before a
worker or WAV buffer is allocated. IndexedDB still validates first, then writes
metadata/audio in one transaction, reporting success only after completion.

Runtime `ownedJsBytes` still includes its exported PCM Blob. Optional validated
`sharedPcmBytes` identifies that included allocation (<= owned bytes). Facade
export/restore/cache-clear diagnostics update immediately; ingestion reports
export/restore working-copy reservations before allocation and after release.
The UI subtracts overlap only after its exact Blob reference is proven to have
been exported/restored through the current runtime generation. Missing accounting
remains unavailable. WAV construction accounts its output ArrayBuffer and Blob
simultaneously; verification reserves PCM bytes plus the 32-byte digest output.
The 96 MiB cap and runtime budget checks remain unchanged.

Prior U behavior is retained: segment-specific timeline revisions, fresh runtime
generation on canceled-refine retry, explicit engine-upgrade consent, prior saved
engine identity until explicit successful Save, and recovery of genuine retained
PCM after malformed Stop metadata without enabling invalid Save/JSON.

## Actual verification

All commands used `.tools/node-v24.22.2-linux-x64/bin` first on PATH. Browser was
Playwright Chromium 143.0.7499.4 with isolated profiles. Owned guarded Vite server
was `npm run dev -- --host 127.0.0.1 --port 5202 --strictPort`; normal WASM
verification succeeded before startup. The owned server was stopped at handoff.

- Focused current-source unit command: `node node_modules/vitest/vitest.mjs run
  src/data/listeningSessions.test.ts src/data/pcmVerification.test.ts
  src/components/LocalSessionPlayer.test.ts src/components/LiveVideo.test.ts
  src/audio/live/runtime.test.ts src/audio/live/ingest.worker.test.ts`:
  **28/28 passed** across six files. Tests cover actual integrity body, worker
  serialization/reservations/cleanup/cancel/timeout/errors, WAV quantization and
  construction overlap, strict counters/position parsing, fresh shared-PCM
  diagnostics, delayed previous-segment analysis, a resumed 2,048-sample fragment
  with no claims, and empty pre-PCM resume retaining segment 0 with a new epoch.
- `LIVE_BROWSER_URL=http://127.0.0.1:5202 node node_modules/vitest/vitest.mjs run
  src/components/LiveListen.browser.test.ts -t '300-second|links a short|saves
  audio atomically|requires explicit old-engine'`: **4/4 passed**, two unrelated
  cases deselected, 14.67 seconds. No whole-suite acceptance claim follows.
- Actual browser IndexedDB: Save/reload/hash verification/rename/delete,
  metadata-only/count cap, corrupt replacement rejection retaining old metadata
  and verified old audio; quota failure deliberately injected after metadata put
  before PCM put, retaining both previous metadata and audio.
- R1 browser: actual fake-device-file microphone -> real worklet/ingest/WASM;
  controlled iframe clock (not actual YouTube alignment); queued old status and
  late prior-segment patch deliberately replayed, first resumed status held then
  released before any resumed live patch. Valid Save/JSON and annotation removal
  passed. Controlled context-resume failure, double Resume call and delayed Resume
  completing after Stop also passed. The last recorded resumed fragment was
  11,776 samples (<0.64 s), with no segment-1 result. Deterministic unit coverage
  also uses exactly 2,048 resumed samples. Browser evidence:
  `/tmp/fretbloom-anchor-fixes-5Ep9mK/anchor.json` and later successful run folder.
- `npm run build`: **passed** normal `wasm:verify`, TypeScript and Vite; emitted
  `pcmVerification.worker-B21zydcy.js` (1.52 kB) with the other actual worker/WASM
  assets. `npm run typecheck` passed during implementation. Focused oxlint passed
  with three existing-style mixed-export/FastRefresh warnings in player/video.

Vitest briefly discovered frozen copied tests under an independent tester's
`validation/candidate/runs/**/context`; those historical harness failures were
not current-source failures. A temporary command-only `--exclude validation/**`
was used for isolation, without source/config edits. Root subsequently installed
canonical discovery exclusions for only generated run/result snapshots while
preserving intentional validation tests. Final browser commands use that config.

## 300-second allocation evidence

Controlled three-tone polyphonic **7,200,000-sample / 28,800,000-byte** PCM fixture;
real storage worker, IndexedDB, runtime restore, player, Save and playback rebuild.
This is a full-length Save-after-prepared-playback test, not paced 300-second
capture, detector accuracy, native RSS or a browser GC benchmark.

Evidence `/tmp/fretbloom-save-fixes-b8lhve/300s-save.json` records:

- Shared PCM/runtime baseline **58,714,112 bytes**, with the same 28,800,000-byte
  Blob included once (proof from exact object/current generation).
- DOM-accounted Save verification peak **87,514,144 bytes**: baseline plus
  28,800,032 verification working bytes; retained WAV is zero during verification.
- Independently observed WAV ArrayBuffer **14,400,044 bytes** and immutable WAV
  Blob **14,400,044 bytes** coexist briefly during construction. React can batch
  this synchronous peak out of DOM mutation observations. Including those actual
  constructor observations yields **87,514,200 bytes high-water** (83.4600449 MiB),
  below **100,663,296 bytes / 96 MiB**, with **13,149,096 bytes** headroom.
- Main-thread Blob reads were at most **262,144 bytes** per WAV chunk. The full
  **28,800,000-byte** verification Blob read was observed in the dedicated worker.
  Verification worker starts/stops balanced; playback rebuilt after Save.

The final focused 300-second rerun additionally asserts that the WAV playback URL
is revoked before the verification worker starts; its evidence folder is listed
below. Worker instrumentation wraps module startup, queues messages until the
real entry loads, and intercepts only its own allocation probes. Core processing,
verification and storage implementations remain real. An initial harness version
failed because a dynamic-import wrapper dropped its first message; that harness
was fixed. Another instrumentation iteration needed to preserve native
`instanceof Blob` behavior for IndexedDB-returned Blobs; no product validator was
weakened.

Counters are application ownership/reservations, cross-checked with actual named
buffer/Blob constructor sizes and worker read probes. They do not inspect browser
Blob backing storage, WebCrypto implementation copies, IndexedDB internals,
AudioContext decoding, allocator overhead, WASM memory, process RSS or GC timing.
The proof concerns the declared application-owned buffers, not total browser
memory. The verification reservation includes a 32-byte digest; WebCrypto native
implementation memory remains browser overhead. No invented heap measurement.

## Cancellation finding and remaining boundaries

U's original intermittent old-engine test failure remains history: Playwright
found Cancel unstable, then it detached before clicking. This fixer reproduced
that exact failure once, and also saw the original test pass. No HMR explanation
or product Cancel defect was established. The focused test now holds exactly one
**genuine restore-completion reply** while actual worker/PCM restoration runs,
then clicks Cancel, verifies preserved displayed/persisted old engine identity,
retries with a fresh generation, and verifies explicit-save-only replacement.
Assertions were retained. This is **controlled cancellation during pending
restore**, not evidence of cancellation during synchronous DSP. Independent final
acceptance owns that latter test, full capture/resource cycles, tab capture,
static/full/non-root hosting and the separate musical accuracy gates.

Current artifact provenance (root-published, frozen through these checks):

- Canonical Rust/build source hash:
  `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`
- WASM SHA256:
  `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`
- Engine: `rust-dsp-2`; pinned Node: `v24.22.2`.

The older c2 checkpoint was read-only and was not used for these successful
browser runs. Root's guarded publication and byte-match evidence remain root's;
this fixer independently ran the normal verifier/build against that publication.

## Final source inventory and ownership release

Owned source/test inventory SHA256: `e5fdc3b0ae94971a5bfbe98ba9bb798afa81124189fe3462f4292f210d271b05`. Definition: sort the
following paths; hash concatenated `path + NUL + fileSha256 + LF`. This document
and generated build output are excluded.

```text
971417ddca32716a0ed3b68fc3b8b1a4e3479f7d73f0ef14f782d28014bf6c6b  src/audio/live/ingest.worker.test.ts
b46ee34c5dce8e1a9665e86209dfddda5365e28b80239beffdfee7d6a4b46c67  src/audio/live/ingest.worker.ts
572990df2402fba3a04b02414cc59dc3c0291566b54518de3d0c3881c5d239bc  src/audio/live/protocol.ts
f803e8cb1ca86a9ec6d26a8b1f47d639663053517ee754d54740031aa349a9c4  src/audio/live/runtime.test.ts
bbdbed4e3694cd3a5c91360f6e5968e7c283ad65a7e45aa5d066b214e6953118  src/audio/live/runtime.ts
4b611a59ec2df5e268bde458fff2556996961564010ee6cd26de414dba3a4980  src/components/LiveListen.browser.test.ts
74f0d25b77772522e22c4b32a6ce8c235b0a1bacdc44555eed4737f0af4effde  src/components/LiveListen.tsx
1ee7d13e17d5e0b89b2186f9fc88258180dec8133def2981b51b499d96f4dce0  src/components/LiveVideo.tsx
fd1f5a6847dc9b70c9c04f14df0ca071a1f2668cc9da57fa14838c5393eb9543  src/components/LocalSessionPlayer.test.ts
f3dd6bedaa02e4b0f65751062bcf0fb5e3fea43691286bc2498800e70f644123  src/components/LocalSessionPlayer.tsx
a516c425b3ae9c7704ffe5cdbae0a09796946e5f5c9af8cc512d3f32c3824370  src/data/listeningSessions.test.ts
cfe1cb905b01ac73a29d168ed13330718ee7d1c77d322a6ccacdbec1e9d73b3f  src/data/listeningSessions.ts
0961fef1c3e120bdcee581afbc37bb6dad35667d89f998740b7087e82072f9b8  src/data/pcmIntegrity.ts
2b55f5b2444e8d6c834e4bc2cb612551de33512460516c2dc4fde34463bb1376  src/data/pcmOperations.ts
6bb15c10b90a7faa0b73d813f8c0b39577723ed98f17500576f3dc585b6f8ddd  src/data/pcmVerification.test.ts
b78fc0888ea7f19799e2310120c21262acfc0a77521d4c75c8ac99446c3a365f  src/data/pcmVerification.ts
48a29e8f059a0141cc6483eb5e7ca3a16a361f77aa2d76115f2ee9520a88aa5d  src/data/pcmVerification.worker.ts
```

Latest successful final 300-second ordering/allocation rerun: `/tmp/fretbloom-save-fixes-Esk0c8/300s-save.json`;
high-water **87514200 bytes**.

Latest successful expanded R1 browser evidence: `/tmp/fretbloom-anchor-fixes-7Bgviw/anchor.json`.

All listed source/test paths and this handoff are released to root and the
independent tester. No further fixer edits or polling are planned.
