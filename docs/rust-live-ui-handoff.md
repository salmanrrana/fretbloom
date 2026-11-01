# Builder U handoff — 2026-10-31

Development implementation and evidence, not final acceptance or musical accuracy.
No commits, pushes, deployments, production access, independent-corpus writes,
package changes, DSP edits, or edits in the other checkout were made by U.

## Delivered scope

- Capture lease and standalone checked-JSDoc AudioWorklet: direct-gesture tab/mic
  permission, late-stream cleanup, all-track ownership including video, actual
  rate/channel handling, zero-output graph, eight transferable buffer credits,
  exact frame/sequence counts, partial flush, ingestion-originated end barrier,
  interruption boundaries and disposal.
- Capture/Practice selection preserving the old practice implementation; rich
  independent note/harmony timeline, uncertainty, missed-live diagnostics, stable
  held-note seam joins, per-segment revision tracking, keyboard/event-list access,
  source notices, stop/refine/retry, optional explicitly opened video annotations.
- Separate IndexedDB `fretbloom-listening-v1` sessions/PCM, strict shared
  `parseLocalAnalysis`, audio hash/finite checks, transaction-complete saves,
  bounded local collection, list/open/rename/delete/clear, results-only saves,
  JSON export and separate PCM16 WAV playback/download.
- Old-engine results remain readable. Explicit reanalysis keeps prior evidence
  until successful refinement, and changes persisted engine identity only on
  subsequent explicit Save. Retry restores retained PCM into a fresh generation
  rather than weakening one-refinement-per-generation.
- Invalid Stop metadata is rejected; its live timeline and retained audio remain
  recoverable. Save/JSON require a validated LocalAnalysis.

Owned files: `src/audio/live/capture.ts`, `capture.worklet.js`,
`captureWorkletTypes.d.ts`, their focused tests; `src/data/listeningSessions.ts`
and test; `src/components/{LiveListen,LiveTimeline,LiveVideo,LocalSessionPlayer,
ListeningSessions,PracticeChordMode}.tsx`, focused tests, `live-listen.css`;
transferred `ListenMode.tsx`, App Listen copy, YouTubeAnalysisPanel fallback link.
W protocol/runtime/validation/workers and all package/build files were imported,
not edited by U. No global CSS, Songbook/auth/router, existing mic/tuner/player,
or core Rust sources were edited by U.

## Exact development identities

Browser: Playwright Chromium **143.0.7499.4**, Linux, isolated profiles. Node on
this machine reports **24.22.1**, not the contract's 24.22.2 pin.

First successful development capture/storage journey used WASM
`198ab7fa22199b2565d3da182d4e90a7c9233cae2b42246dba0accdfd4279327`,
manifest source `27bd0ebf37649a3fa60051971e7111a88b5e4ac9ce79905c3bb451a77989492e`.
Endpoint-fixed reruns used WASM
`abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2`,
manifest source `c2dcca24b80554f3c81ef2fc620d7b87a56694c6a2426a9f3664dd50ad1f7f6a`,
engine `rust-dsp-2`. Neither is claimed as the latest-source/final freeze.

Final U source/test inventory SHA256:
`46bc999e820eeab35b51f16afba873a9c29539f7252d9f7af44df3f344e55310`.
Definition: sort the 21 owned source/test paths above (including App,
YouTubeAnalysisPanel and local CSS), compute each file's SHA256, then SHA256 the
concatenation of `path + NUL + fileHash + LF`. This handoff is excluded.
Important current file hashes:

- LiveListen.tsx: `53e2d9c047e355479f972338fef0a03519534330ad6dafa34dea88095bf888b5`
- LiveListen.browser.test.ts: `a7413270b05a29175675c289e455eff125fd32948eb55352f1756ede174d58e7`
- listeningSessions.ts: `13c2905c289ffef6cda4519a72fca4503a58cad635c2870c6b5050d216b06d49`

## Checks and evidence

- Final focused suite: **16/16 passed**, covering late permission cancellation,
  missing audio/video cleanup, barrier disposal, mic constraints/channel choice,
  bad rates, credit/overflow/partial frames/zero output/end acknowledgment,
  timeline revisions/seams, metadata/hash validation, WAV quantization and URL
  parsing. `npm run typecheck` passed. Focused lint passed with nonblocking
  FastRefresh mixed-export warnings. Standalone strict `tsc --checkJs` on the
  worklet passed. Impeccable detector returned `[]`.
- Endpoint-fixed browser suite at 09:56:01: **4/4 passed** in 21.66 seconds.
  Real browser IndexedDB save/audio reload/rename/delete/metadata-only/count cap,
  separately controlled quota failure after metadata put (prior save unchanged),
  hash-corrupt audio refusal; actual fake-device-file getUserMedia through the
  real worklet/ingest/WASM with **4 live events before Stop**, pause/resume,
  stop/refine/blob playback/Keep audio/save/reload/restore/delete; explicit old
  engine failure/cancel/retry and explicit-save-only identity replacement; exact
  65,536/61,696-sample PCM-port Stop/refine with feature endpoints <= duration.
- Exact sample-count tests use **controlled PCM injection into real browser
  runtime/ingestion/WASM**, not real display capture or a worklet clock claim.
  Mic tests use **actual getUserMedia with a browser fake-device WAV**. No
  detector output or expected musical labels are mocked.
- Latest expanded suite at 09:57:39: **3/4 passed** in 48.39 seconds. Added
  controlled invalid-Stop-reply metadata rejection/recovery **passed**: no Save
  action for invalid metadata, genuine retained PCM plays, real refinement
  recovers valid results. IndexedDB and exact endpoint cases also passed.
  Old-engine cancellation test **failed** when Playwright found Cancel refinement
  unstable and then detached before clicking. The earlier full suite passed that
  case. Keep this intermittent cancellation-control/test-timing finding open;
  do not relabel it as a proven HMR issue or erase the failed run.
- Earlier moving-dev Resume control instability was recorded. The endpoint-fixed
  full suite and latest mic/recovery case passed Resume. Cause was not proved.
  Browser tests block development WebSocket HMR as a labeled isolation aid;
  final acceptance still requires a fixed built app.
- Latest successful mic/recovery evidence:
  `/tmp/fretbloom-u-jGy6fi/evidence.json`, desktop.png, narrow.png.
  Browser errors `[]`, mutation requests `[]`, 360px page overflow `false`.
  Short-session UI audio count **253,484 bytes**; displayed runtime owned JS
  **1.4 MiB**, WASM **2.6 MiB**, latest analysis **40 ms**, queue high-water **1**,
  skipped windows **0**. These are a short development observation, not a 300s
  high-water/resource proof. Accepted R2 explicitly identifies missing accounting.
  Prior complete suite screenshots/evidence: `/tmp/fretbloom-u-0ELmLE/`.
- Two batched visual rounds at 1280px/360px were inspected; source/action layout,
  sticky Stop area, timeline-only horizontal scroll and event-list alternative
  preserve the incumbent garden style. Gap marker scale was corrected.
- Legitimate `npm run build` was attempted after the endpoint-fixed suite. It
  **failed normal wasm:verify on source/tool drift**. No bypass was used and no
  successful current-source build is claimed. Root/W must regenerate at final
  freeze and run the normal pipeline. No holdout detector runs were performed.

Reproduce focused browser checks with a normally verified dev server:
`LIVE_BROWSER_URL=http://127.0.0.1:5202 npx vitest run src/components/LiveListen.browser.test.ts`.
The harness imports source modules for storage/runtime probes, so this particular
harness needs Vite; it is not the fixed-static acceptance harness.

## Open follow-up and ownership release

Root accepted Astra **R1/R2** in `docs/rust-live-review.md` and explicitly assigned
fixes to a **different Sol after this handoff**. U has not applied them:

- R1: video anchor segment/sample association after Resume can be stale until an
  analysis patch; bad annotation can block Save/JSON. Keep strict validation;
  use authoritative capture identity or gate anchoring and allow correction.
- R2: Save after playback retains WAV while full PCM verification allocates an
  uncounted full ArrayBuffer on the UI thread. At 300s this breaches 96 MiB.
  Needs player release/serialized off-main-thread verification and complete
  accounting, without removing hash/finite checks or weakening atomic storage.

Also preserve the latest intermittent Cancel-control failure; actual display
capture, full cleanup cycles, 30s/300s performance, Node pin, fixed-static/full/
Docker/legacy preservation and final musical gates remain root/tester work.

The owned 5202 development server is stopped during handoff. U releases **all
source and focused-test ownership listed above**, including transferred files,
for root reassignment. No further U edits or test runs are planned.
