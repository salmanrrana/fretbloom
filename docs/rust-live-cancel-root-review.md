# Root cancellation decision after the exact speedup

2026-10-31. **Cancellation remains a real processing-stop failure, not merely a
debugger cleanup ambiguity.** The optimization remains unadopted. Active engine
3.1 and its generated WASM still pass normal source verification. This finding
applies to both baseline and optimized artifacts; it is not a speedup regression.

## Contract decision

`docs/rust-live-architecture.md` requires terminating the synchronous DSP worker
on cancel (lines 101–104 and 434–436), and cancellation settling within 250 ms
after the handler executes (821–822). Prompt promise rejection alone is not
sufficient when the expensive operation keeps running. Do not relax the gate
or reclassify continuing DSP as successful cancellation. Retained PCM and the
previous result must remain usable, with no late result adoption.

The independent tester's CDP target census was appropriately inconclusive:
target presence alone does not prove CPU execution. Root added a passive worker
observer and per-thread CPU census to distinguish those cases.

## New evidence

Command:

```sh
.tools/node-v24.22.2-linux-x64/bin/node validation/live-cost/root-cancel-observer.mjs
```

The observer serves the existing tester's isolated baseline/candidate contexts
read-only, with a new cache/output directory. Vite transforms inject only console
timestamps at real WASM entry/exit, the real cancel handler, and immediately
before/after the actual nested worker `terminate()` call. No fake worker,
substitute output, changed DSP or rewritten product source is used. The staged
300-second restore/refinement harness waits for externally triggered Cancel,
which is sent after observing real WASM entry and a further 100 ms delay.

Both versions:

- Enter actual WASM refinement before cancellation.
- Process cancellation and call `terminate()` within approximately one
  millisecond of the main-thread abort handler; the promise rejects promptly.
- Emit no observed WASM completion/refined result during the observation.
- Still have an actively running analysis thread after termination is requested.

The second observer run records Linux `/proc/<renderer>/task/<tid>/stat`, using
renderer PIDs returned by CDP `SystemInfo.getProcessInfo`. `getconf CLK_TCK`
returns 100. Dedicated worker CPU ticks (user + system):

| Engine | Analysis thread | During WASM | Just after abort | At 250 ms | At 750 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline | PID 196942, TID 196972 | 1 | 13 | 37 | 86 |
| candidate | PID 197011, TID 197050 | 2 | 14 | 37 | 87 |

These analysis threads are in running state at each census. The other dedicated
worker (ingestion) remains sleeping at an unchanged CPU count throughout. This
is sustained CPU consumption, not only delayed disappearance of CDP metadata.
Observation has scheduling overhead and 10 ms CPU accounting granularity; it
does not locate the exact final instruction or establish browser-wide physical
memory usage. It is sufficient to reject processing-stop within 250 ms here.

Evidence: `target/root-live-cost-cancel/observer.json`; first timestamp-only run
retained as `observer-initial.json`. Logs:
`target/root-live-cost-cancel-observer{,-cpu}.log`. Browser and local servers are
closed in `finally` for each engine. No production, database, original result,
active source or generated artifact was changed.

## Integration decisions

- Keep the exact optimization available for integration after cancellation is
  resolved; its output-equivalence evidence remains valid.
- Retain `rust-dsp-3.1` for the exact optimization if its numerical contract stays
  identical. Source and WASM hashes must change through the normal guarded build.
  A later numerical recognition change needs a distinct reviewed engine identity.
- Retain meaningful differential tests, but fix their portability before
  integration: `paired_internal_bits_synthetic_and_frozen` currently requires
  ignored `target/upstream-round2-test/phase2/cost-pcm` files by searching ancestor
  directories. Default tests must run from a clean checkout. Keep the synthesized
  checks enabled; make external frozen-recording checks explicit opt-in tests
  with a declared input directory and a clear missing-fixture error. Do not
  silently skip a requested external test.
- Normal `scripts/wasm-build.mjs` publication and source verification remain
  required. Do not copy candidate binaries into active generated files by hand.

Next work must identify why the current real nested-worker termination does not
interrupt this WASM operation, implement a portable cancellation mechanism, and
independently verify processing cessation, retained-PCM retry and no late result.
Browser scheduling, buffering and numerical output must remain honest; splitting
full analysis into independent windows is not an equivalent substitute.
