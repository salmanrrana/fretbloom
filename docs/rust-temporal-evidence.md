# Temporal evidence DSP repair — 2026-10-31

This delivers both connected core packages, with integrated tests and DEV/resource
measurements. **It does not meet the musical acceptance gates, and C6 plus both
madd11 takes remain incomplete.** Root owns adoption,
new actual WASM testing, browser budgets and any future holdout authorization.
No production, deployment, commit, push, holdout detector run, public schema,
options, CLI, chord vocabulary, manifest, lock, corpus, labels or scorer changes.

## Implementation and limits

A 24-hop history tracks MIDI 28–96 and at most eight measured partials per
candidate. A shared 1024-point FFT measures complex trajectories at frequencies
already anchored by the 4096-point spectrum. It does not propose low pitches
from a short FFT. Nine-bin Dirichlet interpolation and four bounded leakage
reassignment passes avoid one transform per candidate. The original long spectrum
still supplies pitch fundamentals, prominence and fit admission.

120/240/360/420 ms comparisons use the lower voice's less-shared partials;
previously established voices exclude contaminated partials from its envelope
estimate. A smooth damping term prevents every darkening string becoming an
octave. Phase advance is predicted from a preceding 60 ms baseline, with stable
frequency and amplitude checks; using the interpolated FFT frequency alone
creates systematic phase error, while fitting the current endpoint absorbs
exactly the change under test. The largest phase baseline fits within 480 ms.
Sparse lower-comb contamination can use measured frequency/phase change.

Temporal admission requires an actual active carrier, measured fundamental and
multi-partial innovation, consistent residual shape, and six-hop predictive
confirmation (120 ms of support; 100 ms from first to sixth center). This replaces three overlapping-window votes for shared attribution.
High aliases need phase corroboration rather than extrapolated damping alone.
Innovation energy pays the existing complexity gate. Admission reopens shared
peak ownership and jointly refits all active nonnegative amplitudes. Zero
innovation receives no minimum allocation. The same evidence constrains YIN's
mono collapse. Six voices and twenty refit passes remain; no chord fills notes.

Current-pitch continuation uses cached targeted Hann projections of up to four
partials, over 40–120 ms for low-note support. A central 20 ms projection tests
presence only, never low-frequency resolution. Predictable neighboring-peak
leakage is removed. A weak measured fundamental can use two continuing partials.
Confirmed, uncertain and absent are separate states: a current band can bridge
at most 40 ms phase uncertainty; demonstrated absence never bridges. Its private
mask prevents median resurrection. Bass must pass its own current support.
Physical confirmation precedes mutually exclusive stream routing. No historical
attack-raised noise floor or replacement global loudness cutoff was added.

There is no cross-call phase or ancient-onset state. Cropped-window and seam
controls cover continuing independent decay; they do not prove unique voice
counts for stationary co-onset harmonic sums, or indefinite recovery once an
upper fundamental's independent change falls below measurable support. A
singleton with changing harmonic coefficients can be signal-identical to several
sources. The ambiguity control constructs both representations; it does not
assert a uniquely recoverable physical string count.

Feature pooling, frame count, timestamps, rounding, endpoints and schema remain
unchanged. Chroma/MIDI **values** change with the repaired note estimates. This
work does not hide or fix root's JS aggregate-frame budget issue across segments.
The 2.56 s live window, 0.64 s hop/warmup and 0.32 s reserve are unchanged.

## Final freeze and reproduction

Native `72583af9dcd8ef1cd7fbe81280ba1de181c4c25aed0f2bdcfd4ce55424c977f0`. Engine `rust-dsp-3`, schema 1.
Canonical WASM source input hash `693181a3abec04e8320f8243a5245fa646d50e7af55d2e4bbe64f2dfdc04126f`.
Native source/test inventory hash `32a38a19f9a5fda370718fc25170bcd66efe2f25a9a7e234783a357e3805af3c`.
Cargo.lock remains `4cf9ea7903f854b54c1eb312c6f0ad828b2a3234015da44afb619c2687bae953`.
Final executable: `target/temporal-evidence/delivery-final/analyze-pcm`; matching source copies and hashes: adjacent `source/` and `snapshot.json`. These attest the successful shared-checkout build and inventory, not an independent clean-room rebuild. Generated WASM was neither rebuilt nor bypassed.

| Owned source/test file | SHA256 |
| --- | --- |
| crates/fretbloom-analysis/src/spectrum.rs | 0fdae93290826aedc4e728755bc2d71be6d34aa9c788087e47418f858556fdf6 |
| crates/fretbloom-analysis/src/polyphony.rs | 3b38d2b914c02030498a0fe14dbfd9329ec92037858ed5c2e3b06f74713519b8 |
| crates/fretbloom-analysis/src/lib.rs | 8c17d4f83aa8d40f6c31ff7a7c807fdedb669d48b84e52e21e6f35d1070d66f8 |
| crates/fretbloom-analysis/src/segments.rs | 2c1a622a67278b8d5696ff709e06a4b837e348c17f140a12f3ff01574ec8f6d1 |
| crates/fretbloom-analysis/src/voice_evidence.rs | 2bd9cd41b3f692813204b30db73e7f2250fd18e7c582e2fcd9e2054a9ec5a759 |
| crates/fretbloom-analysis/tests/musical_repair.rs | 9202fb4faad35ff78cb34bd40caeef001e73b7a2afd5fe1913a6235b28592321 |

The seventh owned file is this new report. Existing `dsp_reliability.rs`, other tests and nonowned core files retain their source-associated baseline bytes; see final `handoff.json` for the complete preservation check.

All large evidence is ignored under `target/temporal-evidence/`. `freeze.py`,
`evaluate.py`, `ablation-confirmed.py`, `compare.py`, `audit.py`, `diagnose.py` and
`resources.py` retain/reproduce commands, raw errors, PCM and outputs. The real
runner verifies/decodes DEV sources only and invokes the unchanged scorer.
No result-selected crops or changed reference endings were scored.

```sh
export RUSTC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustc
export RUSTDOC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustdoc
CARGO=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/cargo
$CARGO test --locked --release -p fretbloom-analysis --tests --no-fail-fast
$CARGO test --locked --release -p fretbloom-analysis --lib added_working_allocation_budget -- --ignored --nocapture --test-threads=1
$CARGO clippy --locked -p fretbloom-analysis --all-targets -- -D warnings
$CARGO fmt --check -p fretbloom-analysis
$CARGO build --locked --release -p fretbloom-analysis --bin analyze-pcm
python3 target/temporal-evidence/evaluate.py <NEW copied candidate directory>
python3 target/temporal-evidence/diagnose.py
python3 target/temporal-evidence/resources.py
```

The final release suite has 37 passing functional tests; two diagnostic/allocation
tests are explicitly ignored by the ordinary run and exercised separately.
Controls include the exact red probe and singleton partner; root/gain/phase/onset/
decay variants; aligned fifth/+19/three-source mixtures; existing independently
detuned/adjacent controls; 20-partial brightness, tilt, vibrato and inharmonicity;
reattacks, actual gaps and unrelated-note releases; white/colored/tonal background,
percussion and sparse impulses; loud-attack quiet decays at several gains;
short buffers, endpoints, stream changes, mono refusal and duplicate exclusion.
Additional tests measure center phase/amplitude and reject FFT-frequency bias as
independent phase change. They do not establish full musical acceptance.

## Predeclared ablation and all DEV execution

The final matching package-1 ablation is `ablation-confirmed/`; it changes only
the private current-support decision to confirmed, keeping the same temporal
fitter/settings. Package 2 therefore includes its feedback into later tracking.
Each final candidate ran all 51 synthetic DEV files in all three modes, all three
whole real DEV recordings and all twelve supplemental inputs, with zero execution,
wire or scorer failures. Raw scores, stdout/stderr and binary hashes are retained.

- `ablation-confirmed`: synthetic `target/temporal-evidence/ablation-confirmed/synthetic/rust-dev/20261031T155308.006350Z-4d223df1`, real `target/temporal-evidence/ablation-confirmed/real`, supplemental `target/temporal-evidence/ablation-confirmed/extended/20261031T155308Z-17nm731u`.
- `delivery-final`: synthetic `target/temporal-evidence/delivery-final/synthetic/rust-dev/20261031T155309.175931Z-8698931e`, real `target/temporal-evidence/delivery-final/real`, supplemental `target/temporal-evidence/delivery-final/extended/20261031T155309Z-lrflm_s7`.

Earlier iterations and rejected tests remain under the same evidence root. `both-phase-rejected/snapshot.json` explicitly flags its copied binary/source inventory mismatch after a source revert: it is rejected exploratory evidence, **not** source association or acceptance evidence. Final snapshots were copied after their matching builds, before further source mutation. No threshold grid/search or label/fixture tuning was used.

## Synthetic DEV — settled auto

| Measure % | Earlier d933 | Baseline d3e0 | Package 1 | Both |
| --- | --- | --- | --- | --- |
| Mono early exact | 97.43 | 99.63 | 99.63 | 99.63 |
| Mono sustained exact | 90.52 | 92.03 | 92.03 | 92.13 |
| Exact MIDI sets | 15.88 | 6.65 | 8.89 | 8.94 |
| Exact pitch-class sets | 81.98 | 87.71 | 87.03 | 87.13 |
| MIDI precision | 80.41 | 95.24 | 94.33 | 94.36 |
| MIDI recall | 82.14 | 66.95 | 68.53 | 68.53 |
| MIDI F1 | 81.26 | 78.63 | 79.39 | 79.40 |
| Unambiguous root | 80.39 | 87.96 | 87.96 | 88.10 |
| Unambiguous quality | 73.47 | 82.55 | 81.90 | 82.05 |
| Compatible primary | 52.66 | 59.17 | 58.71 | 58.81 |
| Bass | 96.60 | 98.20 | 98.20 | 98.25 |
| Harmonic boundary F1 | 54.55 | 60.00 | 50.00 | 50.00 |
| Overlap note F1 | 47.73 | 66.79 | 67.15 | 67.53 |
| Empty-reference false positives | 2.46 | 0.00 | 0.00 | 0.00 |

| Counts | d3e0 | Package 1 | Both |
| --- | --- | --- | --- |
| note_tp | 6728 | 6887 | 6887 |
| note_fp | 336 | 414 | 412 |
| note_fn | 3321 | 3162 | 3162 |
| poly_exact | 137 | 183 | 184 |
| poly_total | 2059 | 2059 | 2059 |
| pc_exact | 1806 | 1792 | 1794 |
| compatible_correct | 1145 | 1136 | 1138 |
| compatible_total | 1935 | 1935 | 1935 |
| boundary_tp | 3 | 3 | 3 |
| boundary_fp | 4 | 6 | 6 |
| boundary_fn | 0 | 0 | 0 |
| negative_false | 0 | 0 | 0 |
| negative_total | 1745 | 1745 | 1745 |

Gates stay MIDI F1 ≥85%, P/R ≥80%, PC exact ≥85%, MIDI exact diagnostic target 80%, mono early/sustain ≥95/90%, root/quality ≥90%, compatible primary ≥85%, each intended group ≥70%, bass ≥85%, dedicated negatives ≤1%, boundary F1 ≥85%. Recall, register sets, harmony and transitions remain unacceptable. Abstentions remain in every original denominator; alternatives do not receive primary credit.

Dedicated silence/noise/percussion negatives emit zero false-positive frames out of 300; the other 1445 scored reference-empty margins also remain zero. Relative to d3e0, settled TP rises by 159 and FP by 76. Exact MIDI gains 47 frames, while PC-exact loses 12, compatible-primary loses 7 and extra harmonic boundaries rise from 4 to 6. Timed mono TP falls 1025→1012 even though the early/sustained exact metrics pass. These are material regressions, not hidden by the union gain.

### Streams and routing

| Mode/stream | d3e0 P/R/F1 % | Both P/R/F1 % | Both TP/FP/FN |
| --- | --- | --- | --- |
| auto/monophonic | 100.00/88.90/94.12 | 100.00/87.77/93.49 | 1012/0/141 |
| auto/polyphonic | 91.24/66.00/76.59 | 91.13/67.28/77.41 | 8274/805/4023 |
| monophonic/monophonic | 100.00/88.90/94.12 | 100.00/87.77/93.49 | 1012/0/141 |
| polyphonic/polyphonic | 92.44/68.18/78.48 | 92.19/69.17/79.04 | 9303/788/4147 |

auto: routing 97.27%; multi-voice refusal —%; cross-stream duplicate frames 0; wrong-stream frames 22.
monophonic: routing 97.40%; multi-voice refusal 100.00%; cross-stream duplicate frames 0; wrong-stream frames 0.
polyphonic: routing 97.68%; multi-voice refusal —%; cross-stream duplicate frames 0; wrong-stream frames 0.

| Intended group | d3e0 PC/MIDI F1/primary % | Both PC/MIDI F1/primary % |
| --- | --- | --- |
| chord:maj | 73.05/68.46/73.76 | 73.05/70.90/73.76 |
| chord:min | 100.00/75.65/100.00 | 100.00/75.65/100.00 |
| chord:7 | 97.94/87.59/97.94 | 97.94/87.43/97.94 |
| chord:maj7 | 67.03/73.49/67.03 | 67.03/73.49/67.03 |
| chord:m7 | 97.80/88.19/0.00 | 95.05/87.55/0.00 |
| chord:sus2 | 100.00/80.00/0.00 | 100.00/80.00/0.00 |
| chord:sus4 | 100.00/80.00/0.00 | 100.00/81.14/0.00 |
| chord:add9 | 100.00/87.41/100.00 | 100.00/86.17/100.00 |
| chord:6 | 0.00/75.00/0.00 | 0.00/75.00/0.00 |
| chord:m6 | 100.00/88.89/0.00 | 100.00/92.23/0.00 |
| chord:dim | 100.00/85.71/100.00 | 100.00/85.71/100.00 |
| chord:aug | 100.00/85.71/0.00 | 100.00/84.33/0.00 |
| chord:none | 96.77/83.05/— | 96.77/83.05/— |
| note:none | —/—/— | —/—/— |
| silence:none | —/—/— | —/—/— |
| noise:none | —/—/— | —/—/— |
| percussion:none | —/—/— | —/—/— |
| transition:mixed | 97.13/75.21/97.13 | 93.10/78.22/93.10 |

Timed register diagnostics include attacks/releases and are separate from the settled scores above.

| MIDI band | TP/FP/FN | P/R/F1 % |
| --- | --- | --- |
| 28-47 | 2324/6/167 | 99.74/93.30/96.41 |
| 48-59 | 5015/81/1556 | 98.41/76.32/85.97 |
| 60-71 | 1833/374/2345 | 83.05/43.87/57.42 |
| 72-96 | 131/327/79 | 28.60/62.38/39.22 |

All changed cases, including every true-note loss and new extra by MIDI, are preserved in `additional-audit.json`. Selected existing DEV register gains below include the paired losses rather than reporting output volume as success.

| Existing DEV case | Gained true MIDI:frame counts | Lost true MIDI:frame counts |
| --- | --- | --- |
| dev_chord_00_C | {'60': 22} | {'60': 1} |
| dev_chord_04_E | {'64': 6} | {} |
| dev_chord_19_Asus4 | {'57': 17} | {} |
| dev_chord_24_Am6 | {'57': 17} | {'45': 1} |
| dev_chord_28_D_over_Fsharp | {'62': 43, '66': 3} | {} |
| dev_transitions | {'62': 33, '67': 16, '55': 9} | {'52': 1, '50': 1, '67': 1} |

| Note / MIDI | Early exact baseline→both | Sustained exact baseline→both | Timed mono TP/FP/FN baseline→both |
| --- | --- | --- | --- |
| dev_note_00 / 40 | 17→17/17 | 58→58/58 | 67/0/3→67/0/3 |
| dev_note_01 / 41 | 17→17/17 | 58→58/58 | 68/0/2→68/0/2 |
| dev_note_02 / 47 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_03 / 45 | 17→17/17 | 58→58/58 | 69/0/1→69/0/1 |
| dev_note_04 / 48 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_05 / 50 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_06 / 54 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_07 / 55 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_08 / 60 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_09 / 59 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_10 / 67 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_11 / 64 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_12 / 69 | 17→17/17 | 58→58/58 | 68/0/2→67/0/3 |
| dev_note_13 / 76 | 17→17/17 | 58→58/58 | 70/0/0→69/0/1 |
| dev_note_14 / 81 | 17→17/17 | 26→27/58 | 33/0/37→32/0/38 |
| dev_note_15 / 84 | 16→16/17 | 16→16/58 | 20/0/50→19/0/51 |

## Supplemental DEV — exact notes, PCs and identity remain separate

| Case | TP/FP/FN | MIDI exact baseline→both | PC exact | Primary | Alternative | Abstained |
| --- | --- | --- | --- | --- | --- | --- |
| Amadd9_capo0 | 240/3/60 | 0→0/60 | 60 | 60 | 0 | 0 |
| Amadd9_capo3 | 249/0/51 | 0→9/60 | 60 | 60 | 0 | 0 |
| Cadd11_capo0 | 240/0/60 | 0→0/60 | 60 | 60 | 0 | 0 |
| Cadd11_capo3 | 240/11/60 | 0→0/60 | 60 | 60 | 0 | 0 |
| Amadd11_capo0 | 183/0/117 | 0→0/60 | 0 | 0 | 60 | 60 |
| Amadd11_capo3 | 188/0/112 | 0→0/60 | 8 | 8 | 52 | 52 |
| Bdim7_capo0 | 244/0/0 | 61→61/61 | 61 | 0 | 61 | 61 |
| Bdim7_capo3 | 244/0/0 | 61→61/61 | 61 | 0 | 61 | 61 |
| Bhdim7_capo0 | 244/0/0 | 61→61/61 | 61 | 0 | 61 | 61 |
| Bhdim7_capo3 | 244/0/0 | 61→61/61 | 61 | 0 | 61 | 61 |
| E5_capo0 | 124/0/62 | 0→0/62 | 62 | 62 | 0 | 0 |
| E5_capo3 | 138/22/48 | 14→14/62 | 62 | 62 | 0 | 0 |

All 244 dim/half-dim settled frames retain exact MIDI sets, no extras, honest equivalent alternatives and abstention. Their unambiguous-primary denominator is zero. This preserves note/uncertainty behavior, not primary-identity accuracy.

## Whole-recording real DEV

| Recording | Mono P/R/F1 % | Poly P/R/F1 % | Empty-reference emitting frames | Poly emissions on mono-reference frames |
| --- | --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 100.00/29.32/45.35 | 60.04/92.81/72.91 | 125→113/175 | 1602→1450 |
| 00_SS3-84-Bb_comp | 100.00/30.96/47.28 | 71.31/60.85/65.66 | 86→74/135 | 606→520 |
| 01_Jazz3-150-C_comp | 100.00/26.00/41.28 | 60.44/74.26/66.64 | 252→232/382 | 686→576 |

| Recording | Union P/R/F1 % | Exact MIDI nonempty | Exact PC nonempty | Removed/gained true | Removed/added extra |
| --- | --- | --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 47.33/92.73/62.67 | 416/1178 | 454/1178 | 16/0 | 249/42 |
| 00_SS3-84-Bb_comp | 67.15/64.60/65.85 | 372/2151 | 765/2151 | 47/55 | 313/139 |
| 01_Jazz3-150-C_comp | 45.77/75.14/56.89 | 224/898 | 233/898 | 46/0 | 266/0 |

| Recording | Baseline mono P/R/F1 % | Baseline poly P/R/F1 % | Bass baseline→both |
| --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 100.00/28.29/44.11 | 59.13/93.58/72.47 | 238→240/1178 |
| 00_SS3-84-Bb_comp | 98.21/30.14/46.12 | 70.39/60.41/65.02 | 641→615/2151 |
| 01_Jazz3-150-C_comp | 100.00/25.79/41.01 | 58.29/76.85/66.30 | 146→142/898 |

The second table is additional union accounting on the same fixed 20 ms centers, not a replacement for the required stream scores. Removed true-note frames are losses even when empty-reference counts improve. Annotation uncertainty, MIC room tails and pickup endings are separate unresolved acoustic-adjudication questions; they do not waive these disagreements.

| Recording | Bass correct/frames | Poly onset+offset TP/pred/ref | Event F1 % | Mono on poly frames | Duplicates | Performed quality % |
| --- | --- | --- | --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 240/1178 | 28/401/128 | 10.59 | 3 | 0 | 0.00 |
| 00_SS3-84-Bb_comp | 615/2151 | 48/567/184 | 12.78 | 171 | 0 | 16.19 |
| 01_Jazz3-150-C_comp | 142/898 | 80/402/145 | 29.25 | 4 | 0 | 2.14 |

## Fixed review counterexamples and measured tracks

C6 at .70 s: `[48, 52, 57]`, expected `[48,52,57,60,67]`. Missing G4 is a missing PC, separate from C6/Am7 naming; missing C4 is a register miss.
Amadd11 capo 0 at .45/.71/1.21 s: `[45, 50, 57, 60]` / `[45, 50, 60]` / `[45, 50, 60]`. Defining tone is MIDI 64; exact/primary settled outcomes remain those in the table above.
Amadd11 capo 3 at .45/.71/1.21 s: `[48, 53, 63]` / `[48, 53, 63]` / `[48, 53, 63]`. Defining tone is MIDI 67; exact/primary settled outcomes remain those in the table above.
00_Rock2-142-D_solo at 4.21: `[64, 69, 83]`. Rock target `[64,69]`; Jazz true pitches `[57,60,64]` and reviewed extras `[45,68]` are assessed separately. Retaining a target plus extras is not an exact set.
01_Jazz3-150-C_comp at 3.61: `[45, 57, 60, 64, 68]`. Rock target `[64,69]`; Jazz true pitches `[57,60,64]` and reviewed extras `[45,68]` are assessed separately. Retaining a target plus extras is not an exact set.
Exact review PCM lower_only: 0.4: [57]; 0.8: [57]; 1.2: [57]; 1.7: [57].
Exact review PCM delayed_octave: 0.4: [57]; 0.8: [57, 69]; 1.2: [57, 69]; 1.7: [57].
Carrier `0` in the trace table means no qualified carrier was established; it is never an emitted pitch.

`*.tracks.json` retain measured fundamental/partial amplitudes, phase, prominence, carrier, innovations and prior samples at the fixed review cells. Diagnostics process whole recordings with A440/zero tuning and preceding fits; raw production outputs use the actual estimated tuning/routing. They are trace explanations, not new scoring windows. A zero admission strength despite measured peaks means the bounded model did not establish independent change; it does not establish physical inaudibility or an erroneous reference.
Measured C6 tracks:

| Center s | MIDI | Strength | Carrier | First four amplitudes | Prominent matches |
| --- | --- | --- | --- | --- | --- |
| 0.45 | 60 | 0.0 | 0 | 0.04279/0.01004/0.04082/0.02341 | 8 |
| 0.45 | 67 | 0.0 | 0 | 0.02379/0.04082/0.00642/0.01807 | 8 |
| 0.71 | 60 | 0.0 | 0 | 0.04297/0.00825/0.01744/0.01790 | 7 |
| 0.71 | 67 | 0.0 | 0 | 0.01630/0.01744/0.00389/0.00259 | 5 |
| 1.21 | 60 | 0.0 | 0 | 0.04095/0.00651/0.00997/0.00775 | 5 |
| 1.21 | 67 | 0.0 | 0 | 0.01271/0.00997/0.00136/0.00000 | 3 |

Measured Amadd11_capo0 tracks:

| Center s | MIDI | Strength | Carrier | First four amplitudes | Prominent matches |
| --- | --- | --- | --- | --- | --- |
| 0.45 | 57 | 0.0 | 45 | 0.02295/0.04799/0.02105/0.01499 | 8 |
| 0.45 | 64 | 0.0 | 45 | 0.02298/0.02105/0.01035/0.02019 | 8 |
| 0.71 | 57 | 0.0 | 45 | 0.02096/0.03458/0.01050/0.01247 | 8 |
| 0.71 | 64 | 0.0 | 45 | 0.01916/0.01050/0.00897/0.00809 | 7 |
| 1.21 | 57 | 0.0 | 45 | 0.01707/0.01848/0.00520/0.00521 | 8 |
| 1.21 | 64 | 0.0 | 45 | 0.01486/0.00520/0.00366/0.00056 | 4 |

Measured Amadd11_capo3 tracks:

| Center s | MIDI | Strength | Carrier | First four amplitudes | Prominent matches |
| --- | --- | --- | --- | --- | --- |
| 0.45 | 60 | 0.0 | 0 | 0.02854/0.06763/0.05379/0.03586 | 8 |
| 0.45 | 67 | 0.0 | 48 | 0.04030/0.05379/0.01655/0.00794 | 8 |
| 0.71 | 60 | 0.0 | 48 | 0.02489/0.04474/0.00968/0.03502 | 8 |
| 0.71 | 67 | 1.0 | 48 | 0.02791/0.00968/0.00267/0.00238 | 6 |
| 1.21 | 60 | 0.0 | 48 | 0.01895/0.01312/0.00615/0.00201 | 7 |
| 1.21 | 67 | 5.0 | 48 | 0.00768/0.00615/0.00122/0.00039 | 4 |

At .71 s, the sampled .36 s carrier comparison explains a concrete remaining miss. C6→C4 uses lower-partial amplitude ratios h1=.910, h3=.585, h7=.581 (relative spread .187); C6→G4 gives spread .170 over five eligible partials. Both exceed the .10 common-envelope gate and have more than two disagreeing partials, so the sparse-contamination exception is unavailable. The measured C4 fundamental is .04297 versus carrier C3 .0495: this is not a missing spectral peak or merely a louder cutoff. For Amadd11 capo0→E4 the example ratios are .912/.873/.552 (spread .138), also not a common envelope. These samples use measured active-fundamental proxies for shared-peak exclusion; raw preceding fits use fitted cents. The complete trace/production outputs remain authoritative. Capo3's corresponding G4 carrier spread is .097, but its sampled admission strength is only 1 at .71 and 5 at 1.21, below six-hop confirmation. It reaches confirmation elsewhere on only 8/60 settled frames.

The delivered model still cannot disentangle several nearly simultaneous, differently damped strings from shared peaks when its carrier envelope itself remains contaminated. Tightening confirmation restores the dim/half-dim controls and limits transient aliases, at a real register-recall cost. C6, sustained capo0 E4/A3 and most capo3 G4/C4 are unresolved implementation limitations. They are not proofs of inaudibility, incorrect labels or equivalent chord naming.

## Resources and cancellation

Linux x86_64, Intel Core i7-1165G7 @2.80 GHz (8 logical CPUs), explicit Rust 1.89.0 release. Resource probes run after DEV/diagnostic processes finish. The unchanged four-voice development waveform and resource script are used with the frozen final executable, not a different build.

| Seconds | Wall s | User s | RSS KiB | Features | Poly events | Harmony events | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | 0.56 | 0.55 | 9624 | 375 | 24 | 17 | 0 |
| 600 | 10.89 | 10.75 | 115492 | 7500 | 450 | 302 | 0 |

SIGINT: exit 130, 0.005223 s, published destination False. Malformed raw length and NaN checks returned invalid-input without output. All limits remain unchanged.
`allocation-budget.log` measures 520,776 bytes high-water for new history/FFT/scratch (1,817,380 cumulative requested bytes over 24 hops). Adding the actual pinned Frame layout delta (104→128 bytes ×30,000 hops ×two simultaneous frame vectors =1,440,000 bytes), 8,832 bytes for added peak phases and 49,152 bytes conservative stack allowance gives **2,018,760 bytes**, below 2 MiB. This is requested application allocation plus stated layout/stack accounting, not allocator internals or total process memory.

`allocation-budget.log` records actual requested-allocation high-water for the new history, FFT plan and maximum-size 552-peak scratch, plus pinned frame-layout deltas, peak phases and conservative stack allowance. It is separate from RSS and lifetime allocation traffic. Ordinary source allocators are unchanged; the meter is test-only. No 600 s spectrogram is retained. Native RSS does **not** prove WASM linear-memory, application JS or browser-process budgets. Root must regenerate actual WASM and measure ≤128 MiB linear memory, live p95 ≤500 ms and refinement ≤120 s; no claim of those passes follows this native work.

## Every changed synthetic case versus d3e0

This compact inventory includes every changed TP/FP/FN, PC/primary count or extra boundary. Complete mode/group/case objects and the earlier d933 comparison are in `comparison.json`; raw scorer reports remain at the frozen run paths.

| Case | Changed old→new counts |
| --- | --- |
| dev_chord_00_C | note_tp: 183→205; note_fp: 0→3; note_fn: 122→100 |
| dev_chord_04_E | note_tp: 201→207; note_fp: 44→43; note_fn: 159→153 |
| dev_chord_08_A7 | note_fp: 0→4 |
| dev_chord_15_Am7 | note_fp: 0→12; pc_exact: 61→56 |
| dev_chord_19_Asus4 | note_tp: 183→200; note_fp: 0→12; note_fn: 122→105 |
| dev_chord_22_Cadd9 | note_fp: 8→16 |
| dev_chord_24_Am6 | note_tp: 244→261; note_fn: 61→44 |
| dev_chord_26_Caug | note_fp: 0→7 |
| dev_chord_28_D_over_Fsharp | note_tp: 176→218; note_fn: 184→142 |
| dev_transitions | note_tp: 534→589; note_fp: 6→37; note_fn: 346→291; pc_exact: 169→162; compatible_correct: 169→162; boundary_fp: 4→6 |

Ownership is released after this report and final `handoff.json`. The delivered repairs and failures are reviewable; this is not a declaration of guitar-transcription, full-band, release-timing or overall musical acceptance.
