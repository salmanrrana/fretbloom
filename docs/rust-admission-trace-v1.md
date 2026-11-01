# Admission trace v1 — passive DEV causal trace

2026-10-31. **KILL downstream decoder as the main fix at the current admitted-note interface.** A constructed true pitch loses its candidate upstream, and another loses temporal ownership before segmentation. A decoder of admitted notes cannot supply that missing evidence. A per-pitch decoder/unified-ledger prototype is **not justified by this run**: prior ownership is demonstrated for one true sustained voice, but safe reattack/confounder discrimination within 0.32 seconds remains **unresolved**. Stop here; no expansion, tuning or product adoption.

This is branch attribution on nine frozen cells from seven existing DEV/control inputs, not an accuracy claim. Pickup labels are not adjudicated acoustic truth; reference-empty palm-mic cells do not prove acoustic silence. Construction supplies the synthetic event truth. Engine “independent” flags describe its own ownership rules, not an independently calibrated physical guarantee.

## Identity, freeze and scope

- Baseline canonical source: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`.
- Baseline native: `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`.
- Instrumented canonical source, including new `trace.rs`: `d4ef18eeb9cba79379421addc79ea7098bc798f38a21b1caf7245e61156bce4a`.
- Instrumented complete disposable-source inventory digest: `f7ece24d5a32726ef01a41d3c12ea9504b068232cd627e26fa9b790a2c0eedf5` (SHA256 of compact JSON of the ordered path→SHA256 map).
- Instrumented native: `9d8e3e6a8517269c4fe3914222f52fd5fa815db4d8b65f0e55aca1e76520b36a`.
- Selection manifest: `c2133b2e7a60417be92d1fb412f22eca66c0be5e4c9a12069d60d72f86b6bc54`.
- Manifest frozen **2026-10-31T18:35:23.779402+00:00**; first analysis **2026-10-31T18:36:36.947348+00:00**, after the freeze.
- `rustc 1.89.0 (29483883e 2025-08-04)`; `cargo 1.89.0 (c24e10642 2025-06-23)`. Whole-workspace `--locked --offline` build succeeded. Copied Cargo.lock remains byte-identical; no dependency edits or lockfile pruning.

Before instrumentation, all 25 preserved snapshot inventory entries matched both the snapshot and active files. All canonical source entries and the disposable pre-instrumentation copy also matched the baseline association. End checks confirm active canonical sources, preserved native, copied lockfile, frozen input/manifest hashes and instrumented inventory. See [identity](../target/admission-trace-v1/identity-before.json), [build association](../target/admission-trace-v1/build-association.json) and [summary](../target/admission-trace-v1/summary.json).

Only new `validation/admission-trace-v1/**`, disposable `target/admission-trace-v1/**` and this report were written. No active core, generated files, product files, existing evidence, holdouts, dependencies, models, thresholds or WASM were changed. No servers, production services, deployments, pushes, commits or child agents.

## Fixed inputs

Exact cell indices, 20 ms intervals, integer sample centers, logging ranges, modes, construction events and selection reasons are in the [frozen manifest](../validation/admission-trace-v1/manifest.json). Inputs were analyzed whole, including the failing 552.001417-second palm-mic input; no diagnostic crop replaced it. All are 24 kHz f32le, A440, sharps. Palm/late-voice use auto; acoustic controls use the original polyphonic mode.

| Whole input | PCM SHA256 |
| --- | --- |
| `late_voice.f32` | `ab4849ac6f35f6b4eb43575b4a16ad9426cf51a354cafc8153665942ee5d1eba` |
| `P1_techniques_PalmMute_micamp.f32le` | `a0a87b5371d53d5b0ed750c5601ba337c0e6692081e07231edf5b2968647add4` |
| `57-0.03-0.0-pluck.f32le` | `74a8a7257363e008b4a62951a4ad313e096b07eaced34dcd668f39855b606a48` |
| `57-0.03-0.0-vibrato.f32le` | `8b42a15fb6e2437978184df273cc576624a4d7fc3ebc547cca590623813107f4` |
| `57-0.03-0.0-beating.f32le` | `53776113c61f8a0f50713a1787dc0e14ceeafce56550c25f2c6081511ff6bc5c` |
| `45-0.03-0.0-pluck.f32le` | `0053c405b60bc373f86435903a8efdb79655a5aa7ad190ac19d2927e44078afd` |
| `seam-57-1.42-0-61440.f32le` | `3a64e1f82f7f69fc1a4ca100bbab8fbcc6f9f1dc7c9ebf195390de5a149f45fc` |

## Observed branches

The [observer generator](../validation/admission-trace-v1/instrument.py) adds no DSP or support calls. It records the actual cached support calls, measured long/short peaks, candidate/fundamental IDs and weights, residual witness IDs, active owners, temporal parents/strength/shapes, evaluated innovation votes, greedy winners/improvements and numeric rejection predicates. It also records post-fit amplitudes, support/singleton operands and membership, raw/median/confirmed sets, short-run removals, actual reached note boundaries and the cap. Route transitions are derived from confirmed membership and auto-mode routing only. Observations do not replace decisions or extend input support.

Full passive source changes are in [instrumentation.diff](../target/admission-trace-v1/instrumentation.diff); raw JSONL and complete outputs are under [runs](../target/admission-trace-v1/runs). The [cell extraction](../target/admission-trace-v1/summary.json) preserves exact operands, and [conclusions](../target/admission-trace-v1/conclusions.json) binds the following explanations. Arithmetic quoted from logged peak values is an explanation, not a second detector run.

**sustained_69_loss — cell 183, [3.66, 3.68) s.** Frame182 retains MIDI69 through temporal parent57 with strength6. Frame183 has best innovation0, strength6->5 below required6; after57 wins, residual witnesses0<2 and temporal_voice=false, so admission rejects69. Cached support is confirmed; pre-fit/raw/median/confirmed lose69 and the event ends3.66. Ownership loss is upstream.

**palm_supported_59_omission — cell 25, [0.50, 0.52) s.** Frame25 candidate59 exists with normalized fundamental0.3674195198317159. After40 wins, explained_partial=true, independent0<2, temporal strength0<6; rejected. Cached support confirmed does not supply independent ownership. Physical truth of59 unresolved.

**palm_route_only_40 — cell 3, [0.06, 0.08) s.** Confirmed MIDI40 continues from frame2 to3 while mono null->40. At frame2 singleton tight/all=0.5058704406402774 fails >0.98 with independent=true; at3 tight/all=0.9838071792345514 passes and singleton_taken40. Actual wire splits the same confirmed pitch at0.06.

**palm_empty_label_runs — cell 186, [3.72, 3.74) s.** Frame186 winners53,34,59,68 have improvements1.0633907010195163,1,0.16578035729110496,0.11236374238123499 above0.018963141693894355. MIDI34 uses a single prominent residual witness; cached uncertain is promoted because continuing and uncertain_before0<2. Other three cached supports confirmed. All four survive median/confirmation. Empty pickup labels do not adjudicate physical silence.

**57-0.03-0.0-pluck — cell 40, [0.80, 0.82) s.** Frame40 admits57 with witnesses3, improvement1.4052219473513352>0.008907974433115542; support confirmed. Target survives smoothing and event stays[0,1.6), merging the constructed0.8 re-excitation. Existing3.1 serializes continuous membership; it has no same-pitch excitation boundary predicate. Safe raw-evidence attack discrimination remains unresolved.

**57-0.03-0.0-vibrato — cell 40, [0.80, 0.82) s.** Frame40 admits57 with witnesses6 and support confirmed. At frame42(0.84s), candidate57 is absent: nearest measured fundamental220.091260445258Hz is0.7180019538148008c, estimated tuning47.45379993930816c, difference-46.73579798549336c outside45c. Prior57 is still support-confirmed, but that cannot reinsert a missing fitted candidate. Median cannot restore the sustained multi-cell gap and final target run ends0.84. Upstream candidate failure creates a false fragment; safe excitation discrimination unresolved.

**57-0.03-0.0-beating — cell 40, [0.80, 0.82) s.** Frame40 admits57 with witnesses8, improvement1.8017058983143464>0.009008529491571732 and confirmed support. Target survives all stages and stays[0,1.6). This is the correct no-reattack control at the event interface, but does not prove a raw-evidence separator from pluck.

**45-0.03-0.0-pluck — cell 40, [0.80, 0.82) s.** Frame40 admits45 with witnesses2, improvement1.3103313256848013>0.008777346085973955 and confirmed support. Target stays[0,1.6), missing constructed0.8 boundary. Extra73 also survives: singleton witness1, improvement0.10711322882378903>0.008777346085973955; local support confirmed. No low-register onset repair attempted.

**seam-57-1.42-0-61440 — cell 71, [1.42, 1.44) s.** Frame71 admits57 with witnesses3, improvement1.4080397841111028>0.008997248884005542 and confirmed support. Target stays[0,2.56), missing constructed1.42 boundary. No membership break exists for the serializer to emit; a safe bounded excitation predicate remains unresolved. This preserves one known seam fixture, not all27.

For the sustained voice, innovation at all four tested lags fails at frame183: fundamental changes 0.056520/0.094004/0.145704/0.164741 are below thresholds 0.147597/0.180469/0.228255/0.245434; matched counts are 0/0/1/1 versus required 3. Best innovation is zero, so strength decays. At frame182 MIDI69 was admitted through temporal ownership (strength6, parent57, improvement0.9454479301 > gate0.0111090865); at183 it fails ownership, even though local support remains confirmed. Its eight witnesses before lower-voice selection are shared peaks, not eight exclusive physical witnesses.

At the palm route cell, the reached serialization records MIDI40 poly `[0.04,0.06)` then mono `[0.06,0.34)`. No physical-membership gap separates them. At the empty-label cell, `[34,53,59,68]` survives all frame stages, but the real pitch-ordered event loop reaches only lower pitches before its cap: do not invent serialized59/68 boundaries or a partial product. It stops at poly event4001, MIDI53, end cell20081. That append location is not the source-analysis frontier. Route-only palm-mic repair remains ruled out by the previously measured 9,694 union runs; this small trace does not rerun that inventory.

The true pluck and beating control both emit one continuous target event. Numerical raw differences exist, but no safe existing excitation predicate separates the controls here. Vibrato additionally fragments through candidate loss; low45 admits an extra singleton73. Retaining every locally supported band would therefore erase an ownership distinction and preserve false hypotheses. No new classifier, decoder, sweep or threshold was introduced to resolve this ambiguity.

## Instrument acceptance and resources

**PASS on the frozen selection.** Six successful whole-input output files are byte-identical and parsed-JSON identical, including floats, features, warnings and events. The full palm-mic pair both exits3 with identical stdout/stderr (`analysis limit exceeded: too many note events`), no output and no temporary partial. Every trace numeric value is finite. The summaries assert these checks rather than substituting missing output with empty success.

Raw JSONL totals **37,791,906 bytes (36.04 MiB)** versus the predeclared256 MiB total ceiling. The observer additionally enforces32 MiB per process; the largest file is24,545,975 bytes. Every analysis command finished below110 seconds; the final build took12.49 seconds. Initial observer editing/build failures (an ambiguous replacement and debug-only Rust borrowing) occurred before inference; corrected observer code was built before the first run. No detector behavior was changed to fix them.

**Instrumentation overhead only; not engine/browser performance.** These are single observations, with process startup, JSON/file I/O and host variation. The short runs overlapped the beginning of the full baseline run. Time is measured around each child command; `/usr/bin/time -v` records CPU/RSS separately. The negative full-input delta does not establish a speedup. No timing-based tuning or repeated performance experiment was done.

| Input | Baseline wall s | Observed wall delta s | Instrumented wall s | Baseline / instrumented peak RSS KiB |
| --- | ---: | ---: | ---: | ---: |
| `late_voice` | 0.1646 | +0.0500 | 0.2146 | 6720 / 6800 |
| `P1_techniques_PalmMute_micamp` | 71.4723 | -2.6224 | 68.8498 | 106628 / 106352 |
| `57-0.03-0.0-pluck` | 0.0321 | +0.0321 | 0.0643 | 5912 / 5840 |
| `57-0.03-0.0-vibrato` | 0.0643 | +0.0499 | 0.1143 | 5908 / 5904 |
| `57-0.03-0.0-beating` | 0.0320 | +0.0323 | 0.0643 | 5800 / 5952 |
| `45-0.03-0.0-pluck` | 0.0321 | +0.0319 | 0.0641 | 5852 / 5848 |
| `seam-57-1.42-0-61440` | 0.0641 | +0.0001 | 0.0642 | 5976 / 6072 |

Short-input user-CPU additions were0.01–0.04 s. Full palm user/system CPU was71.11/0.11 s baseline and68.65/0.14 s instrumented. These measurements neither isolate observer cost reliably on the long run nor establish uninstrumented engine throughput.

## Commands and limits of the result

Executed from the repository root (fixed destinations already exist; do not overwrite them):

```sh
python3 validation/admission-trace-v1/prepare.py
python3 validation/admission-trace-v1/instrument.py
CARGO_TARGET_DIR="$PWD/target/admission-trace-v1/build" RUSTC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustc RUSTDOC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustdoc timeout 110 /home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/cargo build --manifest-path target/admission-trace-v1/source/Cargo.toml --locked --offline --release -p fretbloom-analysis --bin analyze-pcm
python3 validation/admission-trace-v1/run.py baseline 1
for idx in 0 2 3 4 5 6; do
  python3 validation/admission-trace-v1/run.py baseline "$idx"
  python3 validation/admission-trace-v1/run.py instrumented "$idx"
done
python3 validation/admission-trace-v1/run.py instrumented 1
python3 validation/admission-trace-v1/explain.py
python3 validation/admission-trace-v1/summarize.py
```

The first full baseline command and short group ran concurrently; the full instrumented command followed the completed baseline. Each analysis invocation uses a110-second child deadline. Exact expanded argv, environment, UTC start, binary/input/output hashes, status, wall time and partial-file checks are in each `runs/*/run.json`; resource logs, stdout and stderr are alongside them. [Evidence inventory](../target/admission-trace-v1/evidence-inventory.json) binds the scripts and finished evidence.

Unproved: safe reattack discrimination within0.32 seconds; a ledger that retains a true upper voice without keeping shared-partial false voices; general low-register/seam recovery; physical truth of disputed pickup-label bands; whole-corpus accuracy, all27 seam cases, live/browser cost and any product benefit. One known low45 pluck and one seam57 failure were preserved, not repaired or generalized. The trace kills a decoder of already admitted notes as the main remedy; it does not disprove every decoder that consumes new upstream evidence. The conditional justification gate for such a prototype remains unmet.

All owned analysis/build processes have exited. Ownership is released; no further writes or experiments are planned.
