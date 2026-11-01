# Actual older Chromium and Linux WebKit Asyncify validation

2026-10-31. Independent test owner; no subagents. **Chrome 136 natural-no-JSPI parity and CPU-stop gates PASS. Linux WPE WebKit2359 / reported version 26.0 explicit Asyncify parity and CPU-stop gates PASS.** WebKit exposes JSPI; its two original natural-no-JSPI attempts are retained as scope rejections, not product defects. This is actual execution of the existing frozen Asyncify feasibility artifact, not adoption or certification of the ungenerated portable product.

## Authorization and unchanged scope

Read `rust-cancel-browser-matrix.md`, `rust-cancel-compatibility.md`, the complete delivery inventory, cleanup and frozen-input records. Rehashed all **321** delivery entries before execution and afterward; all unchanged. Delivery-inventory SHA-256 remains `5307c5f83224c7be6064d79020b9ab05fb135792999df42ec7d0426ca4fcb53b`.

`FRETBLOOM_MATRIX_TIMING_CLEARANCE` contained the literal contents of `target/cancel-next-coordination.json`: root release/assignment **2026-10-31 21:25:43 UTC**, previous tester release **2026-10-31T21:21:09.698974Z**, with this browser owner exclusively assigned heavy work. Every attempt retains that complete text. No clearance was invented. First launch began 21:26:38.681Z; final browser closeout ended before the performance release below.

Writes: only new `target/cancel-browser-acceptance/**`, `validation/cancel-browser-acceptance/**`, this report, and four new timestamped directories under `target/cancel-browser-matrix/runs/**`. No existing matrix delivery was edited. All active product files, frozen implementations, corpora, scorers and earlier reports remained read-only. No source/build/adoption changes, production, live DB, default preview, sibling checkout, holdout, secrets, installation/download, commit, push, deployment or follow-up task. The prepared Chrome runtime and private WebKit loader were reused as-is.

## Commands actually executed

From `/home/xtra/code/personal_projects/fretbloom-song-audit`, using pinned Node v24.22.2:

```sh
FRETBLOOM_MATRIX_TIMING_CLEARANCE="$(cat target/cancel-next-coordination.json)" .tools/node-v24.22.2-linux-x64/bin/node validation/cancel-browser-matrix/run.mjs direct:chromium:parity direct:chromium:cancel playwright:webkit:parity playwright:webkit:cancel > target/cancel-browser-acceptance/initial-four.log 2>&1
```

Exit **1**: two Chrome passes, then two WebKit scope rejections before analysis. No completed cancellation latency failure was rerun.

Before the next execution, wrote `target/cancel-browser-acceptance/explicit-backend-declaration.json` explaining the changed test scope, and copied the harness into owned paths:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-browser-acceptance/prepare-harness.py
.tools/node-v24.22.2-linux-x64/bin/node --check validation/cancel-browser-acceptance/run.mjs
.tools/node-v24.22.2-linux-x64/bin/node --check validation/cancel-browser-acceptance/worker.mjs
FRETBLOOM_MATRIX_TIMING_CLEARANCE="$(cat target/cancel-next-coordination.json)" .tools/node-v24.22.2-linux-x64/bin/node validation/cancel-browser-acceptance/run.mjs playwright:webkit:parity playwright:webkit:cancel > target/cancel-browser-acceptance/explicit-webkit.log 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-browser-acceptance/verify-evidence.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-browser-acceptance/cleanup.py
```

Explicit-backend execution exit **0**; syntax checks, independent evidence verification and cleanup assertions pass. The preparation helper is a one-time creation script; it deliberately refuses to replace its run parent. Re-execute the run command only with fresh root timing authorization; verification alone does no DSP/browser work.

Exact source differences are retained as `validation/cancel-browser-acceptance/{run.mjs,worker.mjs,page.html}.diff`, with original/owned SHA-256 in the declaration. Differences: new output/fixture paths; explicitly allow unchanged Asyncify while preserving/reporting natural selector `jspi`; label explicit scope; pause at worker source entry before WASM initialization and save completed identity censuses before creation/source entry/ready/real request entry. No WebAssembly globals or runtime preferences changed. No module, numerical instruction, PCM, case, threshold, cancellation timer or DSP-thread matcher changed.

## Actual capabilities, backend and full-byte parity

Chrome command and `/proc` command lines are retained. It was **Google Chrome for Testing 136.0.7103.113**, direct headless with no debugger/inspector/CDP or JSPI flags. Both page and worker report `WebAssembly.Suspending` and `WebAssembly.promising` **undefined**. Natural selector and actual backend are respectively `asyncify` and `frozen-asyncify-fixture`.

WebKit actually launched via the prepared private loader, using Playwright; reported browser version **26.0**, installed **Linux WPE WebKit2359**. Both page and worker report both JSPI APIs as **function** in the explicit runs. Natural selector remains `jspi`; actual tested backend is explicitly `frozen-asyncify-fixture`. The initial harness throws `Error: Runtime does not close no-JSPI coverage` before initializing WASM; the page features/error are retained, and no missing initial worker-ready record is inferred as absent APIs. Its Macintosh/Safari user-agent string does not make this Safari or macOS evidence. No natural-no-JSPI WebKit support claim is made.

Actual worker engine metadata in both executed backends: `engineVersion: rust-dsp-3.1`, `bridgeVersion: 2`, `schemaVersion: 1`, sample rate 24,000 Hz, maximum 7,200,000 samples. Requests load these unchanged, reverified local files through the recorded loopback server:

| Input | SHA-256 |
|---|---|
| Asyncify WASM | `504ff85abb81037ff0bc67945afc0f0d62feca25813dc190b7b0f6a07ea7a597` |
| Frozen candidate adapter | `2f2110a5ed2200ace3bae45ebf8638aee92fb0438dcbbfe4c768f29b9d0f26cb` |
| Frozen Asyncify host | `571a82045015e553e30ec8b99d03cedc0f56df920f4bec6cc2d556864d1c54fd` |
| Numerical reference WASM | `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1` |
| Numerical reference glue | `605173100548e3b3737e1ec7f32ef083329d76bc19a9eeafda3d557be8741fe2` |
| Actual Chrome executable | `b961b7f244d5f8c0ff27283ed505f5f0c87aa910b13fe12b708b5b4c92cdd1f8` |

Each parity run passes **18/18**, independently rechecked as UTF-8 byte equality, not just matching summary flags/hashes: small auto/monophonic/polyphonic; each of dense, real-solo and real-comp DEV windows in all three modes; empty/nonfinite/wrong-rate/invalid-JSON errors; successful reuse after errors; valid 300 seconds. Complete raw success strings contain both `result` and `features`; complete error strings and all output hashes are retained. `summary.json` provides all 36 case names, byte sizes, hashes, outcomes and recorded timing/stats. Three PCM sources and copies are independently rehashed; no new music corpus was consumed.

The 300-second two-tone polyphonic calls both actually succeed with duration **300**, 7.2M samples and **419,467** complete output bytes, SHA-256 `cf9bad3545cc357574cac65dbb5c0a501d106340da1d048c03425045c9135be7`, equal to their frozen reference. Chrome candidate elapsed 5,619.10 ms; WebKit 5,717 ms. The ≤120,000 ms single-call gate passed; cap errors could not pass. These are individual feasibility observations, not performance distributions or dense/real-recording 300-second coverage.

## Real CPU cancellation, not API-return evidence

Both use fresh actual module workers processing the valid 300-second PCM call. Entry is followed by a 450 ms page timer; the handler mark precedes `worker.terminate()` with no network await inside the claimed stop interval. The result comes from exact PID/TID/start-time identities in completed `/proc` censuses, not terminate return, worker exit events or unrelated thread disappearance. CLK_TCK = **100** (10 ms CPU tick granularity).

| Evidence | Chrome 136 direct | Linux WebKit through Playwright |
|---|---|---|
| DSP identity PID/TID/startTicks | `345823/345843/1790831` | `346387/346441/1796280` |
| Actual thread name | `DedicatedWorker` | `WebCore: Worker` |
| CPU growth between completed pre-handler censuses | **41 ticks** | **44 ticks** |
| Conservative first missing completed-census bound after handler | **34 ms**, PASS ≤250 | **117 ms**, PASS ≤250 |
| Continued absence after that first missing census | **2,379 ms** | **2,274 ms** |
| Total post-handler observation | 2,413 ms | 2,391 ms |
| Late replies | **0** | **0** |
| Censuses / maximum census duration | 123 / 21 ms | 133 / 20 ms |

WebKit identity evidence: the before-creation census ends at epoch ms `1793482067691`; worker source-entry census spans `1793482067701–1793482067712`, while the worker is paused before WASM initialization. **Exactly one new thread** appears: `346387/346441/1796280`, `WebCore: Worker`, zero ticks. That same identity persists through ready and real 300-second entry; it then grows 44 ticks during Rust processing. `t Helper Thread`, `HeapHelper` and `JITWorker` appear later. Busy helper threads retain their raw CPU records and persist after cancellation; they are not counted as DSP. Existing matcher already recognizes `WebCore.*Worker`, so it was never widened. Chrome's busy `ThreadPoolForeg` threads likewise remain separate and do not supply its stop proof.

Observer accounting is explicitly whole-Node-harness CPU including HTTP/orchestration, not isolated sampler overhead: Chrome user/system **1,872,378 / 385,992 µs** over 3,580.42 ms observer wall time; WebKit **1,631,420 / 366,182 µs** over 3,308.54 ms. All census start/end times, full thread records and process command lines remain in the original evidence. No claim of zero observer overhead, browser native memory bound, universal stack bound or performance distribution is made.

## Preserved attempts and hashes

The four original attempts are new directories beneath `target/cancel-browser-matrix/runs/`; two declared explicit attempts are beneath `target/cancel-browser-acceptance/runs/`. Full directory names and hashes are also machine-readable in `summary.json` and the final `delivery-inventory.json`.

| Timestamp/spec directory | Outcome | `evidence.json` SHA-256 |
|---|---|---|
| `2026-10-31T21-26-38.680Z-direct-chromium-parity` | PASS natural no-JSPI, 18 cases | `7a10e284cf425f43b8ae986710716512574141e4d6fcf8a4cda3657ae3d2ee0f` |
| `2026-10-31T21-26-52.956Z-direct-chromium-cancel` | PASS natural no-JSPI CPU stop | `9fdb12bb7be145c83953f9bc987f458d98518901da2cde992a925c33821cf4f1` |
| `2026-10-31T21-26-56.625Z-playwright-webkit-parity` | Retained scope rejection; analysis NOT RUN | `2dbb45962f72000a314242a2f867b4b970a5d42ded96ef2058fc042555caa168` |
| `2026-10-31T21-26-57.066Z-playwright-webkit-cancel` | Retained scope rejection; analysis/stop NOT RUN | `2d3bde1da337417bc0f834a7fe8351cfe9d07782f3c7d235a99728d37fce72c0` |
| `2026-10-31T21-27-33.222Z-playwright-webkit-parity` | PASS explicit Asyncify, 18 cases | `1ab4bd4ce5d4434d28040b1765a115f220a2d6575178db362582e073075bc5d5` |
| `2026-10-31T21-27-47.429Z-playwright-webkit-cancel` | PASS explicit Asyncify CPU stop | `803fb14238742d35a97823bcaa02eb6b50ce03ea7d4735dc86823f4be20109b5` |

NOT RUN: actual Safari/macOS, naturally no-JSPI WebKit, historical Firefox, full portable product/facade lifecycle, saved-session/retry/deadline/re-entry/trap sweeps, five product cycles, portable regeneration/build/adoption, full music rerun or performance distributions. Root's new canceled-request identity repair is not incorporated into this unchanged old feasibility fixture; neither its prior evidence nor the active original numerical WASM was modified. Prepared portable integration still needs root's separately identified facade repair and other adoption gates.

## Cleanup and heavy-window release

**PERFORMANCE-CLEAR: 2026-10-31T21:28:36.686098Z.** Exact final counts: **6** browser launches completed, **6** loopback servers closed, **6** profiles removed; **0** live owned processes/browsers/workers, **0** listening owned server ports, **0** remaining profiles, **0** remaining owned temp directories, **0** owned zombies. All six raw closeouts have `liveOwnedAfter: []`. A final one-time process/port inventory checked exact owned run paths and all six recorded ports; `target/cancel-browser-acceptance/cleanup.json` retains the evidence. Runtimes, package/library preparation, raw successes/failures and browser caches remain as evidence. No further heavy work is scheduled or retained; root may assign the next build. Subsequent report/inventory work is file-only.
