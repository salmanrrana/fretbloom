# Exact live-cost candidate — implementation report

2026-10-31. Disposable builder candidate only. Active crates, generated WASM, production, databases and the default preview were not modified. No installs, commits, worktrees, servers or deployment. No child agents. Tier 1 only: P1+P2+P3+P4; no tier-2 changes were needed for sideband. All timings below are **builder-preliminary**, not an adoption decision.

## Frozen handoff

- Baseline canonical source: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`.
- Baseline native: `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`.
- Baseline WASM: `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`.
- Candidate canonical source: `d89083935142dd7cc8e21e1c57a08d7b21f39f3bf5d9d2d5d697fc86bbb5f6c4`.
- Candidate native: `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`.
- Candidate WASM: `7b40ba5ce7fb9018a510c8ddb063304839a9d28abf58675953cbd3093fb23e73`.
- Candidate JS glue: `5d9f2ed959ec33aa08bf5d40720ebd0759e2761d4e26e0e21e03b2af62fd5a41`.
- Applyable patch: [live-cost.patch](../target/live-cost-builder/frozen/live-cost.patch), SHA256 `e946722e90b298bbe154bfa9d8160712e7b9f649e2bdbaf88ff35ee0bfea9555`.
- [Identity](../target/live-cost-builder/frozen/identity.json), [ordered canonical sources](../target/live-cost-builder/frozen/canonical-sources.json), [complete frozen inventory](../target/live-cost-builder/frozen/inventory.json), [source](../target/live-cost-builder/frozen/source), [native](../target/live-cost-builder/frozen/analyze-pcm), [WASM/glue](../target/live-cost-builder/frozen/wasm).

The initial copy matched **every active crate file**, every canonical entry and both supplied baseline artifact identities before editing. The canonical source hash is SHA256 of compact JSON `{tools,sources}`, using the existing tool key order and lexically ordered source paths, including the new `ratio_gate.rs` and test module. The full source inventory also binds tests, examples and copied build scripts. Frozen at `2026-10-31T19:43:42.276266+00:00`. The first artifact/source freeze preceded the byte-equivalence campaign and is retained under `frozen-initial`. A final test-only fixture-location correction makes tests runnable from working, frozen or applied source copies; full checks were rerun, and the native/WASM/glue artifact bytes are unchanged. The final source/patch freeze therefore follows equivalence, with explicit identical-artifact association. Initial cost/tests were development checks before the first freeze; the original timed WASM SHA remains in every raw row, and its association with the final WASM is checked in the closeout summary. No performance or numerical-logic tuning followed the first freeze.

## Changes and exactness

**P1:** guarded quotient prefilters in comb fundamental/partial searches, observe fundamental/partials and current-support fundamental/partials. Bounds are centered at +tuning for the comb fundamental, at the already computed fundamental `cents` for comb partials, and zero for observe/current-support. They add **0.5 cent**, then use `next_down`/`next_up`. Rejection is strictly outside the bounds; survivors retain the original log2 expressions and literal `>45`, `>tolerance`, `<45`, `<12`, `<35`, `<18` conditions. The comb partial quotient is still `p.hz/(nominal*h)`. No logarithm subtraction rewrite is used. Iteration order, last `max_by` tie, first `.find` match and first strictly better comb are unchanged.

Fast rejection requires positive normal numerator, denominator/product and quotient, a finite center within ±128 cents, finite tolerance within 0..45, and normal bounds. Everything else falls back to the original expression, including NaN, infinity, zero, negative and subnormal values. The narrow center domain is an accelerator guard, not an admission limit: out-of-domain inputs run the old gate. Original rounded-harmonic calculation, cast and range test remain untouched.

**Error bound for the pinned backends.** Round-to-nearest binary64 unit roundoff is u=2^-53. The prefilter and exact gate use the identical rounded quotient and denominator product, so their rounding is shared, not an algebraic-rewrite error. Even charging product+division twice conservatively costs <1e-11 cent near a boundary. The partial center is the identical represented `cents` value; its original fundamental logarithm is shared too. Charging that log separately does not approach the padding.

For native, glibc 2.39 log2 documents <0.55 ULP and pow <0.54 ULP. WASM symbols identify Rust compiler-builtins `libm_math::log2`/`pow`; the Rust 1.89.0 source is retained in [libm-evidence](../target/live-cost-builder/libm-evidence/inventory.json). Its log2 reduces into [sqrt(2)/2,sqrt(2)], uses the log polynomial with approximation error ≤2^-58.45, split inverse-ln2 and compensated addition of the integral exponent. A deliberately loose absolute log2 error bound of **2^-30** covers the polynomial, fewer than 100 rounded operations on bounded reduced terms and the final addition with |k|≤1024. For bound generation, base 2 has exact logarithm 1 in the pow path, |exponent|≤173.5/1200, with bounded exponent-polynomial evaluation; a loose relative pow error **2^-30** covers the split evaluation and final rounding. These allowances are vastly larger than the documented native errors and the WASM reduced-polynomial errors; they are backend-specific allowances, not a portable Rust-libm promise.

Converting these deliberately loose bounds to cents: `1200*2^-30` <1.12e-6 cent for each charged log, and `(1200/ln(2))*2^-30` <1.62e-6 cent for bound generation. Charge two logs, two quotient/product rounding allowances, multiplication/subtraction/division rounding and outward-bound rounding: **total <0.00001 cent <0.01 cent <0.5 cent**. The strict rejection interval therefore contains every quotient accepted by the original gate; the margin exceeds the charged error by >50,000×. For quotients far outside the boundary region, the same global normal-input log bound prevents a false acceptance near ±128+45 cents. The empirical native and WASM boundary probes supplement this argument; they are not an exhaustive proof. No unpinned architecture/libm is certified.

Primary implementation sources: [glibc 2.39 log2](https://github.com/bminor/glibc/blob/glibc-2.39/sysdeps/ieee754/dbl-64/e_log2.c), [glibc pow](https://github.com/bminor/glibc/blob/glibc-2.39/sysdeps/ieee754/dbl-64/e_pow.c), [Rust 1.89 log2](https://github.com/rust-lang/rust/blob/1.89.0/library/compiler-builtins/libm/src/math/log2.rs), [log polynomial](https://github.com/rust-lang/rust/blob/1.89.0/library/compiler-builtins/libm/src/math/log.rs), [pow](https://github.com/rust-lang/rust/blob/1.89.0/library/compiler-builtins/libm/src/math/pow.rs).

**P2:** lazy leakage rows reproduce the original j-order scan and first `delta>4` break, including unsorted anchors. The endpoints use the original `(other.hz-peak.hz)/bin_hz` predicate. Self exclusion, zero/NaN responses and in-place Gauss-Seidel updates remain. Initial components are cloned as immutable priors. A row is first constructed after the existing first-pass anchor cancellation check. All four passes and every original callback checkpoint remain.

Each cached row has capacity exactly 34 entries of `(usize,f64)` (16 bytes on the pinned targets); at most 552 rows. The conservative allocation bound uses native 24-byte Vec metadata, which also bounds the smaller wasm32 layout. A larger row returns to the original scan without truncation. More than 552 anchors bypasses caching altogether. This handles arbitrary duplicate/dense/exceptional anchors without assuming they came from the normal ordered FFT output. Cache lifetime is one measurement, with no recording-length retained state.

**P3:** one 44-f64 scratch buffer is cleared/refilled for each peak-floor neighborhood; `select_nth_unstable_by(total_cmp)` returns the same `len/2` rank as sorting. `total_cmp` equality implies identical bits, including signed zero and NaN payloads. No downstream operation consumes the partitioned buffer. `voice_evidence` ratios still sort before their ordered sum.

**P4:** compute and measure share the original buffer preparation, mean/energy accumulation, window multiplication and FFT call. Measure skips only the discarded magnitude/peak computation. It does not reuse another window's transform. FFT plans, size, scratch, zero padding, clamps, casts, operation order and cancellation schedule remain.

No new unsafe code, threshold, peak cap, pass/iteration reduction, reassociated sum, early success, tuning/admission/evidence/schedule/limit/contract change or cancellation removal.

## Focused verification

Embedded cfg(test) originals provide paired `to_bits` checks of spectrum fields/peaks, transformed complex buffers, local measurements, fit notes/residual, evidence and complete rolling evidence history. They cover synthetic PCM and all four frozen cost windows, five tuning centers including ±50, gate/adjacent-representable values, rounded-harmonic half boundaries, ties, zero/negative/subnormal/nonfinite values, ±4 leakage endpoints, unsorted/duplicate/nonfinite anchors and fallback rows. Cache-only and transform-only measurement methods are also checked separately against the original. P1 fit/observe receive identical original spectra/measurements; P3 spectrum results are compared to original sorting.

44,000 random-bit median arrays include NaN payloads and both zero signs. Native and standalone WASM each execute 57,792 additional padded-gate boundary checks with **zero false rejections** ([probe](../target/live-cost-builder/probe.json)). Unit boundary checks also sweep all eight harmonics, reference 432/440/446 and extreme normal denominators. No tolerance comparisons replace bit equality.

Cancellation: every callback ordinal in standalone fit, measure and observe is paired with the original; maximum 552-anchor measurement includes first/last/interior pass ordinals; full-pipeline sampled ordinals compare Cancelled/success outcome, callback count and progress sequence, with no partial AnalysisOutput. Full success JSON and progress also match. This tests callback order, not wall-clock cancellation. WASM worker termination/browser lifecycle is left to independent validation; no worker code changed.

Full `fretbloom-analysis` release cargo tests (**44 passed; 4 intentional ignored tests**, including the separately executed allocation test), clippy all targets `-D warnings`, and fmt check pass. [Commands and statuses](../target/live-cost-builder/commands.jsonl), [test log](../target/live-cost-builder/test.log), [clippy log](../target/live-cost-builder/clippy.log), [focused test details](../target/live-cost-builder/focused.log), [memory log](../target/live-cost-builder/memory.log). Development failures were an ambiguous test float type, test-item placement/type-complexity lints, and formatting after adding tests; fixed before the final freeze. No numerical mismatch was observed.

## Native byte equivalence

Coverage: **335/335 upstream controls**, **171/171 original acoustic controls**, **3/3 whole GuitarSet DEV recordings**, **4/4 cost windows** = **513 coverage entries**, **342 unique PCM/options executions per backend**, deduplicating identical frozen bytes/options across manifests. Baseline and candidate were executed sequentially for each unique case. Same CLI modes, sample rate, reference and spelling as the original runs; only destination paths changed.

Compared exit status, stdout bytes, stderr bytes, successful complete JSON output bytes (including features), and output absence on errors. **0 differences.** [Frozen input/command manifest](../target/live-cost-builder/equivalence-manifest.json), [complete results](../target/live-cost-builder/equivalence.json), [retained outputs/stdout/stderr](../target/live-cost-builder/equivalence). The 480-second control is included whole. All four WASM cost outputs are byte-identical within that backend; [outputs](../target/live-cost-builder/wasm-outputs). This is within-backend equivalence, not a claim of new native/WASM bit parity.

## Native per-item contribution

Uninstrumented release, sideband, 3 warmups +15 measured calls, one process per cumulative variant. No owned builds or analyses ran concurrently with timing. Contributions are incremental on top of preceding items, so interaction and timing noise remain; they are not isolated stage timers. P123's compute transform extraction is identical arithmetic; its measurement still calls full compute, so P4's discarded-work saving remains in the final step.

| Variant | Median ms | p95 ms | Incremental median saving ms |
| --- | ---: | ---: | ---: |
| P0 | 309.52 | 350.82 | — |
| P1 | 340.77 | 383.07 | -31.24 |
| P12 | 301.87 | 311.00 | 38.89 |
| P123 | 199.76 | 204.52 | 102.11 |
| P1234 | 200.35 | 209.29 | -0.59 |

The initial sweep has substantial within-row variation (P1 samples start around 255 ms and later rise above 340 ms; P12 falls from about 306 to 240 ms). Those incremental deltas cannot reliably separate item effects. One complete reverse-order sweep was predeclared after observing this and run after all WASM extension timing; no samples were removed.

Reverse sweep (execution order P1234, P123, P12, P1, P0; displayed in logical item order):

| Variant | Median ms | p95 ms | Incremental median saving ms |
| --- | ---: | ---: | ---: |
| P0 | 309.53 | 320.30 | — |
| P1 | 256.51 | 283.68 | 53.02 |
| P12 | 219.88 | 230.56 | 36.63 |
| P123 | 192.51 | 209.64 | 27.37 |
| P1234 | 190.77 | 206.95 | 1.74 |

These native contributions remain preliminary; use both complete sweeps rather than selecting favorable deltas. [Reverse raw samples](../target/live-cost-builder/native-cost-reverse.json).

[Raw samples, hashes and load](../target/live-cost-builder/native-cost.json), [variant build commands](../target/live-cost-builder/variant-builds.json). P0 is an active-source rebuild for attribution only; supplied baseline identity is used for acceptance equivalence and WASM timing.

## WASM cost

Pinned Node v24.22.2, 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz. Uninstrumented portable release, target-only max-memory/remap flags, wasm-bindgen 0.2.100 `--target web`. Each row has 3 warmups +15 timed calls; bridge input copy and JSON serialization included, file I/O/module initialization excluded. p95 uses linear interpolation at rank 14×0.95. Sequential only; no owned timing overlapped builds or native analysis.

Three initial full alternating blocks are retained unchanged. In block 3, external CPU/process load rose during candidate real-solo/real-comp; their measured slowdown is reported, not discarded. Two full alternating extension blocks were declared before running them, to investigate that interruption. These are builder-preliminary machine measurements: they do not prove browser/UI latency or the separate event-delay budget.

| Block | Window | Engine | Median ms | p95 ms | Max ms |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | sideband | baseline | 472.38 | 523.74 | 622.90 |
| 1 | dense | baseline | 137.03 | 143.80 | 146.76 |
| 1 | real-solo | baseline | 259.70 | 267.46 | 272.97 |
| 1 | real-comp | baseline | 161.61 | 169.24 | 172.97 |
| 1 | sideband | candidate | 255.78 | 262.16 | 263.25 |
| 1 | dense | candidate | 102.19 | 118.16 | 144.01 |
| 1 | real-solo | candidate | 169.18 | 176.25 | 177.89 |
| 1 | real-comp | candidate | 115.36 | 117.97 | 118.50 |
| 2 | sideband | candidate | 277.33 | 287.70 | 297.11 |
| 2 | dense | candidate | 114.41 | 117.53 | 117.90 |
| 2 | real-solo | candidate | 170.09 | 184.83 | 197.45 |
| 2 | real-comp | candidate | 114.72 | 116.90 | 117.29 |
| 2 | sideband | baseline | 521.22 | 553.32 | 561.85 |
| 2 | dense | baseline | 192.33 | 206.17 | 223.27 |
| 2 | real-solo | baseline | 285.33 | 360.94 | 368.20 |
| 2 | real-comp | baseline | 175.29 | 185.33 | 185.84 |
| 3 | sideband | baseline | 513.18 | 530.53 | 543.21 |
| 3 | dense | baseline | 150.43 | 153.79 | 153.84 |
| 3 | real-solo | baseline | 279.24 | 305.35 | 307.56 |
| 3 | real-comp | baseline | 175.30 | 190.93 | 192.86 |
| 3 | sideband | candidate | 271.59 | 282.34 | 288.62 |
| 3 | dense | candidate | 107.89 | 109.40 | 110.26 |
| 3 | real-solo | candidate | 408.95 | 679.72 | 710.90 |
| 3 | real-comp | candidate | 333.89 | 403.90 | 428.53 |
| 4 | sideband | candidate | 272.08 | 340.63 | 346.90 |
| 4 | dense | candidate | 104.69 | 122.80 | 124.50 |
| 4 | real-solo | candidate | 160.66 | 165.14 | 165.94 |
| 4 | real-comp | candidate | 117.82 | 135.41 | 155.92 |
| 4 | sideband | baseline | 489.32 | 507.16 | 510.68 |
| 4 | dense | baseline | 141.64 | 147.67 | 148.36 |
| 4 | real-solo | baseline | 261.74 | 292.47 | 310.06 |
| 4 | real-comp | baseline | 168.31 | 181.04 | 184.43 |
| 5 | sideband | baseline | 499.94 | 550.25 | 593.23 |
| 5 | dense | baseline | 143.77 | 153.15 | 160.61 |
| 5 | real-solo | baseline | 259.33 | 264.86 | 269.04 |
| 5 | real-comp | baseline | 165.66 | 174.89 | 180.41 |
| 5 | sideband | candidate | 261.68 | 273.47 | 274.39 |
| 5 | dense | candidate | 109.21 | 122.31 | 128.77 |
| 5 | real-solo | candidate | 156.92 | 175.13 | 176.24 |
| 5 | real-comp | candidate | 106.80 | 109.82 | 112.20 |

| Block | /proc/loadavg before block | After final row |
| --- | --- | --- |
| 1 | `3.64 2.12 1.80 2/2079 149869` | `2.87 2.07 1.79 1/2084 150047` |
| 2 | `2.87 2.07 1.79 1/2084 150047` | `2.35 2.03 1.79 3/2073 151418` |
| 3 | `2.35 2.03 1.79 2/2073 151418` | `3.70 2.36 1.91 2/3050 158514` |
| 4 | `3.20 5.21 3.48 1/3294 179864` | `2.33 4.81 3.40 1/3294 180050` |
| 5 | `2.33 4.81 3.40 1/3294 180050` | `1.96 4.49 3.34 1/3289 180226` |

[All raw samples and per-row load/memory](../target/live-cost-builder/wasm-cost.json); [untouched first-three-block evidence](../target/live-cost-builder/wasm-cost-first-three.json). Block 3 candidate real-solo load rose from roughly 2 to 3.59 and 18 runnable tasks at that row's end; real-comp ended at 3.70 with total task count >3000. Attribution to external contention is plausible, not proven by loadavg alone. Therefore the original three-block real-crop no-slowdown criterion was **not met as measured**; independent controlled timing is required even if the extension is faster. Sideband clears the 450-ms engineering target in every measured block. No tier-2 optimization was activated.

## Memory and scope limits

Cache layout adds at most 552×(24+34×16+16) = **322,368 bytes** over baseline measurement live scratch as a conservative bound on both pinned targets (native 24-byte Option<Vec> row metadata; WASM metadata is smaller; 34×16-byte entries and cloned 16-byte priors). Reusable median scratch adds 352 bytes per analyzer. Oversized rows/anchor lists fall back to uncached scanning, so no unbounded quadratic cache exists. Measurements with 552 anchors: baseline high-water **35,328 B**, candidate **357,696 B**, delta **322,368 B**. After each of 64 repeated calls, retained allocation delta is **0 B**. This meters requested live allocation via the existing test allocator; it is not RSS or browser heap accounting. Original allocator unsafe code is unchanged.

The retained Node rows also record linear memory/process memory. Both engines reached 3,670,016 B linear memory on these windows (same high-water in the initial blocks), within 128 MiB; native/JS aggregate browser budgets are not certified here. Memory does not grow with the number of measurement calls; original recording-length output/frame allocations remain unchanged.

Builder scope intentionally does not repeat full DEV, 28 whole Guitar-TECHS, 12 supplemental, 20 joint×3 or 51 synthetic×3 external campaigns; the independent tester owns broader recognition/equivalence and browser five-cycle worker scheduling/cancellation/disposal checks. Existing full Rust tests are included. No claim of preserving the three whole-Guitar-TECHS cap failures is made from unrun inputs, and no claim of recognition improvement is made. No candidate has been adopted or published.

## Reproduction

All scripts live in [target/live-cost-builder](../target/live-cost-builder). Run from the repository root. `build.py` uses direct `/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/{cargo,rustc,rustdoc}`, locked/offline Cargo and owned target directories. Original rust-toolchain.toml was retained with RUSTUP_TOOLCHAIN=1.89.0. No scripts/wasm-build.mjs invocation occurred.

```sh
python3 target/live-cost-builder/build.py fmt test clippy fmt-check native wasm bindgen
python3 target/live-cost-builder/probe.py
python3 target/live-cost-builder/variants.py
python3 target/live-cost-builder/freeze.py
python3 target/live-cost-builder/equivalence.py
python3 target/live-cost-builder/native-cost.py
# Reverse sweep was run after the WASM extension, with no overlapping timing:
python3 target/live-cost-builder/native-cost.py --reverse
.tools/node-v24.22.2-linux-x64/bin/node target/live-cost-builder/wasm-cost.mjs 3
# Only when preserving those three existing blocks and predeclaring the extension:
.tools/node-v24.22.2-linux-x64/bin/node target/live-cost-builder/wasm-cost.mjs 2 extend
```

The freeze script intentionally refuses an existing frozen directory. The initial freeze was preserved by renaming it to `frozen-initial` before the final test-fixture-path-only source freeze. Use the retained frozen outputs for validation; do not overwrite them. The [closeout checks](../target/live-cost-builder/closeout-check.json) independently verify the canonical hash using the original JS sourceIdentity function, successful patch application, exact patched/frozen crate identity, unchanged active sources/artifacts, no new unsafe, and timed/final WASM identity. [Summary](../target/live-cost-builder/summary.json) and [delivery file hashes](../target/live-cost-builder/delivery-inventory.json) bind the handoff.

The actual build invocations/environment/statuses, per-variant commands and all native run commands are retained in the linked JSON. WASM flags are exactly `-C link-arg=--max-memory=134217728 --remap-path-prefix=<owned-source>=/workspace --remap-path-prefix=/home/xtra/.cargo=/cargo`, scoped to wasm32-unknown-unknown. Optional inline chart preview was blocked by the host AppArmor browser sandbox; no host setup was attempted. The [standalone chart HTML](../target/live-cost-builder/wasm-p95.html) was rendered in the thread. This is presentation only, not browser-worker validation. No owned processes remain running at handoff.
