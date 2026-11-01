# Rust upstream round 2 implementation — A2 and G

**Builder outcome: do not promote either build.** Both are frozen for reproducible review/rejection. A2 fails the builder's false-note sanity check. G closes the gate hole but also introduces new false cells and loses some previously correct real-reference cells. Both exceed the 500 ms WASM window budget on the sideband-heavy control. No acceptance claim is made and no active files were changed.

Built two independent disposable experiments from the verified rust-dsp-3.1 baseline. Neither is an adoption recommendation. The active engine, generated WASM, dependencies, public types, options, schema, routing limits and tuning estimator are unchanged. There is no combined A2+G build.

The builder read the lead decision, Astra review, admission-trace report/preparation method, active baseline and preserved baseline. It did not access the tester's frozen suite or run its acceptance controls. Writes are confined to `target/upstream-round2-builder/**` and this new document. No git checkout/worktree, commits, pushes, deployments, child agents or servers.

A2 follows the last **measured fundamental**, with at most six call-local tracks. Each track's anchor is the MIDI's nominal frequency adjusted by the unchanged global tuning estimate. Recomputing that same nominal each frame cannot move the anchor. The previous measured frequency is only the hop-to-hop continuity reference.

Parameters were recorded before implementation/inference in `parameters-before.json`: at most 50 cents between adjacent measured fundamentals and at most 75 cents from the fixed tuned anchor. A ±65-cent, 5 Hz sinusoidal trajectory moves at most about 40.8 cents per 20 ms hop; 50 allows measurement error while rejecting a clean 100-cent step. The 75-cent radius covers a 65-cent excursion with 10 cents of margin and forces a clean 100-cent/400 ms slide to release around 100 ms before its destination. These are bounded development choices, not calibrated universal thresholds. Faster vibrato can exceed the hop bound.

Candidate construction keeps fresh neighbour hypotheses. Among candidates that pass the unchanged residual, fundamental-strength, independent-witness, complexity and six-voice rules, a continuation wins competition for its own measured fundamental. Competing continuations choose the nearest previous measured frequency, then lower MIDI; within an identity, equal distances choose stronger amplitude then peak index. This claims a fundamental identity only; shared harmonic allocation remains unchanged. Before subtracting a winning continuation's comb, it must also pass the existing local-support check. That check uses the same per-MIDI cache as the later filtering, so this adds no transform or extra projection per candidate. A refused continuation leaves the neighbour available. Active fundamental claims count only while their fitted support exceeds the original support threshold. Final state retains only fitted fundamentals whose MIDI survives local support and singleton selection.

The ownership observer follows the same bounded trajectory for already admitted notes, instead of losing them at its separate untuned ±45-cent gate. Untracked observer hypotheses retain their baseline gate. Internal cents use the measured fundamental for continuation combs, keeping residual ownership and local support at the actual measured frequency. Fresh combs, YIN and the bass fitter retain baseline behavior. The existing serialization clamp in `segments.rs` remains ±50 cents. Singleton replacement cannot relabel an already admitted continuation's same measured fundamental as a neighbouring MIDI. Each analyze call builds fresh state; silence, missing fundamentals, unsupported frames and rejected admissions cannot carry an identity forward. No voice is created from local support alone.

G changes only the candidate gate: each measured peak is assigned once to the nearest MIDI on the tuning-adjusted lattice within 50 cents, midpoint ties upward. Tiny arithmetic tolerances (1e-11 semitone for rounding, 1e-9 cent for the radius) make the same midpoint decision across floating-point evaluation. It has no continuation state, observer change or tuning repair. Its additional Rust test covers both old gate edges, the midpoint and detuning of −49/0/+47/+49 cents.

A2 adds five focused Rust tests: measured ±65-cent vibrato continuity with a fixed anchor; bidirectional slide release and abrupt semitone changes; simultaneous neighbour arrival and failed tentative claim; absent/unsupported fundamentals and reset; competing owners. These use exact measured peak fixtures to isolate identity/admission rules. Existing complete audio tests and the separate PCM sanity runs exercise FFT, local support and segmentation. They do not turn these rule-level tests into a claim that wide-vibrato audio is repaired.

Both fixtures run the complete `fretbloom-analysis` cargo tests, clippy on all targets with warnings denied, and fmt check, using Rust/Cargo 1.89.0 directly with `--locked --offline`. The three pre-existing ignored diagnostics/known shared-sustain test remain ignored. Initial checks and logs are preserved. One first fmt check failed because the newly added timing example was unformatted; only its formatting changed before the final checks. No initial Rust build failure occurred.

The compute fixture is an identical `round2_cost` example in A2, G and a third baseline-only plain copy. It reads PCM once, then times only `analyze` on the same 61,440 samples (2.56 seconds), including all tuning/support/segmentation work and excluding file I/O/process startup/JSON serialization. Three warmups precede 15 timed calls. The dense input mixes six harmonic sources with 16 partials each; sideband-heavy input mixes three sources at ±65 cents and 3/5/7 Hz with 16 partials each. PCM hashes and generation code are retained. WASM follows the pinned build flags, 128 MiB maximum linear memory and web-bindgen path, entirely inside the disposable fixtures, then runs under Node 24.22.2. WASM timings include the existing bridge's copying and JSON serialization; they do not include decoding or app/worker scheduling. Baseline WASM is the verified active baseline artifact, read only. Timing is sequential after builds and sanity analysis finish.

Known limits are intentional and must remain visible. A2 cannot recover a correct MIDI never admitted on a cold start. It cannot distinguish a broad FFT sideband from a physical fundamental by continuity alone. Bad +47-cent tuning moves the fixed anchor enough to exclude the negative half of the original MIDI57 vibrato; tuning is deliberately unrepaired. A ±75-cent continuation can lag nearest-pitch labeling during a slide or held bend. Own slides/bends are labeled by nearest pitch; own vibrato by sustained source MIDI. These conventions are recorded explicitly, not scored as interchangeable truths. The source-identical even/third-partial-ramp ambiguity remains. Shared upper sustain, attack/re-pluck discrimination, C6/madd11 missing voices and the long palm cap failure are not repaired or claimed by this work. The quick DEV pass is not the independent tester's musical acceptance, 28-source whole-input run, rolling-window/crop suite, or complete memory/cancellation/UI latency validation.

Frozen identities (SHA256):

- **A2** native: `target/upstream-round2-builder/frozen/a2/analyze-pcm`
  SHA256: `634f7890c1d82aefc48a40fab8a62cfb418d4516782c06cb6fd049a02781c17c`
  Canonical source: `85144102d9b3c8f1c10798dc8ef68ec37c7b5667c974cf047dfd5bb8146222f1`
  Full 40-file fixture inventory digest: `afb62e835d8c451070d388142a8a591d1d26b420a3ebb2a64ea62a93b0ccc0b4`
  Unified diff: `target/upstream-round2-builder/frozen/a2/source.diff`
  WASM: `target/upstream-round2-builder/frozen/a2/wasm/fretbloom_wasm_bg.wasm`
  WASM SHA256: `adbcdcc71f56e8d353dc7d829a44aa8be44980d6900ac1ce38cada1f21196867`

- **G** native: `target/upstream-round2-builder/frozen/g/analyze-pcm`
  SHA256: `78627fa665c0a3c36b2956b7d79c6a440e52f5308435dc8ce2ed79df94b77261`
  Canonical source: `5275e973cffe73008a278a55d8540b50bd8ad16591e96c7c73e516c0da36b276`
  Full 40-file fixture inventory digest: `10f57e0c48b049d9d8f0143561012f0bc744227fc3e6ecb84813361102d20c9e`
  Unified diff: `target/upstream-round2-builder/frozen/g/source.diff`
  WASM: `target/upstream-round2-builder/frozen/g/wasm/fretbloom_wasm_bg.wasm`
  WASM SHA256: `0136063a4c45a0177aa1d51b5cf686612cd98e972be3fb8466f429003d8c8d4f`

Frozen UTC: `2026-10-31T19:13:37.706952+00:00`. No source, parameters or binaries changed after freeze. Exact ordered path→hash inventories, canonical source maps, diff hashes and artifact identities are in [frozen/identity.json](../target/upstream-round2-builder/frozen/identity.json) and its adjacent per-build files. Baseline canonical source is `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`; native is `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`. Canonical hashing uses the same ordered `tools`/`sources` compact-JSON method as admission-trace v1. The complete fixture inventory additionally includes tests and the compute example that canonical WASM source identity omits. Copied lockfiles remain byte-identical.

Toolchain: `rustc 1.89.0 (29483883e 2025-08-04)`; `cargo 1.89.0 (c24e10642 2025-06-23)`; Node `24.22.2`; wasm-bindgen 0.2.100. Hardware: 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz, 8 exposed hardware threads; `Linux-7.0.0-42-generic-x86_64-with-glibc2.39`.

Final Rust checks: A2 has 42 passing tests and G has 38, with three existing ignored tests in each; all-target clippy and fmt check pass for both.

Measured cost, milliseconds per 2.56-second window (15 sequential timed calls after three warmups; p95 is interpolated sample percentile):

| Engine | Input | Native median | Native p95 | WASM median | WASM p95 | WASM linear MiB |
|---|---|---:|---:|---:|---:|---:|
| baseline | dense | 119.79 | 123.21 | 194.25 | 195.53 | 3.19 |
| baseline | sideband | 439.74 | 441.45 | 676.60 | 679.45 | 3.31 |
| a2 | dense | 119.71 | 122.99 | 196.30 | 197.08 | 3.19 |
| a2 | sideband | 438.92 | 441.37 | 684.26 | 692.59 | 3.25 |
| g | dense | 128.77 | 129.75 | 206.83 | 209.16 | 3.19 |
| g | sideband | 502.65 | 508.98 | 769.55 | 774.33 | 3.38 |

All three engines exceed 500 ms on the deliberately sideband-heavy WASM window. Dense windows pass that compute bound. This is an actual Node/WASM result, not a native extrapolation. It does not establish browser/UI delay, long-file refinement, cancellation or owned-JS memory limits. Linear memory is reported as measured, not a complete memory audit. Extra A2 state is bounded by six tracks and 69 candidate indices; it adds no fields to recording-length Frames and no FFT. The first cost attempt briefly overlapped native and WASM processes; those raw results are preserved under `cost-initial-overlap/` and excluded here. The final `cost-sequential-runs.json` records awaited, non-overlapping runs.

Native/WASM note timelines match on both cost windows for all three engines (6/6 comparisons). Parsed whole JSON is exactly equal in 0/6 comparisons; exact timeline equality is the relevant limited parity claim, with no inference about general corpus parity. See `native-wasm-parity.json`.

Sanity results: all 609 whole-input commands succeeded (203 inputs × baseline/A2/G): 171 prior acoustic controls, 20 own controls, nine Astra counterexamples and three GuitarSet DEV recordings. There were no command/cap failures on these short inputs. Exact PCM/binary identities, argv, stderr and outputs are retained in `sanity-runs.json` and `sanity/`. The existing GuitarSet scorer and complete wire validator were run unchanged against all nine DEV outputs; full note/chord/event/routing scores are in `guitarset-dev-existing-scorer.json`. This is a DEV auto-mode pass, not all established modes or the independent whole-corpus acceptance run.

The following counts are distinct changed (20 ms, MIDI) cells against the baseline, so additions are not cancelled against removals. GuitarSet counts describe agreement with imperfect reference labels, not adjudicated acoustic truth.

| Build / scope | New false | Removed false | Newly lost true | Recovered true |
|---|---:|---:|---:|---:|
| A2 / 171 controls | 1260 | 184 | 0 | 228 |
| A2 / 3 GuitarSet DEV | 557 | 260 | 20 | 101 |
| G / 171 controls | 312 | 330 | 0 | 264 |
| G / 3 GuitarSet DEV | 233 | 44 | 3 | 28 |

Per-input counts are in `sanity-detail.json`; category and event-count deltas are in `sanity-summary.json`. A2 adds false cells in pluck, vibrato, neighbour and phase controls. Beating, tilt and seam totals are unchanged. G changes only vibrato on the original acoustic set, but its 312 new false cells prevent calling the net decrease in false cells a safe improvement. Both builds show new reference-false cells on all three GuitarSet DEV inputs; A2 newly loses 20 previously correct reference cells and G loses three.

All nine Astra counterexample note timelines are unchanged. In particular, even/third-partial ramps retain baseline false upper events `[0.92,1.48)` (560 ms), and static detuning controls retain their MIDI. Own bidirectional 400 ms slides switch identity at 1.10 s instead of baseline/G at 1.00 s; the destination plateau starts at 1.20 s. This demonstrates bounded release, with a 100 ms nearest-pitch labeling delay. Own prelude MIDI57 ±65-cent vibrato already keeps its root in baseline; A2 adds repeated false MIDI81 events and G adds repeated false 69/76 events. Cold-start variants remain fragmented/displaced under bad tuning. See `own-control-summary.json` for all directions, rates, bends, prelude/cold-start cases; no successful-only subset is presented. These failures are why the frozen artifacts are negative experiments, not proposed product updates.

Commands were run from the repository root; every script below writes only within the builder directory except the final report writer:

```sh
python3 target/upstream-round2-builder/prepare.py
python3 target/upstream-round2-builder/edit.py
python3 target/upstream-round2-builder/add-tests.py
python3 target/upstream-round2-builder/g-tests.py
python3 target/upstream-round2-builder/prepare-dev.py
python3 target/upstream-round2-builder/prepare-bench.py
python3 target/upstream-round2-builder/final-checks.py
python3 target/upstream-round2-builder/wasm-build.py
python3 target/upstream-round2-builder/build-cost.py
python3 target/upstream-round2-builder/sanity.py
python3 target/upstream-round2-builder/native-cost.py
.tools/node-v24.22.2-linux-x64/bin/node target/upstream-round2-builder/wasm-cost.mjs
python3 target/upstream-round2-builder/measure-cost.py
python3 target/upstream-round2-builder/sanity-detail.py
python3 target/upstream-round2-builder/score-dev.py
python3 target/upstream-round2-builder/compare-cost.py
python3 target/upstream-round2-builder/freeze.py
python3 target/upstream-round2-builder/write-report.py
```

Preparation scripts deliberately refuse existing fixture/freeze destinations. Do not rerun them over the frozen experiment. Exact expanded Cargo commands and statuses are in `final-checks.json`; builds use direct pinned cargo/rustc/rustdoc, `CARGO_TARGET_DIR` inside the builder directory, and locked/offline resolution. WASM commands/flags are in `wasm-build.py` and `wasm-builds.json`, with source association checked before/after the final build. Source-edit scripts preserve the original implementation and focused tests; initial check/build logs and the initial timing attempt remain available. Only the formatting of the timing example changed after its addition. The first freeze-packaging attempt tried decoding an unchanged binary test fixture as text; its partial files and failure are retained under `freeze-attempt-1/`. Packaging was corrected to compare bytes before decoding changed text; candidate source and binaries were unchanged. No threshold or source tuning followed the sanity results. All owned processes have exited; no services were started.
