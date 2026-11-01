# Live window cost — lead plan, joint decision and outcome

2026-10-31. Author: Opus 5.5 (lead). Active engine stays rust-dsp-3.1 (source `f75b55eb…`, native `d3bec4e4…`, WASM `c9217873…`). Astra's challenge: `docs/rust-live-cost-review.md`. Builder: `docs/rust-live-cost-implementation.md`. Tester: `docs/rust-live-cost-validation.md`. Diagnostic trace: `docs/rust-vibrato-admission-trace.md`.

## 1. Problem (verified, not new to this round)

Pinned Node 24.22.2 / active WASM on an i7-1165G7: the 2.56 s three-source ±65 c vibrato / 16-partial "sideband" window takes **p95 678.49 ms** (3 warmups + 15 measured; bridge copy + JSON included; file I/O and module init excluded). The live **compute** budget is p95 ≤ 500 ms per window. Dense chord 195.94 ms, GuitarSet crops 365.13 / 245.66 ms. This is not browser/UI latency. The separate **event-delay** budget (≤ 1.5 s, future support 0.32 s) is a different number and is not touched here.

Recognition on this window is already wrong; this round repairs cost only and claims nothing about accuracy.

## 2. Lead profile (before any proposal)

Disposable instrumented copy of the active source: `target/live-cost-lead/profile-src` (diff `target/live-cost-lead/profile-instrumentation.diff`, timers only, no logic change). Native release, same `lto=thin`, 3 warmups + 10 timed calls, single process, nothing else owned running. Raw: `target/live-cost-lead/profile-v2.txt`. Native ≈ WASM / 1.54 on these windows, so native shares are a fair guide; the gate itself is only judged on WASM.

| Stage, ms per 2.56 s window | sideband | dense | real-solo | real-comp |
| --- | ---: | ---: | ---: | ---: |
| **total** | **439** | 120 | 236 | 148 |
| short FFT + peak picking (`compute`, 4096) | 46 | 16 | 27 | 20 |
| `local.measure` (1024) — of which its own FFT | 82 — 7 | 16 — 9 | 30 — 8 | 16 — 5 |
| `voice_evidence::observe` | 61 | 37 | 41 | 19 |
| short `polyphony::fit` | 77 | 16 | 37 | 16 |
| long FFT (8192) + bass `fit`, every 4th hop | 129 (30 FFT) | 10 | 68 | 52 |
| — comb construction, all fits | 114 | 12 | 51 | 32 |
| `current_support` | 23 | 6 | 13 | 7 |
| YIN | 10 | 11 | 10 | 9 |
| tuning prepass / `segments::finish` | 4 / 6 | 1 / 7 | 2 / 9 | 2 / 7 |
| short peaks per hop / long peaks per call | 235 / 522 | 58 / 61 | 109 / 234 | 69 / 188 |

**Reading.** Cost is driven by peak count, not by one function. The sideband window has 4× the short peaks and 8.5× the long peaks of the dense window. Every big stage is either O(P²) or O(69 MIDI × 9 × P) with a `log2` per test, and almost every test rejects:

- comb construction: 69 × P `log2` for the fundamental gate, then for each eligible fundamental a P-wide inner loop with a `log2` for every peak whose rounded ratio is 1..8 (most of them), though only a handful pass the ±12 c tolerance;
- `observe`: per MIDI, `log2` over all P for the fundamental, then 8 partials × all P;
- `measure`: four leakage passes recompute identical neighbor responses (`sin` ×3) and the prior `from_polar`, and scan the sorted anchor list from index 0 every time;
- `compute`: one 46-element sort per local maximum just to take a median;
- `measure` also runs the full `compute` (peaks, sorts, `ln`) and discards the `Spectrum`, 7 ms on sideband (small).

The greedy admission loop (`independent` witnesses, refits) is ~60 ms of the 176 ms fit total on sideband; it is not the first target.

## 3. Lead proposal (sent to Astra) — exact, output-preserving only

Every change below must leave every `f64` produced by the engine bit-identical. No top-N peaks, no fewer iterations, no changed thresholds, no skipped evidence.

- **P1 Conservative ratio prefilters before exact gates.** Where code computes `c = 1200·log2(a/b)` only to reject when `|c − t| > T`, first compare the *same* quotient `a/b` against precomputed bounds `2^((t ± (T + m))/1200)` with a safety margin `m` (e.g. 0.5 c, ≫ the ~1e-12 c float error of the `log2` path). Clearly-outside peaks skip the `log2`; every survivor still runs the original expression and comparison unchanged, so the decision and all stored values are identical. For the comb partial test (`|partial_cents − cents| > tol`), the prefilter is on `p.hz / (peak.hz · h)`. Applies to: comb fundamental gate and partial loop (`polyphony.rs`), `observe` fundamental and partial searches, `current_support` fundamental/harmonic searches. Iteration order and `max_by` tie behaviour (Rust returns the last maximum) must be preserved — filter, never reorder.
- **P2 Leakage cache in `measure`.** Compute each anchor's neighbor list (sorted anchors, start at the first neighbor instead of index 0) and its `response` once; reuse it across the four passes in the same `j` order. Same for the `prior` complex value. Arithmetic order of `target -= components[j] * response` unchanged.
- **P3 Median by selection.** Replace sort-then-index of the peak-floor neighborhood with `select_nth_unstable_by(total_cmp)` at the same index (same value by definition), reusing one buffer.
- **P4 (optional, small)** `measure` uses a transform-only path instead of full `compute`.
- **Not proposed:** precomputing `log2(hz)` and subtracting (changes rounding → not bit-identical), peak caps, fewer passes, early exits that change which value wins.

Expected effect from the profile: most of comb construction, `observe`, the long-window fit and ¾ of `measure` leakage go away → sideband native plausibly ≈ 200–250 ms → WASM ≈ 310–390 ms. To be measured, not assumed.

Cancellation: keep the existing `cancelled()` check points (they may become cheaper loops but must not disappear from any loop that could run long). Memory: any cache is bounded by peaks in the current window (≤ a few thousand f64), allocated per call or reused per analyzer; nothing recording-length.

Acceptance shape (for the tester to freeze, not for the builder to tune against): byte-identical JSON + features + warnings + errors vs baseline on all applicable frozen inputs; WASM p95 ≤ 500 ms on sideband with real crops and dense not slower; candidate WASM + real browser worker journey before any adoption recommendation.

## 4. Astra exchange and joint decision

Astra (gpt-6-astra xhigh): `docs/rust-live-cost-review.md`, evidence `target/live-cost-review/` (float probe: 2,110 false rejections with no margin, zero with 0.5 c, max rewrite error 8.19e-13 c, native only).

| Item | Opus proposed | Astra objection | Opus response | Joint decision |
| --- | --- | --- | --- | --- |
| P1 prefilters | Ratio test with margin before every log2 gate | Bounds centered at +tuning; keep literal inequalities (`!(>45)`, `<45`, `<12`, `<35`, `<18`); NaN/inf/zero/negative must fall back to the old expression (NaN passes comb rejection but fails observe's filter); my partial quotient `p.hz/(peak.hz·h)` is not the original quotient; tie rules (last max, first find, first `>` best) | Concede all. Use the original quotient `p.hz/(nominal·h)` with bounds around the already computed `cents` | **Build** as a rejection accelerator only, guarded, 0.5 c margin, outward-rounded bounds, written error bound for native and WASM |
| P2 leakage cache | Neighbor list + responses reused | Old scan stops at the **first** `delta > 4` even for unsorted anchors; endpoints by the original rounded predicate; priors cloned, not aliased; in-place Gauss-Seidel order; no long unchecked prepass; real memory bound (≤552 anchors, ≤34 neighbors/row) | Concede | **Build** caching precisely the old scan, rows built lazily at first-pass checked anchor |
| P3 median by selection | Approve | Only the peak-floor median (44 entries); **not** `voice_evidence`'s `ratios.sort_by` (sorted order feeds a float sum) | Agree | **Build** |
| P4 transform-only `measure` | Optional | Approve; identical buffer prep/FFT; saves < 7.3 ms | Agree | **Build** |
| My profile reading | "¾ of measure", "every 4th hop" | Categories overlap; 62.6 ms is all non-comb fitting, not a greedy timer; long calls 39/32/54/66; means, not p95 | Concede | Corrected numbers used |
| Extra exact wins | — | Greedy: cache per-comb frequency and per-fit active-owner predicate; comb: recycle trial vector, skip normalizing losers | Accept as second tier | **Allowed only if tier 1 misses ≤450 ms**, each measured separately |
| Target | ≤500 | Seek **≤450 ms p95** in every block for headroom | Agree | Engineering target ≤450, gate ≤500 |
| Non-exact fallback | — | Fewer leakage passes or peak caps change recognition; need a new frozen recognition decision | Agree | **Not authorized.** If exact work misses the gate, stop and report |
| Cancellation / memory | Keep checks | WASM cancel = worker termination; keep all native checkpoints and ordering; no new recording-length state | Agree | Required |
| Equivalence | Byte identity | Full `AnalysisOutput` incl. features, progress, errors; within-backend identity, not new cross-backend identity; paired `to_bits` dumps for internals; all suites incl. 28 whole Guitar-TECHS with the 3 cap failures exactly | Agree | Tester freezes this before seeing candidate results |

**Joint decision:** build one disposable exact candidate = P1 + P2 + P3 + P4 under the conditions above, each item measurable on its own; tier-2 exact items only if needed. Any bit difference anywhere = not output-preserving, reported as a numerical change, not adoptable in this round.

## 5. Assignment and ownership

Max two active children. Exclusive write scopes:

- Lead: this file, `target/live-cost-lead/**`.
- Astra review (gpt-6-astra xhigh): `docs/rust-live-cost-review.md`, `target/live-cost-review/**`.
- Diagnostic trace (gpt-6.1-sol xhigh, runs beside Astra, baseline only, no timing claims): `docs/rust-vibrato-admission-trace.md`, `validation/vibrato-admission-trace/**`, `target/vibrato-admission-trace/**`.
- Performance builder (gpt-6.1-sol xhigh, after the joint decision): `docs/rust-live-cost-implementation.md`, `target/live-cost-builder/**` (disposable source copy, local candidate WASM; not a git worktree).
- Independent tester (gpt-6.1-sol high, after the builder freezes): `docs/rust-live-cost-validation.md`, `validation/live-cost/**`, `target/live-cost-test/**`.
- Read-only for all: `crates/**`, `Cargo.*`, `package*`, `src/**`, `scripts/**`, `Dockerfile`, all prior corpora/labels/scorers/results/archives/reports, generated active WASM.

## 6. Outcome (lead closeout)

**Exact performance candidate: recommended to root as an output-identical speedup. Cost and parity pass independently. One shared cancellation check (worker gone within 250 ms) is still unverified, and it fails the same way on baseline.** Nothing adopted; active 3.1 files untouched.

Candidate (frozen, `target/live-cost-builder/frozen/`): source `d8908393…f6c4`, native `832fb091…f6aa`, WASM `7b40ba5c…3e73`, glue `5d9f2ed9…5a41`, patch `target/live-cost-builder/frozen/live-cost.patch` sha `e946722e…9555`. The patch touches `lib.rs` (module lines), `polyphony.rs`, `spectrum.rs`, `voice_evidence.rs`, and adds `ratio_gate.rs` (the guarded prefilter) and `live_cost_tests.rs` (test-only, with embedded copies of the original functions for to_bits pairing). The tester rebuilt native, WASM and glue from the patch byte-for-byte.

**Independent parity (tester, byte-level, no normalization):** synthetic 153, GuitarSet DEV 3, supplemental 12, joint 60, **all 28 whole Guitar-TECHS** (same 3 cap failures: exit 3, same stderr, no output), upstream-round2 335, acoustic 171, 440 native and 424 WASM boundary/error cases. **Zero raw differences and zero scorer differences.** Recognition is exactly baseline's, failures included. No accuracy claim.

**Independent WASM cost** (Node 24.22.2, i7-1165G7, 3 alternating blocks, 3 warmups + 15, nothing else owned running, load ≈1.0):

| Window | Baseline p95 (blocks 1/2/3) | Candidate p95 |
| --- | --- | --- |
| sideband | 480 / 515 / 498 | **264 / 261 / 261** |
| dense | 140 / 154 / 147 | 104 / 107 / 103 |
| real-solo | 257 / 267 / 265 | 161 / 161 / 161 |
| real-comp | 167 / 192 / 170 | 110 / 108 / 109 |
| noise | 146 / 139 / 142 | 82 / 85 / 80 |
| dense-boundary | 72 / 60 / 57 | 56 / 58 / 55 |

Note: on this quieter machine the baseline sideband p95 was 480–515 ms, not the 678 ms first reported. The baseline sits right at the gate and depends on machine state. The candidate sits ~240 ms under it with tight spread. Builder preliminary blocks agree (262–341 ms under heavier load).

**Browser (real Chromium worker, candidate and baseline contexts under `target/live-cost-test`):** 5-cycle worker/AudioContext disposal passed for both. 300 s refinement 6.13 s candidate vs 6.50 s baseline (gate ≤ 120 s). Owned JS peak 87.5 MiB (≤ 96). Cancel API returns in 0.3 ms with no late result. **But** the nested analysis-worker targets were still present 251 ms after abort, and gone by 1,150 ms, for **both** engines. No worker or JS code changed, so this is a pre-existing lifecycle question, not a candidate regression. Root should decide whether the existing "cancel ≤ 250 ms" gate means API/no-late-result (passes) or worker extinction (unverified on baseline too).

**Diagnosis (separate, baseline only, `docs/rust-vibrato-admission-trace.md`):** wide-FM false 69/76/81 come from **static residual admission**, not tuning or continuity. FM spreads each partial into several maxima, and the 57 comb owns only those within ±12 c. The leftovers then pass the upper candidate's checks. "Matching ≥ 3" counts peak slots (h1, h2, h2), not distinct harmonics. The fundamental-strength test uses magnitude the 57 comb already consumed. One cell passes the one-witness singleton path at 25.26 c, just past the 25 c "explained partial" line. Short support then confirms bands that really belong to the same source. Temporal strength was 0 in every relevant admission, so temporal evidence never authorized them. Output identity was confirmed 5/5 by the tracer, and I spot-checked it against the tester's saved baseline hashes. Trace 18.96 MiB. Not independently re-derived beyond that spot check.

**Next recognition step (proposal only, not started):** a discriminating measurement must tell "one harmonic family under coherent FM" from "a real independent upper source" when both leave similar residual peaks. Candidate signals the trace points at: distinct harmonic orders instead of peak-slot counts, and residual rather than original fundamental strength. These are candidates to *measure*, not gates to add. They must survive real delayed/sustained octaves and fifths, even/third-partial ramps, onset-free 2.56 s crops, cold starts, static detuning and the gate-hole case. Do not turn those two observations into thresholds without that frozen test.

**Root's remaining work:** decide adoption, engine version/compat string (output-identical; WASM hash changes), whether to ship `live_cost_tests.rs`, packaging through the normal `scripts/wasm-build.mjs` path, and the cancellation-gate interpretation above.

Children: Astra review, diagnostic trace, builder and tester all completed. **No children active.** The lead wrote only this file and `target/live-cost-lead/**` (instrumented profile copy, build dir, profile outputs). No commits, pushes, deploys, production, database, default preview or `src/generated` changes.
