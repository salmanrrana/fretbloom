# Portable compute reduction — implemented, blocked at generation

2026-11-01. Sol 6.1 xhigh implementation sub-agent; no children. **One measured source optimization is implemented and frozen, but it is not adoptable.** Normal regeneration rejected the changed raw WASM with `Raw Cargo module identity drift`. No new guarded portable artifact exists. Portable speed, full DEV equivalence, actual busy cancellation and scoped runtime memory have therefore **not** passed. Musical acceptance remains **FAILED**. No adoption, commit, push, deployment, installation, production/database access or default preview occurred.

The source is an ordinary disposable copy of the latest retained-retry root repair. Only two core files differ. Latest UI repair, worker, Rust wrapper, glue, generator, Asyncify guards, checkpoint cadence 64 and yield budget 50 ms remain unchanged. This is new numerical work removal, not another unchanged gate run or an explanation of historical spikes.

## Inputs and frozen deliverable

All 220 parent inventory entries were checked before copying and after execution. [Input verification](../target/portable-compute-reduction/input-verification.json) binds the parent inventory, identity, complete source entries, pinned Node, native comparison binary and retained historical evidence. [Final verification](../target/portable-compute-reduction/final-verification.json) rechecks all 226 external named pins and all 220 candidate entries. The candidate changed only `crates/fretbloom-analysis/src/ratio_gate.rs` and `crates/fretbloom-analysis/src/voice_evidence.rs`.

| Identity | SHA256 |
|---|---|
| Parent inventory, before and after | `8a030e14d84c4e8199920a96be104cbc04ea28afec10d56ffc9ad741391c2595` |
| Parent numerical/worker association | `97dc9733a444e6fc8c398f9ecd4414cb0e405359bc2a78a3deef604b6f518fd1` |
| Candidate 220-entry source inventory | `eb1c6111563b2ec37cb7d931247dc7d3df53fd7b7cbc65788168dcaf911d2870` |
| Candidate association, normal sourceIdentity function | `9955c301994cebd1da4e2b11957ef906f4a46ecdbed3dcbbeb9d6ef250a4befb` |
| Applyable candidate patch | `858555f60b8273731494028bdea72cc9232226ccd9a5edbba300b636c78c7d39` |
| Parent native comparison | `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa` |
| Candidate native | `26e7a488098f7bb9755fb4a08fe7d8e83861054a9f14ace30f9111e24739ba25` |
| Candidate raw Rust WASM — UNAPPROVED | `17f928b73f234af3ffe2dab8a6e5172e293beca8590b02729b0dd48eaf55ff5c` |
| Parent portable WASM, unchanged and stale for candidate source | `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e` |
| Parent reference WASM, unchanged | `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1` |

[Source](../validation/portable-compute-reduction/source), [patch](../target/portable-compute-reduction/candidate.patch), [source inventory](../target/portable-compute-reduction/source-inventory.json), [association](../target/portable-compute-reduction/source-association.json), [identity](../target/portable-compute-reduction/identity.json), [native binary](../target/portable-compute-reduction/artifacts/analyze-pcm), [unapproved raw WASM](../target/portable-compute-reduction/artifacts/fretbloom_wasm.raw.UNAPPROVED.wasm). Source inventory files, patch and frozen binaries were made read-only. Engine remains `rust-dsp-3.1`, bridge 2/schema 1; no engine-version escape. Inherited generated files in the source copy are explicitly **not** associated candidate artifacts; the normal verifier rejects them.

## Selection and implementation

The [prospective protocol](../validation/portable-compute-reduction/protocol.json) predates DSP execution. Ranked hypotheses were repeated known-note `powf`, full scans of impossible peak frequencies, and repeated invariant gate construction. Scope: one instrumented native execution for each of the four existing sideband/dense/real fixtures, then select one package. No broad source trace campaign or threshold search.

Original counters found 14,603/160,660/63,152/4,784 known-note powers versus 542/394/481/281 unique known indices respectively. Those powers were **not changed**. Full observe scans were selected because sideband alone performed 7.4 million gate checks with fewer than 37 thousand survivors. [Selection record](../target/portable-compute-reduction/selection.json), [original counters](../target/portable-compute-reduction/counter-summary.json), [actual candidate counters and comparisons](../target/portable-compute-reduction/work-reduction.json).

The package adds `OrderedPeaks`, a borrowed view validated once per `VoiceEvidence::observe`. It narrows only that function's fundamental and partial peak searches. It does not change fit, current-support, note models, gate constants, candidate passes, sums or existing optimizations.

- Normal positive frequencies must be nondecreasing. No assumption about upstream ordering substitutes for this runtime validation. FFT peaks ordinarily follow increasing bins; short measurements retain anchor order. Unordered, duplicate and exceptional seam inputs remain supported.
- Each query requires a valid existing `RatioGate`, positive normal denominator and positive normal endpoint quotients. Otherwise it returns the entire original slice. Empty input also returns unchanged. NaN, infinity, signed zero, negatives, subnormal values and quotient under/overflow never enter an invalid binary-search predicate.
- Positive rounded division is monotone. Endpoint checks prove all interior quotients meet the same normal-domain requirements. Binary search uses the **identical** `p.hz / denominator` expression and existing padded gate limits. Start skips only quotients strictly below the lower bound; end skips only quotients strictly above the upper bound. Inclusive endpoints survive. No multiplied-frequency-bound rounding is introduced.
- Every retained peak still executes the original RatioGate test and original division/log cent test. The returned slice preserves the original order, including duplicate frequencies and last `max_by` equal-amplitude tie behavior. Reductions and scalar operation order on retained candidates are unchanged. No new approximation or new libm error allowance is needed.
- Scope is one immutable borrowed slice for one observation. No cached frequencies, index arrays, heap allocation or retained recording state. The added view is two pointer-sized slice words plus a bool, padded to at most three words: 24 bytes native / 12 bytes wasm32 on the pinned targets. This is a layout bound, not a runtime application-memory certification. Validation adds an O(peaks) scan before the first existing observation callback; no callback was removed or moved.

Actual source counters, each over 128 observations:

| Fixture | Original gate checks | Candidate gate checks | Added window quotient probes | Net source quotient checks removed |
|---|---:|---:|---:|---:|
| sideband | 7,405,663 | 36,260 | 638,554 | 6,730,849 |
| dense | 1,872,686 | 19,970 | 518,400 | 1,334,316 |
| real-solo | 4,357,648 | 25,715 | 712,140 | 3,619,793 |
| real-comp | 2,119,829 | 13,049 | 494,338 | 1,612,442 |

The same gate-survivor counts and complete output bytes match in every counter execution. These counts identify redundant source-level evaluations, not sampled WASM CPU time or exact machine division instruction counts. Added sortedness checks are not included in the quotient column. Instrumented elapsed times are not used as performance evidence. Instrumentation is retained separately under `target/portable-compute-reduction/diagnostic*` and is absent from the frozen source.

## Tests and supporting native observations

Pinned Rust 1.89, locked/offline release tests: **46 passed, 5 ignored** across the normal suite. The separately invoked frozen bit-equivalence test passed on all four original cost fixtures. Existing tests compare spectrum, local measurements, fit/evidence and rolling history against original functions, and exercise every local observe cancellation ordinal plus sampled full-pipeline cancellation/progress. New tests compare original full-scan peak identities/order with narrowed scans at adjacent representable bounds, extreme denominators, ties, unordered and exceptional inputs. Final boundary fixtures were strengthened to exercise ordinary fast-path ranges; focused tests and clippy were rerun. No output tolerance or expected-result relaxation.

A retained [mutant plan](../target/portable-compute-reduction/mutant-plan.json) changes the lower partition into the upper partition, incorrectly excluding valid peaks. **Both focused tests fail** ([raw stdout](../target/portable-compute-reduction/focused-mutant.stdout), [stderr](../target/portable-compute-reduction/focused-mutant.stderr)); candidate was restored and both focused tests pass. No test or expected value was changed to admit the mutant. `cargo fmt --check` and clippy all targets `-D warnings` passed. [Commands/statuses](../target/portable-compute-reduction/commands.jsonl), [normal suite](../target/portable-compute-reduction/core-tests.stdout), [frozen bits](../target/portable-compute-reduction/frozen-bits.stdout), [final focused tests](../target/portable-compute-reduction/focused-final.stdout), [final clippy](../target/portable-compute-reduction/clippy-final.stderr).

A separately predeclared small native comparison supplies supporting evidence only: four fixed original fixtures; 3 warm pairs plus 9 retained alternating pairs per fixture; 96 total processes/outputs, 72 retained. Both binaries use the same original auto/440/sharps options at 24 kHz. All exit/stdout/stderr/complete output bytes match, including features and trailing newline. Every warm and retained output, command and time is kept. There were no discarded outliers, retries or extensions.

| Native whole CLI, ms | Parent p50 / p95 | Candidate p50 / p95 |
|---|---:|---:|
| sideband | 246.39 / 338.36 | 230.56 / 297.93 |
| dense | 87.45 / 89.12 | 83.17 / 86.90 |
| real-solo | 150.33 / 162.65 | 144.14 / 152.73 |
| real-comp | 99.97 / 121.67 | 94.62 / 109.57 |

[Native protocol](../target/portable-compute-reduction/native-paired/protocol.json), [all calls](../target/portable-compute-reduction/native-paired/calls.jsonl), [raw before/after outputs and streams](../target/portable-compute-reduction/native-paired), [raw combined results](../target/portable-compute-reduction/native-paired/raw.json), [summary](../target/portable-compute-reduction/native-paired/summary.json). Timing includes process startup, input reading and output writing; each process creates fresh state. It is **not** the portable compute boundary, a substitute portable gate, or proof of a universal speedup. Sideband variability remains visible. The clear source-work reduction and modest native improvements justify preserving the package, not accepting it.

## Mandatory rejection at normal generation

Unchanged `scripts/wasm-build.mjs` compiled the new Rust module successfully with the pinned toolchain, target flags and owned build/cache paths. It then failed at line 95 because raw SHA `17f928b7…` differs from pinned `328134360d2b0597aa27343de67c1860604373fc4e1592b0a98aa11dfa3bd4b4`.

[First generation stderr](../target/portable-compute-reduction/generate.stderr), [normal builder failure/source binding](../validation/portable-compute-reduction/source/target/wasm-failures/2026-11-01T00-39-03.811Z/failure.json). No pins, reference hash checks, numeric metadata checks, Asyncify transform checks, access inventories or safety code were edited. Normal verifier then rejected stale source association; normal `npm run build` stopped at its mandatory WASM verifier. Both failures are retained ([verify](../target/portable-compute-reduction/verify.stderr), [build stdout](../target/portable-compute-reduction/normal-build.stdout), [build stderr](../target/portable-compute-reduction/normal-build.stderr)). No fresh `--check` was attempted after generation failed; repeating it would encounter the same raw-module gate.

The task limits edits to core source/tests and requires unchanged scripts. Consequently, updating the hardcoded module pins or replacing their safety inventory is outside this implementation scope. **No normal transform or new-module safety validation was reached**, so the parent's function/access-count proof cannot certify these new bytes. The raw artifact is retained only as unapproved compiler output. No safety bypass or manually forged artifact association was used.

| Acceptance area | Verdict |
|---|---|
| Measured redundant source work | Removed in candidate; native evidence retained |
| Bounded numerical seam/native output equivalence | Passed within the stated tests/four fixtures |
| Normal package generation/verifier/build | **FAILED**; no new portable product artifact |
| Early fixed paired portable cost/output comparison | **NOT RUN**, blocked by generation |
| Full DEV synthetic/GuitarSet/supplemental/joint/Guitar-TECHS/upstream/acoustic and 424 WASM edges | **NOT RUN**; advancement conditions not met |
| Final three-block six-fixture Node + actual WPE <=500 ms | **NOT RUN**; no candidate module; no full browser matrix |
| Actual busy cancellation / retained retry <=250 ms CPU cessation | **NOT RUN** for new bytes; ordinal tests are narrower evidence |
| Scoped <=96 MiB app / <=128 MiB WASM runtime buffers | **NOT RUN** for new bytes; borrowed-view layout bound only |
| Musical acceptance | **FAILED**, unchanged; no accuracy progress claim |

The historical Node p95 **557.2169716 ms** and WPE p95 **557.8 ms** remain failed and preserved. Later diagnostics' nonrecurrence is not clearance. This implementation assigns no known cause to those spikes. The existing <=500 ms, <=250 ms and memory limits remain intact. No holdout, corpus, scorer, golden output or previous evidence was edited. Prior retained-retry runtime proof belongs to its old module and is not carried forward as a new-byte pass.

## Execution and cleanup

Representative commands, from the audit workspace; full commands/environments/results are in `commands.jsonl` and the paired-call journal:

```text
python3 validation/portable-compute-reduction/prepare.py
python3 validation/portable-compute-reduction/diagnostic.py
python3 validation/portable-compute-reduction/implement.py
python3 validation/portable-compute-reduction/checks.py fmt focused core-tests frozen-bits clippy fmt-check native
python3 validation/portable-compute-reduction/mutant.py
python3 validation/portable-compute-reduction/checks.py fmt-final focused-final clippy-final
python3 validation/portable-compute-reduction/candidate-counter.py
python3 validation/portable-compute-reduction/checks.py native-final
.tools/node-v24.22.2-linux-x64/bin/node validation/portable-compute-reduction/freeze.mjs
python3 validation/portable-compute-reduction/native-cost.py
python3 validation/portable-compute-reduction/checks.py generate
python3 validation/portable-compute-reduction/checks.py verify
python3 validation/portable-compute-reduction/checks.py normal-build
python3 validation/portable-compute-reduction/closeout.py
```

Node executable SHA is `904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52`. Rust uses direct `/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/{cargo,rustc,rustdoc}`. Existing bindgen/Binaryen tool locations are read-only symlinks; neither was reached after the raw identity rejection. No install/bootstrap or global settings change occurred.

**Cache-scope deviation:** the first diagnostic build omitted `CARGO_HOME` and used the default installed registry/cache; `~/.cargo/.global-cache` mtime advanced to 2026-11-01 00:34:49.577600497 UTC. Thus a claim that every incidental write stayed in the owned directories would be false. All subsequent builds used an owned registry copy, `CARGO_HOME`, target, npm and cache paths. The exact first diagnostic driver is preserved in `target/portable-compute-reduction/executed-scripts/diagnostic.py`; the reusable driver was corrected to use the owned cache. No source/settings/install modification outside the authorized source copy was made or attempted.

All heavy execution ended. Final owned-path process census is empty; no browser, profile, server or listening port was ever opened. The candidate source and artifacts are frozen. **Exclusive heavy ownership released at 2026-11-01T00:39:36.364577+00:00**, after input/source/binary revalidation and cleanup: [actual release](../target/portable-compute-reduction/heavy-release.json). No further heavy work is scheduled. Completing portable validation would require separately authorized new-module pin/inventory recertification; this report does not authorize or perform that work.
