# Joint attribution candidate — rust-dsp-4

**Reject this candidate for adoption: musical, retention and compute gates fail.**
This is a frozen substantial joint-model implementation, not a completed working
guitar recognizer or a suitable replacement for the live engine.
No generated WASM, protocol, vocabulary, scorer, corpus, public options, runtime,
production, database, commit or deployment change belongs to this package.

## Connected model

`joint_fit.rs` fits sums of complex measured partial trajectories. Each track is
one observation even when several proposed strings share it. A complex Hermitian
least-squares solve assigns constant complex harmonic coefficients to all active
voices together. Unlike v3, neither admission nor initialization requires an
already isolated lower carrier. A candidate still needs a measured fundamental.

The voice envelope has an attack, exponential continuation, linear/quadratic
harmonic damping, and a common piecewise envelope for a restrike/change of decay.
Parameters come from training observations, including alternative rate proposals
from all matched partials. The fundamental-derived common envelope is two fitted
log-linear pieces, not independent amplitude weights at every time/partial.
Each voice has one frequency shared across harmonics; measured phase advances
correct the long-anchor frequency bias. Different detuned voices have different
phase advances in the same shared observation. The corrected circular-distance
phase tests and short-transform phase tests remain.

A maximum of 96 measured tracks, 14 pitch proposals, three beam members and six
voices bounds fitting. Coarse proposals receive two optimization rounds; at most
six proposals at each depth receive three further rounds. Six later hops are
excluded from coefficient/envelope training and score prediction. Complexity is
charged against temporal variation with a numerical floor; the existing private
`MIN_FIT_IMPROVEMENT` constant is unchanged. This is a new model-selection
objective, not unchanged statistical calibration or a claim of unique string
identifiability. A signal-identical singleton/multiple-source sum remains ambiguous.

The rolling history is 24 hops. Full voice-set search runs every four hops;
intervening hops refit the active set, carrying only its bounded physical parameter
seed. This is local to one `analyze` call, reset on silence. It adds at most 80 ms
proposal cadence within the existing 640 ms warmup and 320 ms future reserve;
no cross-call state or full-recording spectrogram is retained. The public window
and support contract is unchanged. Numerical loops and candidate loops remain
bounded; cancellation is checked between proposals and spectral measurements.

`polyphony.rs` uses the joint result once history is available; its original
conservative spectral fit remains for warmup, bass and a high-residual temporal
fit. Candidate-specific physical absence, projection support, absence-aware
smoothing and finite endpoints remain. The integrated continuation path permits
a jointly predicted multi-voice contribution to confirm a phase-uncertain band,
never a physically absent band. The same extra-voice evidence prevents YIN from
collapsing a supported mixture. Mono/poly output routing remains exclusive.
The model-only ablation removes just this new uncertain-band confirmation.

## Validation and handoff

Final source-associated evidence is below. Exploratory snapshots are not final
acceptance evidence. No holdout was inspected or executed.



## Frozen outcome: reject for adoption

All 51 existing synthetic DEV inputs ran in all three modes, all three whole GuitarSet DEV recordings ran in auto, and all twelve supplemental inputs ran in auto: **168/168 complete, zero execution/wire/scorer failures**. The model-only ablation independently completed the same 168 calls. The frozen independent 20-control manifest ran in all three modes: **60/60 complete, zero execution/wire failures**. Original scorers, labels, denominators, endings and thresholds are unchanged. No holdout run or inspection occurred.
The candidate is **not** an overall musical upgrade. Recall/F1 and exact register sets improve, but PC exact, mono sustain, primary harmony and boundaries regress. C6 and madd11 are unresolved, the required 244-frame dim/half-dim retention fails, and four unignored functional tests fail. Do not regenerate/publish WASM or infer acceptance from this handoff.

## Exact association

- Native integrated: `d5634791f1af0ebae31176c922424d01bec042ff6dae8a806d134d1940acde72`.
- Native source/test inventory: `3454b0a450aae077ee0e385a11af4d0030aad3cec006d8811f39f58a97c279ca`.
- Canonical WASM source input identity: `ee2da954bc1a175b18ef37722e1993a2533d831d5e7cf0902487e511c9449a19`.
- Model-only native: `8c10eafbda757084c995ba91a8b8e484f91c7bca9ebe1aa5ffa56fbba85dd270`. Its only source difference is removal of joint confirmation of projection-Uncertain bands.
- `Cargo.lock` remains `4cf9ea7903f854b54c1eb312c6f0ad828b2a3234015da44afb619c2687bae953`.
- Frozen executable, full source copies and per-file SHA256s: `target/joint-attribution/integrated/{analyze-pcm,source/,snapshot.json,canonical-source.json}`. Model-only association is adjacent under `model-only/`. `source-recheck.json` verifies current source and binary equality and preservation of all nonowned phase-snapshot files.
- Published WASM remains frozen v3. Normal `scripts/wasm-verify.mjs` **rejects** the changed source as expected (`expected-stale-wasm.log`); no bypass/regeneration occurred. Actual rust-dsp-4 WASM/browser budgets/parity are untested and belong to root.

## Settled synthetic auto, original denominators

| Metric % | d933 | d3e0 | Phase/v3 | Joint |
|---|---:|---:|---:|---:|
| mono_early_exact | 97.43 | 99.63 | 99.63 | 99.63 |
| mono_exact | 90.52 | 92.03 | 92.13 | 87.28 |
| poly_midi_exact | 15.88 | 6.65 | 8.94 | 17.68 |
| poly_pc_exact | 81.98 | 87.71 | 87.13 | 81.06 |
| note_precision | 80.41 | 95.24 | 94.36 | 94.22 |
| note_recall | 82.14 | 66.95 | 68.53 | 73.37 |
| note_f1 | 81.26 | 78.63 | 79.40 | 82.50 |
| root_accuracy | 80.39 | 87.96 | 88.10 | 84.43 |
| quality_accuracy | 73.47 | 82.55 | 82.05 | 72.96 |
| compatible_identity_accuracy | 52.66 | 59.17 | 58.81 | 52.30 |
| bass_accuracy | 96.60 | 98.20 | 98.25 | 98.25 |
| negative_false_positive_rate | 2.46 | 0.00 | 0.00 | 0.00 |
| boundary_f1 | 54.55 | 60.00 | 50.00 | 40.00 |

Joint TP/FP/FN = **7373/452/2676**; exact MIDI **364/2059**; PC exact **1669/2059**; compatible primary **1012/1935**. Boundaries **3/9/0**, matched mean error 16.7 ms over only three matched boundaries. More false boundaries are not waived by smaller matched error.
Frozen gates retain F1 ≥85%, precision/recall ≥80%, mono early/sustain ≥95/90%, PC exact ≥85%, root/quality ≥90%, compatible primary ≥85%, each intended group ≥70%, bass ≥85%, dedicated negatives ≤1%, boundary F1 ≥85%. Exact MIDI 80% remains diagnostic. All unknowns remain in their original denominators; alternatives receive no primary credit. Dedicated silence/noise/percussion remains **0/300**, separate from other reference-empty margins **0/1445**.

| Mode | Mono P/R/F1 % | Poly P/R/F1 % | Routing % | Wrong stream / duplicate frames |
|---|---|---|---:|---|
| auto | 100.00/79.10/88.33 | 89.34/71.52/79.45 | 95.43 | 127/0 |
| monophonic | 100.00/79.10/88.33 | —/—/— | 95.56 | 0/0 |
| polyphonic | —/—/— | 91.41/73.10/81.24 | 97.77 | 0/0 |

Timed mono TP falls **1012→912** versus phase/v3. Forced-mono refusal, routing and complete stream denominators remain in original `score.json`; union gains do not compensate for mono losses.

| Intended group | Phase PC / MIDI F1 / primary % | Joint PC / MIDI F1 / primary % |
|---|---|---|
| chord:maj | 73.05 / 70.90 / 73.76 | 71.39 / 74.92 / 71.16 |
| chord:min | 100.00 / 75.65 / 100.00 | 98.35 / 84.83 / 98.35 |
| chord:7 | 97.94 / 87.43 / 97.94 | 83.54 / 87.14 / 83.54 |
| chord:maj7 | 67.03 / 73.49 / 67.03 | 50.00 / 73.10 / 51.10 |
| chord:m7 | 95.05 / 87.55 / 0.00 | 94.51 / 85.85 / 0.00 |
| chord:sus2 | 100.00 / 80.00 / 0.00 | 100.00 / 86.45 / 0.00 |
| chord:sus4 | 100.00 / 81.14 / 0.00 | 100.00 / 87.12 / 0.00 |
| chord:add9 | 100.00 / 86.17 / 100.00 | 86.89 / 83.94 / 68.85 |
| chord:6 | 0.00 / 75.00 / 0.00 | 14.75 / 78.08 / 0.00 |
| chord:m6 | 100.00 / 92.23 / 0.00 | 73.77 / 90.85 / 0.00 |
| chord:dim | 100.00 / 85.71 / 100.00 | 100.00 / 89.34 / 100.00 |
| chord:aug | 100.00 / 84.33 / 0.00 | 93.44 / 94.02 / 0.00 |
| chord:none | 96.77 / 83.05 / — | 96.77 / 96.73 / — |
| note:none | — / — / — | — / — / — |
| silence:none | — / — / — | — / — / — |
| noise:none | — / — / — | — / — / — |
| percussion:none | — / — / — | — / — / — |
| transition:mixed | 93.10 / 78.22 / 93.10 | 76.44 / 79.76 / 76.44 |

## Every changed note frame and register

`frame-deltas.json` retains **every changed 20 ms reference/old/new note set**, every gained/lost true and added/removed extra MIDI count, in all three synthetic modes and every whole real/supplemental case, against phase-only, v3, d3e0 and d933. `control-deltas.json` does the same for all 60 new-control outputs. These are timed diagnostics, not replacement settled scorers. `comparison.json` retains every original group/case/root/quality/primary/alternative/bass/boundary count. `ablation-frame-deltas.json` retains all model-only/integrated changes.

| Versus phase/v3 | Mode | Gained / lost true | Added / removed extra |
|---|---|---|---|
| synthetic | auto | 786/257 | 388/252 |
| synthetic | monophonic | 0/100 | 0/0 |
| synthetic | polyphonic | 786/257 | 388/252 |
| real | auto | 107/176 | 199/390 |
| extended | auto | 84/116 | 63/36 |

| Timed synthetic register | TP / FP / FN |
|---|---|
| 28-47 | 2315/0/176 |
| 48-59 | 5396/154/1175 |
| 60-71 | 1983/469/2195 |
| 72-96 | 138/301/72 |

## Whole real DEV

| Recording | Mono P/R/F1 % | Poly P/R/F1 % | Empty emitting / total | Union exact MIDI / PC | Onset+offset event F1 % |
|---|---|---|---|---|---:|
| 00_Rock2-142-D_solo | 100.00/24.63/39.52 | 61.75/92.81/74.16 | 113/175 | 401/1178; 449/1178 | 10.39 |
| 00_SS3-84-Bb_comp | 100.00/30.68/46.96 | 73.72/60.41/66.40 | 75/135 | 388/2151; 804/2151 | 12.00 |
| 01_Jazz3-150-C_comp | 100.00/24.52/39.39 | 60.53/73.99/66.58 | 232/382 | 221/898; 230/898 | 30.00 |

Real onset-only, onset+offset, routing, bass and performed/instructed harmony remain separately recorded in `integrated/real/report.json`. Room tails and annotation uncertainty are unresolved; no disagreements are relabeled correct.

## Supplemental family/capo retention

| Case | TP / extra / missing | Exact MIDI / denominator | PC exact | Primary / alternative / abstain |
|---|---|---|---:|---|
| dev_v1_Amadd9_capo0 | 240/0/60 | 0/60 | 60 | 60/0/0 |
| dev_v1_Amadd9_capo3 | 243/0/57 | 3/60 | 60 | 52/8/8 |
| dev_v1_Cadd11_capo0 | 201/4/99 | 0/60 | 17 | 17/0/43 |
| dev_v1_Cadd11_capo3 | 240/0/60 | 0/60 | 60 | 51/9/9 |
| dev_v1_Amadd11_capo0 | 183/0/117 | 0/60 | 0 | 0/60/60 |
| dev_v1_Amadd11_capo3 | 168/47/132 | 0/60 | 5 | 3/55/57 |
| dev_v1_Bdim7_capo0 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_Bdim7_capo3 | 240/0/4 | 57/61 | 57 | 0/57/57 |
| dev_v1_Bhdim7_capo0 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_Bhdim7_capo3 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_E5_capo0 | 159/4/27 | 31/62 | 62 | 62/0/0 |
| dev_v1_E5_capo3 | 147/8/39 | 23/62 | 62 | 62/0/0 |

Dim/half-dim retention is **240/244**, losing four Bdim7 capo3 exact frames. Unambiguous-primary denominator remains zero for those equivalent families. Alternatives do not repair a primary metric.

## Required failure controls

- C6 .70: **[48,52,57]**, still missing **60/67**; zero settled exact sets. Its PC-exact count rises to 9/61, not sustained full-voicing recovery.
- madd11 capo0 .71/1.21: **[45,50,60]**, missing **57/64**. Capo3 .71: **[48,53,67,75,79,82]**, missing **60/63** with three high extras; 1.21: **[48,53,75]**. Both remain 0/60 exact.
- Rock 4.21: **[64,69]**, removes 83 while retaining both true notes. Whole-recording regressions remain separately counted.
- Jazz 3.61: **[45,57,60,64,68]**, preserves 57/60/64 but still adds 45/68.
- Unchanged generated sustain-truth test is unignored and **passes all 19 whole/cropped probes**. Agreement test was renamed to refer to separate truth accounting. Reviewer PCM independently passes all seven whole probes and late-window .64/.8/1/1.4, but **still loses 69 at late-window 1.8**. This remaining miss is explicitly not accepted as agreement-based recovery. Exact samples/hashes/commands are in `fixed-probes.json`.
- No uncontaminated-carrier condition remains in the joint search. That removes the reviewed structural dependency, but it demonstrably does **not** establish correct multi-string attribution on C6/madd11. Per-candidate fundamental contribution must still exceed 10% of its measured shared band; this can reject a quiet independent contribution. Per-partial coefficients are time-constant, but near-collinear envelopes/frequency errors can still admit aliases. These are model limits, not evidence of source absence.

## Frozen independent controls

Source-truth, signal-identical ambiguity and tonal-noise intent controls remain separate. Manifest SHA256 is `c6572520f78e6ec5f468b4d9875c31cb46ac11e49c2e2fefd2e99b78a85f3ad0`. Input PCM/labels were read-only. Every frame, onset/release error and source/stream disagreement remains in `integrated/controls/report.json`.

| Auto control | TP / extra / lost true | Exact / frames | Wrong stream | Events matched / reference / predicted |
|---|---|---|---|
| voices3_simultaneous | 258/37/59 | 74/145 | 4 | 2/3/16 |
| voices3_offset_halfturn | 264/12/39 | 98/145 | 7 | 2/3/9 |
| voices4_simultaneous | 318/21/96 | 82/145 | 4 | 2/4/11 |
| voices4_offset_halfturn | 336/23/50 | 104/145 | 7 | 2/4/9 |
| voices5_simultaneous | 285/67/201 | 51/145 | 4 | 2/6/23 |
| voices5_offset_halfturn | 255/88/184 | 56/145 | 7 | 2/6/24 |
| voices6_simultaneous | 362/25/233 | 36/145 | 4 | 2/6/22 |
| voices6_offset_halfturn | 334/45/190 | 45/145 | 7 | 2/6/19 |
| quiet_late_transpose0 | 388/67/153 | 91/260 | 76 | 0/3/36 |
| quiet_late_transpose5 | 458/93/83 | 141/260 | 31 | 0/3/33 |
| single_bright_43 | 109/12/1 | 132/145 | 13 | 0/1/10 |
| single_bright_67 | 110/0/0 | 145/145 | 21 | 0/1/43 |
| single_tilt_43 | 109/4/1 | 140/145 | 6 | 0/1/8 |
| single_tilt_67 | 110/3/0 | 142/145 | 3 | 1/1/3 |
| single_vibrato_43 | 109/26/1 | 121/145 | 34 | 0/1/25 |
| single_vibrato_67 | 110/0/0 | 145/145 | 1 | 0/1/3 |
| tonal_noise_1 | 0/368/0 | 32/145 | 0 | 0/0/12 |
| tonal_noise_0.35 | 0/368/0 | 32/145 | 0 | 0/0/12 |
| ambiguity_two_sources | 176/10/44 | 101/145 | 33 | 0/2/13 |
| ambiguity_one_harmonic_source | 109/77/1 | 68/145 | 76 | 0/1/13 |

The paired low-register singleton controls regress (bright/tilt/vibrato extras); these are not offset by improvements in three/four-voice recall. Exact-signal partners still produce identical results, without asserting a unique physical source count. Tonal noise has actual narrowband evidence; its intent-based abstention scores are diagnostic, not a uniquely identifiable acoustic oracle.

## Functional checks and ablation

Pinned Rust release suite: **37 passed, four failed, one allocation test ignored in the ordinary suite**. The allocation test then passed alone. All original `analysis.rs` (8), `dsp_reliability.rs` (9), vocabulary (1), and ten ordinary unit tests pass. Four failures remain unignored:

- `delayed_octaves_have_independent_attacks_and_releases`: MIDI64 case at .7 emits only 64; expected 64/76.
- `three_aligned_voices_keep_their_own_releases`: 1.2 emits 48/67, missing 60.
- `inharmonic_singleton_and_tonal_background_do_not_fill_chord_tones`: emits 57/69 instead of the allowed singleton/actual tonal-background set.
- `independent_envelopes_recover_three_to_six_voices_across_register_and_gain`: 20/24 sampled exact sets pass; one five-voice and three six-voice low-register cells fail with true-note losses and aliases. Expected notes, gains, phases, activity intervals and endpoints were not changed to get green.

`freeze-tests.log` contains complete failure sets. Clippy with warnings denied and owned-file rustfmt check pass. The phase-pi/wrapping/weak-amplitude/frequency guards and FFT phase assertion remain tested.

The predeclared model-only ablation changes only uncertain-band confirmation. It has **identical original synthetic scores in all three modes and identical supplemental scores**. On whole real audio, integrated continuation adds **3 true and 8 extra note-frames**, loses/removes zero. The major gains and regressions therefore come from attribution, not a continuation win. Both ablation binaries/source inventories, all 336 original DEV calls and frame deltas are retained.

## Reproduction and ownership

```sh
export RUSTC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustc
export RUSTDOC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustdoc
export CARGO_TARGET_DIR=target/joint-attribution/build
CARGO=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/cargo
$CARGO test --locked --release -p fretbloom-analysis --tests --no-fail-fast
$CARGO clippy --locked -p fretbloom-analysis --all-targets -- -D warnings
$CARGO build --locked --release -p fretbloom-analysis --bin analyze-pcm
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/evaluate.py <NEW-snapshot-directory>
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/controls.py <NEW-snapshot-directory>
```
Creation runners refuse existing output directories. `run-cargo.sh`, `freeze.py`, `evaluate.py`, `controls.py`, `compare.py`, `extra-baselines.py`, `summarize.py` and resource wrappers preserve exact commands and reroute only output/binary paths. Do not rerun into retained evidence. Earlier exploratory evaluations were stopped after revealing excessive compute, are incomplete and are not final acceptance evidence. `integrated-pre-continuation/` is superseded by the final source-associated `integrated/` freeze. The final source was not altered after freeze.


## Resources, compute and remaining evidence limits

Intel i7-1165G7, eight logical CPUs, Linux, actual Rust 1.89.0; environment/tool
versions are in `environment.json`. Shared-host load is recorded, not an
exclusive-host claim. The **unchanged original resource probe timed out at
110 seconds on the 600-second input** (`freeze-resources.log`). The separate
extended measurement changes only its diagnostic subprocess deadline to allow
completion; this does not convert the original failure into a pass.

| Input | Wall / user CPU s | Peak RSS KiB | Features | Poly / harmony events | Exit |
|---|---|---:|---:|---:|---:|
| 30 s | 5.88 / 5.87 | 9,580 | 375 | 53 / 17 | 0 |
| 600 s | 125.10 / 125.01 | 115,668 | 7,500 | 1,050 / 302 | 0 |

Native 600-second processing completes with bounded rolling state and exact
finite output duration. It is about 11.5 times v3's previously measured 10.89 s
on this simple repeated four-voice probe. This comparison is diagnostic across
runs, not a controlled exclusive-host speed ratio. New simultaneous SIGINT after
real DSP begins exits 130 in **3.40 ms**, publishing no destination. Invalid raw
length and NaN checks pass without output. Raw completion/cancellation evidence:
`extended-resources.log`; wrappers preserve the unchanged original signal and
assertions. Only that extended measurement's timeout differs.

Eight fixed 2.56-second three-to-six-voice native CLI windows take **2,515.6 to
4,698.7 ms**, median **4,001.2 ms**, including process and I/O. Each input/hash,
command, output, duration and timing is in `native-windows/report.json`. This is
not browser-worker compute and eight calls do not establish a browser p95.
Nevertheless the cost is a severe live-feasibility blocker, not a credible basis
for claiming <=500 ms portable-WASM compute. No support window or public protocol
was changed to conceal it. Actual root-owned WASM/browser measurements remain
unperformed. The original distinct targets remain **p95 window compute <=500 ms**
and **p95 steady event delay <=1.5 s**; no 500 ms DOM gate is invented.

The isolated allocation meter reports **565,768 bytes** history/short-FFT/joint
scratch high-water and **5,857,268 cumulative requested bytes** over 28 hops.
Adding the retained prior Frame layout delta (24 bytes x30,000 hops x two vectors),
peak phases (8,832 bytes) and 64 KiB conservative stack allowance gives
**2,080,136 bytes**, below 2 MiB. This is requested working allocation plus the
stated accounting, not total process memory or allocator-internal proof. The
allocation test's own upper assertion is 3 MiB; the measured result is stated
without silently equating it to that assertion. The rolling heap has 24
preallocated 552-peak slots; track/voice/beam arrays and optimization rounds have
explicit bounds. No retained full spectrogram or cross-call state is introduced.
Native RSS does not establish <=128 MiB WASM or <=96 MiB application-owned JS.

The bounded fit is still under-calibrated for correlated envelopes, weak shared
fundamentals, inharmonic strings and changing timbre. The high aliases and lost
true notes remain scored failures, not inferred absence or annotation corrections.
The public result schema intentionally exposes no per-voice decomposition trace;
this pass did not collect a complete instrumented per-voice residual/onset/release
trace for every real control. Event errors and every emitted/expected frame are
retained, but an exact acoustic gate diagnosis of Jazz45/68 or each C6/madd11 miss
is **not established**. Further attribution/optimizer work is required before
acceptance, including retaining the untouched singleton partners and dim frames.
A neural model or new dataset is not introduced or justified by this candidate.

## Final file inventory and explicit release

Only the assigned source/test files, this report and ignored
`target/joint-attribution/**` were written. Public types/options/schema, chord
vocabulary/templates, pitch/config/segments, CLI, manifests/lock, runtime/UI,
packaging/generated WASM, scorers/corpora/prior reports and sibling checkouts were
not edited. Ownership was not crossed; no child agent, commit, push, deployment,
production or database operation occurred.

| Assigned source/test | SHA256 |
|---|---|
| `crates/fretbloom-analysis/src/lib.rs` | `2e190161e89f3face7022ef69dda269f98df1cc67e15400bcc96fd971986be24` |
| `crates/fretbloom-analysis/src/polyphony.rs` | `6ecfe48225435993995a63353f2556f616b39e8becafea15bc46016afc28ebc7` |
| `crates/fretbloom-analysis/src/spectrum.rs` | `b9b2ae4b28c11917173af5ef2c8d4149eaa29622d3fb241154ce3fbbc0a45f1c` |
| `crates/fretbloom-analysis/src/voice_evidence.rs` | `49d4cb882f87b365a30fb21d0160b467f284753e80d77c42b1342df6ed6b4022` |
| `crates/fretbloom-analysis/src/joint_fit.rs` | `7c503cc861310281e70079c2605b29630f2c4ac502c0d85a2568fbc517b88335` |
| `crates/fretbloom-analysis/tests/musical_repair.rs` | `3289d79e6c09914f8dbf5c911d99ca0b2c6e3e4150cbb285e2b2d6737088229b` |
| `crates/fretbloom-analysis/tests/joint_attribution.rs` | `1552b96bcdb3cfb74ef1eeebc1e2077300d9d02e8569ceffb2a7cf70fa380ba5` |

`handoff.json` records source/binary rechecks, exact completed call counts,
failed gates and report hash. `evidence-inventory.json` hashes the retained evidence
excluding dependency/build caches. All raw original scorer reports, mode outputs,
whole recordings, supplemental cases, independent controls, exact frame deltas,
commands/stdout/stderr and matching snapshots remain under the owned evidence root.

Additional exact validation commands were:

```sh
$CARGO test --locked --release -p fretbloom-analysis --lib added_working_allocation_budget -- --ignored --nocapture --test-threads=1
/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustfmt --check --edition 2021 --config skip_children=true crates/fretbloom-analysis/src/{joint_fit,voice_evidence,polyphony,spectrum,lib}.rs crates/fretbloom-analysis/tests/{joint_attribution,musical_repair}.rs
.tools/node-v24.22.2-linux-x64/bin/node scripts/wasm-verify.mjs
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/resources.py
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/resources-extended.py
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/native-windows.py
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/compare.py
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/extra-baselines.py
PYTHONDONTWRITEBYTECODE=1 python3 target/joint-attribution/summarize.py
```

The normal WASM verifier and original resource command fail as documented; they
are not included among passed checks. The model-only build uses the same pinned
RUSTC/RUSTDOC with `CARGO_TARGET_DIR=target/joint-attribution/ablation-build` and
`cargo build --manifest-path target/joint-attribution/model-only-context/Cargo.toml
--locked --release -p fretbloom-analysis --bin analyze-pcm`. Its source delta and
binary are independently inventoried in the model-only snapshot.

**Exclusive implementation ownership is released. No source is moving and no
owned analysis/build process or in-flight write remains. This is a failed,
reviewable candidate; it is not permission to adopt, regenerate or publish it.**
