# Repaired portable browser/product execution

2026-10-31, independent Sol6.1 xhigh tester; no children. **Execution is complete for the declared bounded attempts. Adoption remains NO-GO.** The repaired artifact has useful functional passes, a real WPE compute failure, and explicitly incomplete scopes. No manual QA is requested.

Only new `validation/cancel-repaired-browser/**`, `target/cancel-repaired-browser/**`, and this report were written. Active source/generated assets, default dist/preview, sibling checkout, previous freezes/harness/evidence, corpora/labels/scorers/holdout and production/databases were read-only. No commit, push, deploy, install, physical microphone, or Safari run occurred. Browser IndexedDB was confined to fresh owned local browser contexts. No child agents, followups, watches, or schedules were created.

## Authority and exact identities

The actual root grant `target/cancel-repaired-browser-root-grant.json` SHA256 remains `ff8927915c65a96cda34a214189b316532c30c1b531d280cc111b50f7b526526`, released by root at22:31:01.889207+00:00. [Inventory](../target/cancel-repaired-browser/inventory.json), [initial scope release](../target/cancel-repaired-browser/scope-release.json), later prospective amendments and scope-specific run releases precede their execution. Initial inventory SHA256 is `b1cb44449c046ee8329f84232ae73960e5088ecdc33b66c2d4bc6ffdff871008`.

| Item | SHA256 |
|---|---|
| Candidate identity.json | `dc7dc27eb63bf03c384ae7bf1a5466eaad946d9819a4c5b8fc8e4db4a7a64bed` |
| Candidate220-entry inventory.json | `56ba0c4169ee9c2180f07056403b0f83cec0dda0974b3d1b3b810442c26806dc` |
| Source association | `646cbb9a09577a7362548c416959a2f5caf7dd4f13f94002f31ceb4955ef9f69` |
| Portable WASM | `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e` |
| Unchanged copied parent native CLI | `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa` |
| Consumed independent safety final-verification | `6aa7a0f7e6e165b33fbb4ac57ae0338bc71bb76ddb9a868b37e2aeeb2c92ab34` |

Engine remains rust-dsp-3.1, bridge2/schema1, portable-only. All220 frozen entries,473 protected active/prior files, and217 product files in **each of seven owned source copies** match before/after. All seven built WASM assets match the exact repaired bytes. Static tool/system/browser maps were independently rehashed before/after:2247 tool/dependency files,214 system files, and140/305/42/111 browser payload/library entries. [Final source/cleanup verification](../target/cancel-repaired-browser/final-verification.json) and [built/tool pins](../target/cancel-repaired-browser/final-tool-build-pins.json) retain the per-file hashes. Actual loaded/dlopen/native helper closure was not exhaustively certified.

The old preparation remains unchanged. All25 reviewed hook contexts match exactly; only the six declared candidate source paths differ from the parent. Runtime/glue/scheduler are unchanged. Root's [control recheck](rust-cancel-control-recheck.md) supplies the six authoritative repaired-artifact safety scopes, fresh generation and424 exact-output cases; those expensive audits were **consumed, not rerun or relabeled as new browser evidence**.

## Normal isolated checks — PASS

The actual normal verifier, `tsc -b`, and Vite production build pass on the exact owned candidate. Normal production output contains one portable WASM asset, with the exact repaired hash. Focused tests pass **25 tests**:18 runtime/ingest tests and7 analysis-worker/storage/WAV tests. The latter suite genuinely compiles an owned native CLI with direct Rust1.89 and exercises actual portable WASM/native parity and30/300s calls. Its newly built native hash is `12ee40b519f762815b862864041cf2193e35e2ddae5dd4a66195e13be6329a27`; it does not replace or relabel the copied authoritative832f CLI.

The first focused command selected only18 tests because the candidate's existing narrow Vitest config excluded three requested files. A separately owned explicit config ran those seven tests; no product config was edited. Exact commands, whitelist environment, UTC, stdout/stderr and actual status are under `normal-verify/`, `normal-types/`, `normal-build/`, `focused-tests/`, and `focused-excluded-v2/`. No shared dependency/cache-bearing parent or default build output was used.

## Actual built-product functional scope

Browsers used static production builds and private loopback ports, not a Vite development transform or default preview. The product workers, worklet, facade, storage/verification and WAV functions were real compiled source. This is API-level built-product testing, not a claim of clicking every React UI control.

- Chromium143 rev1200, Chrome136.0.7103.113, Firefox155 rev1543, and Linux WPE2359/reported26.0 each pass **18 complete raw byte/status comparisons**: three small modes, nine real fixture/mode comparisons, four exact errors, reuse after errors, and valid300. All72 comparisons preserve complete result/features/error strings with no normalization. Optimized numeric reference remains separately named/hashed.
- Source/backend/ready marks, actual fetched module paths and exact built hashes establish portable selection. Chrome136 ran directly without debugger connection and naturally had no JSPI APIs. Firefox launched with the real `javascript.options.wasm_js_promise_integration:false` preference and observed absent JSPI APIs. No WebAssembly API was deleted/replaced. WPE is Linux WebKit, **not Safari**.
- All four engines complete retained-PCM cancel/retry and immediate fresh-generation retry, preserve original input/hash/snapshot, reject forbidden later same-generation refinement, and reject late adoption.
- Each engine replays the **actual original successful refined event and reply** after cancellation, while a distinct forbidden same-generation request is pending, then replays the old generation during fresh analysis. These are controlled transport tests with genuine Rust results, **not DSP phase interruption proofs**.
- Chromium's old-engine fixture rejects default mismatch, keeps historical empty/partial metadata unchanged before successful explicit reanalysis, preserves it on cancel, and publishes current real results on fresh refinement. Failed-hash restore preserves caller-held inputs and allows a fresh verified restore/refinement. Actual worker reentry rejects later requests during initialization/busy work.

Five real30s cycles (mean/left/right/mean/left) completed in both Chromium engines:

- browser-chrome136-cycles-busy-1-life-v6: 5 cycles, 5 observed closed AudioContexts; all five channel comparisons have MSE0 against the independent filtered-source oracle.
- browser-chromium143-cycles-busy-1-life-v6: 5 cycles, 5 observed closed AudioContexts; all five channel comparisons have MSE0 against the independent filtered-source oracle.

Each successful cycle has genuine note evidence before Stop, exact observed/stored/exported sample counts, actual refinement, verified IndexedDB save/load, real PCM16 WAV playback with advancing media clock, saved-analysis restore, record deletion, runtime dispose and observed `AudioContext.state==='closed'`. The complete in-app worker/port/timer ownership ledger is **not** certified by these functional closes; final browser/process/profile/port cleanup is separately proven below.

Firefox and WPE paced cycles each time out at the declared360s budget with no completed cycle; their steady cases time out at150s. Retained traffic reaches worklet/PCM setup, but does not establish the precise blocking operation. Their WebAudio lifecycle/event-delay scopes remain **INCOMPLETE**, not product passes or established product defects. The runner's fixed “150s” timeout text is inaccurate for cycles; actual plan and measured elapsed are360s. No stalled case was repeated, no fake delay was inserted, and no production timeout was shortened.

Actual worklet partial-final-block coverage remains incomplete when no partial block occurred; its absence is reported instead of globally stopping useful lifecycle execution. A separate retained **controlled transport** test passes exact65536 and61696-sample credits/end-barrier/Stop/refine/export checks through real workers/Rust. It does not claim physical capture or an in-phase CPU proof.

## CPU-stop scope

These are whole-analysis worker proofs: actual unique realm/source/ready/raw-entry, unambiguous new PID/TID/startTicks, at least two complete pre-handler censuses and real CPU growth, first complete missing census within250ms, no post-gate presence/reappearance and continued observation beyond2750ms. Terminate-return alone never frees an owner or proves stopping. No exact additive per-phase CPU totals or observer-overhead subtraction is claimed.

| Actual case | PID/TID/startTicks | Pre-handler growth ticks | First confirmed absent ms | Observed through ms |
|---|---|---:|---:|---:|
| browser-chrome136-abort-busy-1-sync-final-v1 | 722213/722360/2488114 | 26 | 41.700 | 18776.700 |
| browser-chrome136-explicit-busy-1-sync-final-v1 | 723858/723935/2490249 | 24 | 42.800 | 20319.800 |
| browser-chromium143-abort-busy-1-sync-v3 | 653405/653420/2400305 | 16 | 21.100 | 17919.100 |
| browser-chromium143-explicit-busy-1-sync-v3 | 653550/653568/2402367 | 17 | 19.800 | 17820.800 |
| browser-chromium143-immediate-retry-busy-1-memory-v1 | 654706/654836/2404514 | 23 | 44.800 | 17227.800 |
| browser-chromium143-upgrade-busy-1-extra-v3 | 641508/641630/2383533 | 29 | 41.600 | 24439.600 |
| browser-webkit2359-explicit-busy-1-abort-v3 | 577798/577866/2249042 | 742 | 39.000 | 20797.000 |
| browser-webkit2359-immediate-retry-busy-1-abort-v3 | 578283/578350/2255930 | 695 | 23.000 | 17715.000 |

The memory-profile immediate-retry row is additional diagnostic evidence, not accepted compute timing. WPE's abort CPU evidence is the real abort path in its immediate-retry case; the original standalone v2 abort attribution remains incomplete. Chrome136 command exit1 in the corrected CPU cases comes from a transient remaining zombie at initial cleanup, while functional and CPU verdicts pass; original nonzero cleanup records are retained and final absence is independently checked.

Firefox corrected abort/explicit cases pass functionally but remain **INCOMPLETE** for CPU attribution: declared birth/source/ready/CPU association is ambiguous (`born=[]`, `busy=[]`), so no arbitrary worker was selected. Initial asynchronous censuses in other v2 cases also missed the required pre-analysis birth window. A separately declared synchronous census corrected that observer bottleneck without changing product hooks, thresholds, or earlier results.

Short phases/native helpers remain separate. Copy and first yield ended before the actual action. The near-finish action is bracketed by real tail timestamps, but its phase-specific CPU identity/growth/disappearance proof is missing. Restore hash action is bracketed by real hash timestamps; native helper CPU attribution is not established. Blob action followed the recorded Blob end, and decode has no complete end/CPU attribution. These are **INCOMPLETE** for the named CPU scopes even when functional cancellation/retry passes. Live dispose passes functionally but CPU association is ambiguous. The real live watchdog did not fire. The actual120s production refinement timeout did not fire because valid refinement completed earlier; it remains unexercised and was never shortened.

## Original performance gates

One declared3-warmup+15-retained pass per six windows ran in each browser: **432 actual worker calls total**. Identity-only source hooks are outside compute; no detailed hooks, per-phase network flood or `/proc` sampler ran in these profiles. Full actual `computeMs`, caller reply latency, raw rows and every threshold result are retained. The driver intentionally completes all six declared windows after a threshold failure; **functional script completion is not a timing PASS**.

- chrome136: **PASS**, six window p95s (ms): sideband 272.24, dense 114.74, real-solo 169.07, real-comp 125.08, noise 86.93, dense-boundary 61.32.
- chromium143: **PASS**, six window p95s (ms): sideband 274.40, dense 114.74, real-solo 169.31, real-comp 121.82, noise 90.16, dense-boundary 59.88.
- firefox155: **PASS**, six window p95s (ms): sideband 357.20, dense 126.80, real-solo 182.60, real-comp 118.60, noise 99.30, dense-boundary 75.60.
- webkit2359: **FAIL**, six window p95s (ms): sideband 557.80, dense 212.50, real-solo 291.30, real-comp 193.30, noise 128.80, dense-boundary 82.60.

**WPE sideband557.8ms>500ms is a real retained browser FAIL. No cost pass was repeated.** The parent's Node p95557.2169716ms remains FAIL on its own bytes. Root's repaired diagnostic remains unresolved, including block1 portable537.39608ms; the later491.3819969ms observation does not waive it. The972-call Node protocol was not run. No speedup, cross-engine causal explanation, adoption, or musical acceptance is claimed.

Both Chromium steady cases retain the original1.5s p95, no-growing-backlog, queue<=2, zero-skips checks:

- browser-chrome136-steady-busy-1-life-v4: p95 297.840 ms; max queue 2.
- browser-chromium143-steady-busy-1-life-v4: p95 345.925 ms; max queue 1.

Clean, separately declared **identity-only actual facade300s calls**, with no phase hooks/sampler, satisfy the original120s bound:

- chrome136: 8821.300 ms, **PASS** against120000 ms.
- chromium143: 10530.000 ms, **PASS** against120000 ms.
- firefox155: 7526.000 ms, **PASS** against120000 ms.
- webkit2359: 12133.000 ms, **PASS** against120000 ms.

Earlier detailed full300 timings are retained as diagnostic observations, not unchanged-scheduling/accepted-compute evidence. Successful completion before120s does not exercise the production timeout.

## Application audio buffers — INCOMPLETE

[Independent constructor/read/slice observations and limits](../target/cancel-repaired-browser/memory-summary.json) cover actual main, ingest, analysis and verification realms in immediate-retry and maximum300s cases. WeakMap backing IDs count same-realm shared views once; Blob slices retain parent-alias metadata, transfer tuples retain session/generation/request identity, and linear memory categories include saved stack once. No ownership is freed on terminate return.

The maximum case uses28,800,000 bytes of PCM and a14,400,044-byte WAV, with verified save/load, advancing playback and deletion. The two diagnostic runs retain7,795 and13,138 constructor/read records. Their cumulative observed allocations are **not a live peak or a complete conservative upper bound**: old/dead allocations, harness-retained inputs, unresolved cross-realm Blob/transfer aliases, killed-realm batch loss and missing allocation-to-observed-exit/lifetime joins prevent a full application-owned peak. Neither a96MiB PASS nor a concrete memory-cap violation follows from those cumulative totals or product status counters.

Largest independently categorized linear backing observed is40,435,712 bytes. The exact module's independently audited maximum2048 pages bounds linear memory at128MiB, with the saved stack counted inside it once. This does not fill the separate application-audio-buffer ledger gap.

The original cap remains **96MiB application-owned audio buffers**, including UI PCM, Blob/WAV and verification copies and old/new overlap. No universal browser/native/string/object GC certificate was added as a requirement. Missing audio ownership/alias/exit evidence, rather than that excluded native scope, keeps this verdict incomplete.

## Retained first failures and owned amendments

Every attempt remains under its original name. All changes are prospectively documented in owned amendments/releases; no old preparation, candidate source, output, or result was edited.

1. First browser parity was interrupted by a missing favicon treated as fatal; corrected static server returns ordinary404. The original failed request/result remains.
2. Initial matrix launch used tool-host `sys.executable`, which was Electron/AppImage and exited9 before Python/Node/build. Original plan/source and observed error/correction remain; subsequent orchestration explicitly uses `/usr/bin/python3`.
3. Aborted optional observation POSTs killed two WPE attempts. Only aborted `/__acceptance/marks` requests are now retained as observation loss; result/control/static failures stay fatal, and lost observations cannot satisfy proofs. Corrected bounded WPE attempts pass, while v2 failures remain.
4. Original paced harness required a partial block that did not occur, blocking otherwise useful scopes. New functional/partial-tail verdicts are separate, with exact total-count/channel checks retained.
5. Channel oracle used an unsupported fixed4096 alignment search and unfiltered source PCM, while production always applies its64-tap sinc filter even at24k. Captured failed left PCM from both browsers has SHA256 `39dec678d2e154e259b4fe629885e22a169ad3604ce668b5c3b78f13f588effc`. Independent offline direct convolution at the retained offset matches **711,808 actual samples exactly**, MSE0/maxabs0; original raw-oracle MSE was2.50763267757e-8. A new full valid placement span and independently computed filtered oracle preserve the1e-8 tolerance; both final five-cycle runs have MSE0 on every channel. Chrome136's first successful mean placement is6144 samples, beyond the old4096 limit. Historical v4 PCM not retained cannot be retrospectively proved fixed; its failure remains. [Diagnosis](../target/cancel-repaired-browser/pcm-oracle-diagnosis.json), both actual captured PCM files, all v4/v5 failures, source hashes and v6 prospective release remain.

New diagnostic constructor hooks and harness checkpoints are explained in their prospective files. They do not change numerical work, production source, WASM, original polling stride, budgets or waits. Detailed observations may change task pressure/time-based yield boundaries and are never used as clean compute acceptance.

## Exact artifacts, commands and cleanup

[Per-case findings](../target/cancel-repaired-browser/findings.json) index all **73 actual browser attempts**, including timeouts and first failures, raw record hashes, functional/CPU/phase/performance verdicts and exact identities. Each bounded execution command has its actual argv, cwd, whitelist environment, UTC, stdout/stderr and exit/signal in its owned execution command directory (`command.json`, `result.json`, `stdout.log`, `stderr.log`). `commands.json` indexes them. Source/executor paths are under [the owned harness](../validation/cancel-repaired-browser/); all copies/cache/Cargo target/temp/output/profile/server state were owned. No full runtime or corpus copy, installation or global cache write was used.

Final verification confirms **73 distinct owned server ports closed, zero owned processes, zero direct or actual nested Playwright profiles, and zero open owned ports**. Five earlier direct-Chrome cleanup records each reported one transient zombie; all are now absent. Browser server close, direct process-group termination, Node/wrapper completion and server closure were awaited. All73 cleanup records remain, including nonzero first cleanup statuses. Complete in-app resource lifetime accounting is still incomplete; final external cleanup is not used to fake it or to free buffers at terminate-return.

`SHA256SUMS` pins the owned source, exact source-copy inventories, builds, reports and execution evidence (not large scratch build caches). The explicit final heavy release is [heavy-release.json](../target/cancel-repaired-browser/heavy-release.json), issued only after owned execution/processes/ports are gone. Root can integrate these findings or assign fixes; no adoption, manual QA dependency or followup work is scheduled.
