# Independent cancellation repair validation — NO-GO

2026-10-31T21:21:09.590436+00:00. Sol 6.1 xhigh independent tester. No subagents, adoption or product edits.

The immutable JSPI candidate is not independently accepted for release. The retained standalone JSPI sideband cost fails (block 1 p95 770.59 ms >500 ms), and a real canceled-request refined event bypasses the facade fence while another refine RPC is pending. A failed gate remains failed; an unproved path remains incomplete. Builder claims are not counted as independent passes. This is cancellation/output-equivalence work, not a musical accuracy upgrade; established recognition failures remain baseline behavior.

**Identity and protocol.** Inputs/expectations were frozen before candidate source inspection/execution: `validation/cancel-repair/expectations.json`, SHA-256 `6355749d23139b73164044d0b2dae4f0d8d157f7615da9b02714b165240de5f6`. The frozen candidate source is `3b248453e4f5d5d5702c6718f7fbdd9113bba4043132288df1574c0255084d1b`; WASM `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1`; native `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`. The complete builder freeze (179 inventory entries) was independently hashed before copying into `target/cancel-repair-test/context`. All twelve production analysis Rust files match the optimized numerical baseline. See [association](../target/cancel-repair-test/frozen-association.json), [source review](../target/cancel-repair-test/source-review.json), [handoff/clearance](../target/cancel-repair-test/handoff.json).

Builder heavy work was explicitly clear; compatibility explicitly released all measurements at 21:06:26.598Z. Builds, parity, cost, lifecycle and browser runs here ran sequentially. Although other owners had agreed to avoid heavy work, root later reported an unexpectedly expensive portable-builder source-only WAT scan at 21:13:21–21:17:33Z and failed coordination sends. Most browser cases overlap that interval and cannot be described as uncontended. Cost-file creation/last-write bound every candidate cost row to **21:10:10.045–21:11:54.806Z**, before that known interval: the reported WAT scan does not explain the observed 770.59 ms cost failure. Per-row UTC was not stored; no finer timing is invented. Uncontrolled desktop load remains unexcluded and no row is discarded. [Exact contention provenance](../target/cancel-repair-test/contention-provenance.json). Node 24.22.2, Rust 1.89.0, wasm-bindgen 0.2.100, Linux/i7-1165G7; browser flags and actual feature branch are retained per run.

**Independent passes.** Fresh Cargo-target normal `wasm-build.mjs --check` reproduces all four generated artifact bytes; ordinary verifier and TypeScript pass; source/artifacts remain unchanged. Native rebuild is byte-identical. Default analysis/bridge tests pass from a clean Rust source copy containing no `.f32le` files (45 passed, 5 explicitly ignored across library/integration suites). The requested frozen test fails with a clear `FRETBLOOM_COST_PCM_DIR` error when undeclared and passes with the declared four hash-verified files. [Build result](../target/cancel-repair-test/build-result.json), [commands](../target/cancel-repair-test/commands.jsonl).

All 424 established WASM boundary/options cases have exact complete result+feature/error bytes in both synchronous and actual task-suspended JSPI calls; differences: 0. No JSON normalization. The existing full native numerical suite is reused only because native bytes match its established optimized baseline. Real ABI execution also covers initialized externrefs, 210 exact repeated Rust JSON errors with stable table length, numeric suspension returning zero/one, traps, rejected suspensions and both init paths. The read-only builder ABI harness was executed independently against the tester copy; its prior result was not reused. [Parity](../target/cancel-repair-test/parity.json), [ABI](../target/cancel-repair-test/abi.json), [large call parity](../target/cancel-repair-test/large-parity.json).

**Cost.** Three predeclared alternating blocks, six fixed windows, three warmups plus fifteen retained samples, complete generated copies/JSON included. Actual product task scheduler and async adapter are used for the candidate; module initialization/file I/O are excluded. Every sample/load row remains. [Raw cost](../target/cancel-repair-test/cost.json), [gate results](../target/cancel-repair-test/cost-gates.json).

| Block | Window | Baseline p95 ms | JSPI p95 ms | ≤500 ms | Paired no-slower |
|---|---|---:|---:|---|---|
| 1 | sideband | 310.20 | 770.59 | FAIL | FAIL |
| 1 | dense | 113.69 | 189.10 | PASS | FAIL |
| 1 | real-solo | 242.03 | 210.57 | PASS | PASS |
| 1 | real-comp | 174.95 | 114.14 | PASS | PASS |
| 1 | noise | 122.76 | 119.15 | PASS | PASS |
| 1 | dense-boundary | 133.89 | 64.73 | PASS | PASS |
| 2 | sideband | 368.96 | 280.77 | PASS | PASS |
| 2 | dense | 340.51 | 123.53 | PASS | PASS |
| 2 | real-solo | 334.47 | 165.27 | PASS | PASS |
| 2 | real-comp | 134.90 | 112.11 | PASS | PASS |
| 2 | noise | 101.41 | 87.92 | PASS | PASS |
| 2 | dense-boundary | 65.16 | 57.99 | PASS | PASS |
| 3 | sideband | 313.73 | 483.78 | PASS | FAIL |
| 3 | dense | 109.20 | 165.65 | PASS | FAIL |
| 3 | real-solo | 316.81 | 208.26 | PASS | PASS |
| 3 | real-comp | 190.82 | 130.30 | PASS | PASS |
| 3 | noise | 132.49 | 92.50 | PASS | PASS |
| 3 | dense-boundary | 64.31 | 61.30 | PASS | PASS |

**Real browser processing stop.** Passive timestamps surround actual product WASM entry and owner termination. `/proc` censuses have complete start/end bounds and thread-birth ticks; only complete pre-handler samples count as busy proof. Direct Chromium has no debugger/remote-debugging connection. Playwright uses its normal browser pipe and no worker attachment. All observations extend beyond the old two-second tail when the case completes. A late first absence without a post-gate sighting is incomplete, not proof that CPU actually continued. No completed latency attempt is rerun to seek a pass. The parent/disposal and watchdog cases with competing or insufficient busy-thread evidence remain incomplete.

| Case | Functional outcome | CPU-stop evidence | Bound ms | Pre-handler growth ticks |
|---|---|---|---:|---:|
| direct-abort-setup-fixed | completed | passed | 94.3 | 10 |
| direct-deadline-setup-fixed | completed | incomplete | 279.7 | 16 |
| direct-explicit-setup-fixed | completed | passed | 104.6 | 15 |
| direct-live-dispose-setup-fixed | completed | incomplete | — | — |
| direct-live-watchdog-setup-fixed | completed | incomplete | — | — |
| direct-reentry-setup-fixed | completed | separate gate | — | — |
| direct-restore-abort-setup-fixed | failed | incomplete | — | — |
| direct-upgrade-setup-fixed | completed | passed | 205.7 | 22 |
| playwright-abort-setup-fixed | completed | passed | 99.2 | 10 |
| playwright-canceled-queued-reply-first | failed | incomplete | — | — |
| playwright-deadline-setup-fixed | completed | passed | 109.6 | 37 |
| playwright-explicit-setup-fixed | completed | passed | 78.2 | 10 |
| playwright-full30-setup-fixed-1 | completed | separate gate | — | — |
| playwright-full30-setup-fixed-2 | completed | separate gate | — | — |
| playwright-full30-setup-fixed-3 | completed | separate gate | — | — |
| playwright-full300-setup-fixed-1 | completed | separate gate | — | — |
| playwright-full300-setup-fixed-2 | completed | separate gate | — | — |
| playwright-full300-setup-fixed-3 | completed | separate gate | — | — |
| playwright-late-reply-first | failed | separate gate | — | — |
| playwright-live-dispose-setup-fixed | completed | incomplete | — | — |
| playwright-live-watchdog-setup-fixed | completed | incomplete | — | — |
| playwright-reentry-setup-fixed | completed | separate gate | — | — |
| playwright-restore-abort-setup-fixed | failed | incomplete | — | — |
| playwright-upgrade-setup-fixed | completed | passed | 102.4 | 10 |

Each [browser directory](../target/cancel-repair-test/browser) retains raw marks/censuses, source instrumentation, launch command, local requests, final/failure JSON and cleanup. Successful cancellation workflows assert the unchanged stopped snapshot, no late real refined/timeline adoption, actual retained PCM SHA-256, forbidden same-generation retry and successful fresh-generation restore/refinement. The saved prior/upgrade snapshots in these workflows are metadata-only; richer historical-result preservation is not claimed from them. Restore decoding that completed before a controllable abort is explicitly unexercised, not a product pass. Live tests use real protocol-fed PCM; five-cycle and steady tests separately use paced real WebAudio/worklet transport.

**Retained late-event race.** [Supplemental declaration](../validation/cancel-repair/late-reply-expectations.json) freezes a deterministic real-facade test before its execution. A validated event produced by actual Rust is withheld at delivery and replayed after its request ended while a different, forbidden refine RPC is pending. No replacement engine/analysis output is used. The raw observation also checks an old-generation event during a fresh generation.
Case `playwright-canceled-queued-reply-first` (original RPC canceled before replay: True): consumer refined count 0 → 1; newer forbidden RPC succeeded: False. Old-generation replay count 1 → 1; fresh generation succeeded: True. Any increase in the first pair is a failed late-reply gate. Source fence currently checks any pending refine, rather than identity of the event's ended request.
Case `playwright-late-reply-first` (original RPC canceled before replay: False): consumer refined count 0 → 1; newer forbidden RPC succeeded: False. Old-generation replay count 1 → 1; fresh generation succeeded: True. Any increase in the first pair is a failed late-reply gate. Source fence currently checks any pending refine, rather than identity of the event's ended request.

The distinct [canceled-original confirmation](../validation/cancel-repair/canceled-queued-reply-expectations.json) retains the first narrower ended-success-event test, then withholds both the real original reply and event before aborting the still-pending original RPC. This is a separately declared counterexample confirmation, not a latency/cost rerun or substituted result. Actual old replies/events and all observations are retained in the corresponding raw/result JSON.

**Full refinement, live delay and resources.**

```json
{
  "fullRefinementMs": {
    "full30": {
      "samples": [
        1105.5,
        1171.300048828125,
        1282.300048828125
      ],
      "p50": 1171.300048828125,
      "p95": 1271.200048828125,
      "max": 1282.300048828125
    },
    "full300": {
      "samples": [
        11606.5,
        11541.699951171875,
        11536.800048828125
      ],
      "p50": 11541.699951171875,
      "p95": 11600.019995117187,
      "max": 11606.5
    }
  },
  "steadyLive": {
    "patches": 45,
    "p50Ms": 827.6000000014901,
    "p95Ms": 861.940000000596,
    "maxMs": 867.5,
    "maxQueue": 2,
    "maxSkipped": 0,
    "longTasks": []
  },
  "fiveCycles": {
    "status": "passed",
    "count": 5
  },
  "memoryCounters": {
    "maxReportedOwnedJsBytes": 87514112,
    "maxObservedWasmLinearBytes": 39387136,
    "ownedJsLimit": 100663296,
    "wasmLimit": 134217728,
    "immediateRetryAggregateVerified": false,
    "physicalMemoryCertified": false
  },
  "actualProductWorkerCost": [
    {
      "name": "dense",
      "rawMs": [
        117.60000000149012,
        149.30000000074506,
        119.30000000074506,
        118.10000000149012,
        116.90000000223517,
        115.29999999701977,
        113.10000000149012,
        113.90000000223517,
        143.80000000074506,
        143.39999999850988,
        139.40000000223517,
        154.39999999850988,
        147.69999999925494,
        131,
        123.80000000074506
      ],
      "p95": 150.8300000000745,
      "max": 154.39999999850988
    },
    {
      "name": "sideband",
      "rawMs": [
        271.9000000022352,
        287.30000000074506,
        276.5,
        270.5,
        281.69999999925494,
        276.19999999925494,
        287.6000000014901,
        305.1000000014901,
        319.69999999925494,
        284.1000000014901,
        277.9000000022352,
        299.69999999925494,
        317.9000000022352,
        283.5,
        277.9000000022352
      ],
      "p95": 318.4400000013411,
      "max": 319.69999999925494
    },
    {
      "name": "real-solo",
      "rawMs": [
        167.5,
        164.59999999776483,
        167.19999999925494,
        169.10000000149012,
        178.39999999850988,
        174.90000000223517,
        169.09999999776483,
        175.09999999776483,
        167.5,
        165.19999999925494,
        169.10000000149012,
        173.80000000074506,
        180.40000000223517,
        174.59999999776483,
        191.29999999701977
      ],
      "p95": 183.67000000067054,
      "max": 191.29999999701977
    },
    {
      "name": "real-comp",
      "rawMs": [
        129.80000000074506,
        136.89999999850988,
        124.69999999925494,
        120.60000000149012,
        114.89999999850988,
        114.10000000149012,
        112.89999999850988,
        111.80000000074506,
        112,
        111.80000000074506,
        112,
        111,
        110.60000000149012,
        110.80000000074506,
        109.80000000074506
      ],
      "p95": 131.9300000000745,
      "max": 136.89999999850988
    }
  ]
}
```

The three valid 30/300 s runs use the frozen repeated polyphonic seed, real restore/hash/analysis workers and unmodified production 120 s budget. They are staged retained PCM, not 300 s of microphone playback. Main-thread steady delay uses all pre-Stop patches; queue/skips/long tasks are separate from compute. The final actual-product-worker cost probe uses no /proc sampler and reports 3 warmups +15 retained windows per input. It is distinct from the retained failing standalone Node block and does not erase it. Five mixed WebAudio start/Stop/refine/discard cycles close AudioContexts and owned workers; the helper’s dispatch-only cancellation is not used as processing-stop proof. [Steady](../target/cancel-repair-test/steady.json), [cycles](../target/cancel-repair-test/cycles-mixed.json).

Successful WASM replies expose the grown linear-memory size (WASM memory cannot shrink); the linked maximum is 128 MiB. Owned-JS status is a bounded product counter, not physical/native memory. Immediate-retry overlap across old/new workers, JSPI stack allocation, physical microphone tracks, direct MessagePort/timer allocation census, and complete browser-native memory remain unvalidated. The late-observation wait before ordinary retry means those runs do not certify immediate overlap. No audio uploads were introduced: test requests are loopback source/assets, metadata marks and output JSON; audio is fetched locally and retained in workers. Browser-native background traffic is not claimed to be exhaustively metered.

**Unfinished release gates.** Early boot, around-yield and near-completion phase sweeps; independent complete pre-copy/first-poll/max-poll/last-poll-to-reply phase matrix; Blob/hash-phase restore abort; immediate retry aggregate buffers/native stack; any path with incomplete busy/stop evidence above; full supported-browser scope. The immutable candidate still has a known failing synchronous Chromium branch. Compatibility feasibility is a separate unintegrated artifact and cannot waive that failure. WebKit/old-Chromium scope belongs to the separate browser-matrix owner. Musical recognition remains unchanged, including its existing failures.

**Preserved failures and commands.** First browser commands failed at output-directory creation (`ENOENT`) before creating any browser/server/profile. They remain in `acceptance-commands.jsonl` and individual logs. [Dated setup correction](../validation/cancel-repair/browser-followup.json) declares the first actual browser batch; no artifacts, expectations or latency thresholds changed. Raw sampling gaps/ambiguous identities, functional failures, failed timing blocks and stale-event observations are retained. [Initial command index](../target/cancel-repair-test/acceptance-commands.jsonl), [actual browser commands](../target/cancel-repair-test/browser-commands.jsonl), [final confirmation/parity/worker-cost commands](../target/cancel-repair-test/final-commands.jsonl), [runner instructions](../validation/cancel-repair/README.md).

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-repair/verify-build.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-repair/run-acceptance.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-repair/browser-batch.py
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-repair/large-parity.mjs
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-repair/report.py
```

These are retained run commands, not instructions to overwrite evidence. Runner guards refuse existing inventories/run directories. Final ownership-scoped cleanup, unchanged active/frozen identities and evidence hashes are in [closeout](../target/cancel-repair-test/closeout.json) and [delivery inventory](../target/cancel-repair-test/delivery-inventory.json). Tester ownership and heavy window are released only with that final closeout; there is no adoption, commit, push, deploy, production/database/default-preview change.
