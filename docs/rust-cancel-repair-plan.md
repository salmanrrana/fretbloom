# Cancellation repair plan (lead)

2026-10-31. Lead: Opus 5.5. Builds on `docs/rust-live-cancel-root-review.md`. That
root finding stands: the DSP thread keeps running after `terminate()`. This plan
explains why and proposes the smallest repair that actually stops the work.

## 1. Root cause

**Chromium deliberately waits 2 seconds before force-stopping a worker that is
still running script.** `worker.terminate()` only posts a shutdown task to the
worker thread. If the worker is stuck in synchronous JS or WASM, that task can't
run. A backup timer then calls `isolate->TerminateExecution()` after
`kForcibleTerminationDelay = base::Seconds(2)`.

Source: Chromium tag 143.0.7499.4,
`third_party/blink/renderer/core/workers/worker_thread.cc` lines 83, 263–285 and
533–545 (copy in `target/cancel-repair-lead/worker_thread-143.0.7499.4.cc`,
sha256 `b38b9716…6a3`). The only immediate path is `TerminateForTesting()`.

This is not caused by the harness, debugger attachment, nesting, WASM or the
speedup. The root numbers (13 → 37 → 86 ticks at 0/250/750 ms) are exactly the
curve every Chromium case below produces.

## 2. Controlled evidence

Harness: `target/cancel-repair-lead/diag/run.mjs` with `www/{index.html,ingest.js,dsp.js}`.
It is a minimal page, not product code. A worker posts `started`, then spins.
The page waits 100 ms and calls the real `terminate()`. The node runner reads
`/proc/<pid>/task/<tid>/stat` (CLK_TCK 100, 8 CPUs) about every 20–60 ms for every
thread in the browser's process tree. The browser root is found with a unique
command-line marker, not through CDP. Direct launches have **no remote debugging
and no CDP/Playwright**. Timestamps are posted to the local server with `fetch`.

Chromium 143.0.7499.4 (Playwright revision 1200), 16/16 cases observed
(`diag/synthetic.json`):

| Launcher | Binary | Owner | Loop | Ticks at 0/250/750/1500 ms | Last CPU rise | Thread gone |
| --- | --- | --- | --- | --- | ---: | ---: |
| direct, no debugger | full chrome `--headless=new` | nested | WASM | 11/37/88/163 | 1926 ms | 1993 ms |
| direct, no debugger | full chrome | nested | JS | 11/39/86/159 | 1926 | 2002 |
| direct, no debugger | full chrome | main-owned | WASM | 11/37/87/163 | 1956 | 2016 |
| direct, no debugger | full chrome | main-owned | JS | 14/34/90/162 | 1947 | 2003 |
| direct, no debugger | full chrome | main kills parent | WASM | 9/35/85/160 | 1954 | 2007 |
| direct, no debugger | full chrome | main kills parent | JS | 13/41/85/165 | 1950 | 2008 |
| Playwright/CDP | headless shell | nested / main-owned / parent, WASM+JS | — | ≈12/36/86/161 | 1934–1962 | 1994–2018 |
| direct, no debugger | headless shell | nested / main-owned, WASM | — | ≈12/36/87/162 | 1956–1968 | 2016–2018 |

Firefox (Playwright `firefox-1543` binary launched directly, no Juggler or
debugger): the busy thread is gone 23–24 ms after `terminate()` when caught.
In 2 of 4 runs the thread was already gone before the sample nearest
`terminate()`, so none was counted as busy (`diag/other-browsers-{1,2}.json`).
**Firefox meets the gate with plain terminate.**

WebKit (MiniBrowser `webkit-2359` via `pw_run.sh --headless`) never loaded the
page in this harness (`no-marks`). **Safari behavior is untested.**

Limits: 10 ms tick granularity and 20–60 ms sampling. Headless only (no display).
The harness changed after `synthetic.json` was recorded: JSPI cases and WebKit
were added. The spin code paths it measured are unchanged.

## 3. The repair mechanism, proven in isolation

The fix is to give the busy worker periodic chances to reach its event loop
without changing what the computation does. **WebAssembly JS Promise
Integration (JSPI)** allows that: a `WebAssembly.Suspending` import can pause the
WASM stack on a promise, and a `WebAssembly.promising` export resumes it.

Same harness, the WASM loop calls an import on every iteration. The import
suspends on a `MessageChannel` tick when 50 ms have passed (`diag/jspi.json`,
8/8 observed):

| Variant | Launcher | Owner | Thread gone after terminate |
| --- | --- | --- | ---: |
| JSPI yield | direct full chrome, no debugger | nested | 33 ms |
| JSPI yield | direct full chrome, no debugger | main-owned | 15 ms |
| JSPI yield | Playwright headless shell | nested | 33 ms |
| JSPI yield | Playwright headless shell | main-owned | 18 ms |
| same import, no suspension (control) | all four | — | 1980–2023 ms |

So `terminate()` keeps its current meaning. It finishes within one yield
interval as soon as the worker reaches its event loop.

## 4. Why this fits the existing engine

`fretbloom_analysis::analyze(mono, rate, options, cancelled, progress)` already
takes `cancelled: &(dyn Fn() -> bool + Sync)` and checks it throughout
(`lib.rs` 45/71/103/203/325, `spectrum.rs` 56/87/91, `segments.rs::check`, and
the measure/observe calls). The native CLI already uses it. The WASM bridge
passes `&|| false` (`crates/fretbloom-wasm/src/lib.rs:62`).

Proposed product change (wrapper + worker only, recognition untouched):

1. **Rust bridge**: pass a predicate that calls a raw WASM import (for example
   `fretbloom_host.should_yield() -> i32`). It always returns "not canceled"
   unless the host says so, so numerical output is unchanged.
2. **Worker**: when `WebAssembly.Suspending`/`promising` exist, instantiate with
   the import wrapped as `Suspending`. It suspends only when ≥ about 50 ms have
   passed since the last yield, using a `MessageChannel` tick. Call the export
   through `promising`. Guard against re-entry: no second WASM call while one is
   suspended.
3. **Cancel path unchanged**: the ingestion worker still calls `terminate()`.
   Generation, retained PCM and the old result logic stay exactly as they are.
   Optional: also honor a posted cancel during a yield so the predicate returns
   `true` and Rust returns `CANCELED` cleanly. `terminate()` alone already
   achieves the stop.
4. **Fallback**: no JSPI means the current synchronous call. That gives the
   ≤2 s tail on Chromium without JSPI (Chromium before 137, or JSPI turned off).
   Firefox already stops right away. Safari is unknown and must be stated.
5. **Identity**: keep `rust-dsp-3.1` if WASM outputs are byte-identical. The
   source and WASM hashes change through the guarded `scripts/wasm-build.mjs`.
   The native binary should not change, because the bridge crate is not part of
   it. Prove that with hashes.

### Known integration risks for the builder to settle with evidence

- **wasm-bindgen 0.2.100 does not support JSPI.** Its glue calls exports
  synchronously and wraps imports in its own functions. Options: (a) a raw
  `#[link(wasm_import_module = ...)]` import plus a small hand-written
  `promising` call shim for `analyze_pcm_json` that copies the glue's
  pointer/retptr handling; (b) a raw C-ABI export for the refine call. Choose the
  smallest, type-safe option. Version the internal bridge (`bridgeVersion` 2?)
  if the call contract changes, and document it.
- **How often the predicate is called**: measure the longest wall-clock gap
  between predicate calls in WASM on a 300 s input. If any gap is over
  ~150 ms, cancel cannot meet 250 ms without adding checks in the core. That
  would be a core change and needs full parity.
- **Overhead**: one JS import call per check plus a tick every 50 ms. Measure
  live p95 and 300 s refine against the baseline, once other builds finish.
- **Shadow stack/memory**: while suspended, no other WASM call may run in that
  worker. Live and refine already go one at a time; enforce it in the worker.

## 5. Rejected or deferred options

- **Direct main-owned DSP worker**: measured, same 2 s. No benefit.
- **Killing the parent (ingestion) worker**: measured, same 2 s.
- **SharedArrayBuffer/Atomics flag**: needs COOP/COEP cross-origin isolation.
  That risks YouTube embeds and static hosts. It would still need the same
  predicate. Not needed if JSPI works.
- **Resumable/chunked Rust state machine**: a big rewrite. JSPI gives the same
  "return to the event loop" without touching recognition.
- **Independent analysis windows**: not output-equivalent. Rejected by contract.
- **Sync-XHR/Service Worker or OPFS sync handles as a cancel channel**: works
  around browser features in ways that are fragile. Rejected.
- **Accepting a ≤2 s tail**: that would relax the contract and is not ours to
  decide. It is only the fallback where JSPI is missing, and must be reported.

## 6. Acceptance (for builder and tester)

Real product code, busy WASM confirmed by CPU before cancel. Check both with no
debugger attached (direct browser launch) and under Playwright:

- Refine cancel, restore/engine-upgrade cancel, the 120 s deadline path (use a
  test-only shortened deadline in the fixture) and the live 5 s path. For each:
  the DSP thread stops using CPU and is gone within 250 ms of the handler,
  measured by `/proc` ticks.
- No late result or `refined` event. The stopped snapshot is unchanged.
  Retained PCM hash is unchanged, and a retry refine succeeds.
- 5 start/stop/refine/discard cycles with no growing workers, threads or buffers.
- 300 s valid refinement within 120 s. JS 96 MiB and WASM 128 MiB limits hold.
  No extra uploads.
- WASM output byte equality versus the candidate on the established parity
  inputs. Native binary hash unchanged.
- Firefox: plain terminate stop with the patch present.
- Test portability: split `paired_internal_bits_synthetic_and_frozen` into the
  default synthetic checks and an explicit opt-in frozen test with a declared
  fixture directory and a clear missing-fixture error.
