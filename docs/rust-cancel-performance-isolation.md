# Cancellation performance isolation — unresolved, no repair

2026-10-31, Sol6.1 xhigh implementation sub-agent, working alone. **The two authorized DSP diagnostics are complete. Neither reproduced its retained500ms failure. No production defect or small exact-output repair is demonstrated, so no patch was made. Adoption remains NO-GO.** There was no broad acceptance campaign,972-call gate, numerical change, guard change, commit, push, deployment, installation, or production/database access.

Only new `validation/cancel-performance-isolation/**`, `target/cancel-performance-isolation/**` and this report were written. Browser source is an ordinary owned copy; original candidate and active/default build/preview remained read-only. Native832fb091… was not built or executed. No children, followups or agent waits were used.

## Authority, red feedback and limits

The actual [root grant](../target/cancel-performance-isolation-root-grant.json) hashes to `09d6f146e9e515df87ddfe93c008aed0d860ac45cc632afab9561b64af406bbb`, issued23:32:44.186252+00:00 after the browser owner's release. Before each execution, an executor release derived from those actual grant bytes bound the prospective hypotheses, protocol, input/tool/source pins, clocks, call/total/trace limits and no-repeat policy:

- [A setup preparation](../target/cancel-performance-isolation/A-preparation.json), [release](../target/cancel-performance-isolation/A-release.json), [protocol](../validation/cancel-performance-isolation/A-protocol.json).
- [A corrected binding](../target/cancel-performance-isolation/A2-preparation.json), [release](../target/cancel-performance-isolation/A2-release.json), [prospective setup correction](../validation/cancel-performance-isolation/A2-protocol.json). Preparation SHA256 `35f1303bd1c0faab036120bba8bda666dd929f3d8baec647d030c43465dbe80e`; release `6ba41c176aec545dd40b303480e5678f1fd35ac08e9b384e7de79eb2cc780600`.
- [B preparation](../target/cancel-performance-isolation/B-preparation.json), [release](../target/cancel-performance-isolation/B-release.json), [protocol](../validation/cancel-performance-isolation/B-protocol.json). Preparation `935c6a5e2a5a6f8e2424bb15c1017d29f77d09a8bcdb593968e53ecea64f03d0`; release `1e9d9ddeced6d32dc4461d8e54360b06a1cbf501e529598a7b74d06611c850b6`.

The diagnosing-bugs skill was applied with an explicit limitation: retained measured red feedback exists, but there is no proven fast, repeatable minimal reproducer. The authorized bounded experiments preserve the stated workloads/history; they do not meet the skill's full minimization/reproducibility condition. No repeat-until-red or pass was attempted. A new [retained-row arithmetic check](../target/cancel-performance-isolation/historical-wpe-red.json), without executing an engine, reconfirms WPE p95 **557.8ms FAIL**. Its15 retained samples are399,395,392,388,388,385,472,530,562,556,528,513,526,526,518ms: eight exceed500ms, rather than a single isolated high sample. Original functional exit0 never changes that timing verdict. Parent oldfe Node557.2169716ms, repaired observation block1 537.39608ms and its block2 491.3819969ms remain separate unchanged historical results.

Ranked prospective discriminations were: (1) numerical reference also slow; (2) relative portable transformation/import/guard/rewind cost; (3) V8 compilation/runtime; (4) machine execution rate/run delay; (5) task/GC delay. Predictions were respectively matched reference slowing, persistent matched relative cost, aligned compiler/runtime evidence, rate/delay changes, and long queue/GC overlap. Attribution cannot exceed observation resolution.

## Exact identities and tooling

| Binding | SHA256 |
|---|---|
| Repaired identity | `dc7dc27eb63bf03c384ae7bf1a5466eaad946d9819a4c5b8fc8e4db4a7a64bed` |
| Repaired220-entry inventory | `56ba0c4169ee9c2180f07056403b0f83cec0dda0974b3d1b3b810442c26806dc` |
| Source association | `646cbb9a09577a7362548c416959a2f5caf7dd4f13f94002f31ceb4955ef9f69` |
| Repaired portable WASM | `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e` |
| Optimized synchronous reference | `7b40ba5ce7fb9018a510c8ddb063304839a9d28abf58675953cbd3093fb23e73` |
| Active synchronous Node control | `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61` |
| Node24.22.2 executable | `904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52` |
| WPE2359 actual MiniBrowser binary | `7c71efed38fb0d916f5edb7db9a98cdf218642dd8dce02375730eb9ad5510751` |
| WPE private-library launcher | `f0c54e3a4ce47d5af0900ff522194c233bc696ed9891263ec0dc86f0ed48c7c8` |

The preparation files contain complete named-file maps, actual existing WPE library inventory and tool-inventory hashes, staged glue/runtime hashes and all six PCM hashes. Engine remains rust-dsp-3.1. Candidate bridge2/schema1; reference bridge1/schema1. Both built WASM assets have the exact named hashes. Rust/Binaryen were unnecessary and not invoked. The inherited tool inventories were consumed; no new generation/safety certification is claimed.

## A: one matched WPE DSP comparison

[Full72 raw calls](../target/cancel-performance-isolation/wpe-matched-first/raw.json), [incremental call journal](../target/cancel-performance-isolation/wpe-matched-first/calls.jsonl), [analysis](../target/cancel-performance-isolation/wpe-analysis.json), [launch](../target/cancel-performance-isolation/wpe-matched-first/launch.json), [cleanup](../target/cancel-performance-isolation/wpe-matched-first/cleanup.json).

One Linux WPE2359/reported26.0 process used two module workers, initialized optimized then portable, reused across sideband then dense. For each fixture, pair index0..17 alternated optimized/portable and portable/optimized. Each artifact/window has three warm and15 retained calls, **72 calls total**. No phase hooks or network sampler ran. All result/feature strings match completely as UTF8 bytes on every call; raw text is retained. No error occurred, and no extra negative-input DSP calls were added.

| Window | Optimized p50 / p95 / max ms | Portable p50 / p95 / max ms |
|---|---:|---:|
| sideband | 241 /262.9 /272 | 283 /335.8 /368 |
| dense | 98 /125.3 /126 | 115 /141.8 /146 |

The adjacent-pair median portable-minus-optimized difference is41ms sideband and16ms dense. These are differences between separate nearby calls, not an exact additive cost partition. Neither engine exceeded500ms in a retained call. This weakens an always-slow-numerical-baseline explanation for **this run** and establishes a relative portable-path cost here. It does not explain the historical WPE regime change or assign the relative cost to Asyncify, guards, rewind, polls, or a compiler tier. No failure is cleared by nonrecurrence.

The worker body, request validation, `parseOutput`, memory checks and `computeMs` expression are copied from the exact candidate. The reference changes only backend import/URL and its actual bridge1 check; an ABI adapter exposes sync numeric analysis as a Promise. Candidate portable glue/runtime/WASM remain exact. Compute includes PCM-view/options construction, generated call, JS parsing/output validation and memory check, ending before postMessage. Full raw text is appended after the compute boundary. Main-page reply latency is separately retained. All fixtures are the same pinned Float32 PCM at24kHz with `{mode:'auto',concertAHz:440,spelling:'sharps'}`. Observed WPE clock values here are integer milliseconds; no finer precision is inferred.

Unavoidable differences from the original six-window product profile: two separate worker realms/instances rather than one, only two windows, alternating order, owned Vite worker-entry build rather than the entire application, no original identity hooks, reference ABI adaptation, full output transport/persistence between calls, and different initialization/allocation/compiler history. Transport is outside compute but can affect later history. These prevent interpreting the gap as a controlled guard/rewind subtraction or the quiet result as repaired product acceptance. Linux WPE is not Safari.

**Preserved setup failure:** [wpe-first](../target/cancel-performance-isolation/wpe-first/result.json) rejected reference bridge1 at the product bridge2 initialization check, with zero DSP calls. A DSP-free Node initialization probe confirmed reference metadata. The prospective A2 correction changes only the reference check to1, preserving the candidate check2. One matched DSP comparison then ran. This is a setup correction, not a repeated performance campaign; the failed setup and its zero-process/closed-port cleanup remain intact.

## B: one342-call Node CPU/compilation trace

[Command/environment](../target/cancel-performance-isolation/node-trace-first/command.json), [all incremental calls](../target/cancel-performance-isolation/node-trace-first/calls.jsonl), [19 rows](../target/cancel-performance-isolation/node-trace-first/cost-prefix.json), [phase/GC records](../target/cancel-performance-isolation/node-trace-first/observations.json), [CPU profile](../target/cancel-performance-isolation/node-trace-first/traces/cpu.cpuprofile), [compilation/runtime trace](../target/cancel-performance-isolation/node-trace-first/traces/events.json), [compilation stdout](../target/cancel-performance-isolation/node-trace-first/stdout.log), [context](../target/cancel-performance-isolation/node-trace-first/context.jsonl), [analysis](../target/cancel-performance-isolation/node-analysis.json), [trace alignment](../target/cancel-performance-isolation/trace-alignment.json).

The prior supervisor/driver/staged observer were reused in owned copies. [Observation delta](../target/cancel-performance-isolation/node-observation.patch) preserves their provenance. Optimized→active→portable initialization, all18 block1 rows, then block2 portable sideband, three warm+15 retained, original scheduler/options and complete-string output comparisons remain. **342 calls completed, normal exit0, portable closed, no deadline/cap fired.** First and last trace timestamps cover initialization and both portable sideband rows. Detailed hooks run on both portable sideband rows, including warmups, instead of only block2. Per-call hrtime brackets and incremental persistence are additional observations outside the measured interval and can change history.

| Portable sideband | p50 ms | p95 ms | max ms |
|---|---:|---:|---:|
| block1 | 287.187 | 356.015 | 465.372 |
| block2 | 291.097 | 299.835 | 303.923 |

Neither retained row exceeds its500ms p95 threshold. This is nonrecurrence under profiling, not uninstrumented performance acceptance or an explanation of the previous537.4ms row.

The slowest retained call, `1/portable/sideband/3`, is465.371624ms wall and464.449ms main-thread CPU. Its ten raw interiors total464.307861ms; nine task-post→handler interiors total0.510495ms and handler→continuation totals0.047772ms. These are wall interiors, not exact CPU partitions. Of409 CPU samples in its hrtime interval,407 have WASM leaves, one is `(program)` and one `now`. Function names are index-only (`wasm-function[4]` has155 leaf samples); there is no source/guard/rewind attribution at this resolution.

Compilation overlaps this slow call on four helper threads; union spans per helper are1.168,1.634,0.276438 and0.524438ms. No named compilation span on the main thread and no recorded main-thread GC span overlap it. The external schedstat bracket records1.327811ms additional run delay across a slightly wider interval. These observations weaken dominant task-wait, descheduling-only, main-thread GC or direct main-thread compilation explanations **for this captured call**. They neither exclude helper interference/tiering effects nor explain historical spikes. Nested compiler durations were unioned per thread, never added across threads or subtracted from the gate.

The same slow call has same-CPU CPPC delivered/reference ratios1.715,1.602,2.102; the block1 median call has2.485,2.451. This is consistent with differing CPU execution-rate context, but not proof: counters cover whole CPUs, samples are sparse, migration occurs, no per-thread effective-frequency or instruction count exists, and work/tier equality is unproved. `cpuinfo_cur_freq` is unavailable; `scaling_cur_freq` is retained only as instantaneous context. The final block2 slowest call has no complete post-call external bracket; its run-delay comparison remains unavailable.

All selected block2 calls are likewise dominated by WASM samples with no overlapping named compiler/main-GC span. GC records collected after the first portable-sideband observer start range0.208..1.198ms and are preserved; absence outside that observer scope is not a universal no-GC assertion. Trace helper coverage and index-only main-thread samples cannot certify numerical versus transformed/guard work. **No demonstrated redundant-work bug or meaningful failing repair test seam was found.** No test was invented to manufacture a repair.

### Trace support, clocks, bounds and deviation

The [DSP-free plumbing probe](../target/cancel-performance-isolation/setup/trace-plumbing/clock.json) verified Node24.22.2 CPU-profile JSON and traceEvents JSON before the DSP execution. Existing `--v8-options` confirms the compilation flag. CPU-profile start/end and trace `ts` are monotonic microseconds; the probe's hrtime ns/1000 bracket lies inside the profile and observed trace clock range. Actual calls retain direct hrtime bounds. [clock-map](../target/cancel-performance-isolation/node-trace-first/clock-map.json) supplies the performance.now/UTC association; read skew is not assumed zero. Compilation stdout arrivals are timestamped in the supervisor journal only as arrival upper bounds. No clock or observer cost is subtracted.

Exact child flags:

```text
--cpu-prof --cpu-prof-interval=1000
--cpu-prof-dir=OWNED/node-trace-first/traces --cpu-prof-name=cpu.cpuprofile
--trace-event-categories=v8,v8.wasm,node.perf
--trace-event-file-pattern=OWNED/node-trace-first/traces/events.json
--trace-wasm-compilation-times
```

The child runs through `/usr/bin/prlimit --fsize=12582912:12582912`; two trace files are individually limited to12MiB and stdout/stderr individually capped at4MiB by the supervisor, totaling at most32MiB. Actual CPU profile887,246bytes, events859,349bytes, compilation stdout138,286bytes, stderr0: **1,884,881 trace/log bytes**, no truncation. Supporting call/context journals are separately bounded by342calls/180s. Timeout limits remain180s total/5s per call, group termination then kill, with no repeat/extension. CPU sampling, helper events, logs, both detailed rows and context observation can perturb compiler/task/thermal behavior; these traces cannot quantify their own overhead.

**Context cadence deviation:** the external timer was nominal100ms;596 samples have observed spacing99.153..101.070ms. Thus a strict minimum100ms-spacing reading of “at most10Hz” is not satisfied by this implementation (small timer jitter), despite the nominal10Hz schedule. The limitation is retained rather than hiding or rerunning it. This context is diagnostic only. A future independently authorized implementation could enforce monotonic minimum spacing; no additional trace is proposed here.

## Commands and handoff

All commands ran from `/home/xtra/code/personal_projects/fretbloom-song-audit`. Node means `.tools/node-v24.22.2-linux-x64/bin/node`, with absent NODE_OPTIONS. The prospective releases, scripts and command records pin the exact arguments; relative paths below are for readability, **not instructions to repeat the diagnostics**. Output directories use exclusive creation to protect first evidence.

```sh
/usr/bin/python3 validation/cancel-performance-isolation/prepare.py
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-performance-isolation/build.mjs
/usr/bin/python3 validation/cancel-performance-isolation/freeze.py A
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-performance-isolation/browser.mjs
# zero-DSP bridge setup correction, preserved A2 protocol; owned build/freeze A2
/usr/bin/python3 validation/cancel-performance-isolation/freeze.py A2
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-performance-isolation/browser.mjs
/usr/bin/python3 validation/cancel-performance-isolation/freeze.py B
.tools/node-v24.22.2-linux-x64/bin/node target/cancel-performance-isolation/supervisor.mjs
/usr/bin/python3 validation/cancel-performance-isolation/analyze.py
/usr/bin/python3 validation/cancel-performance-isolation/closeout.py
```

`setup/` retains syntax/build stdout/stderr, V8 option support, DSP-free profiling clock probe and reference initialization metadata. No failed attempt was overwritten. The frozen preparation copies document the exact earlier scripts; final browser.mjs selects corrected A2, and the separate final supervisor selects B. Unused Node setup files changed between A and B while only owned preparation was being completed; they are not claimed as consumed WPE bindings. All measured browser source/dist/staged inputs remained pinned for their executions.

**Handoff:** preserve the original failures and NO-GO. The measured relative portable cost and anonymous-WASM-dominated trace do not identify a removable duplicate computation. No patch, numeric424 campaign, extra causal repro, safety redesign, or new acceptance run was warranted. Any future instruction-level attribution would need source/index mapping and separately authorized controls; changing guards, checkpoint64,50ms budget, thresholds, passes or peak caps is unsupported.

[Final bounded verification](../target/cancel-performance-isolation/final-verification.json) rehashes all220 frozen entries and146 external named pins, including candidate identities, exact WASM, active numeric controls, prior diagnostic inputs and WPE runtime inventory. Seven owned PIDs are absent, both static server ports40311/35401 are closed, owned environment census is empty and no owned profile remains. Both browser cleanup records and Node reap/group checks are retained. These checks do not claim an exhaustive system inventory or application-internal lifetime proof. The explicit [exclusive-heavy release](../target/cancel-performance-isolation/heavy-release.json) is issued only after zero owned processes/ports/profiles are established. No further heavy execution is scheduled.
