# Independent phase-only baseline and joint-attribution DEV controls

Musical acceptance remains **failed**. Root’s phase correctness repair produces no changed note frames on the existing DEV corpora versus independently evaluated v3. This is a verified baseline for the next fitter, not an evaluation of the changing builder source. Ownership is released with this report.

## Scope and association

All writes are new `validation/joint-attribution/**` and this new report. No product/core/test/scorer/label/runtime/generated/packaging changes, builds, holdout execution/audio inspection, browser work, production, DB, credentials, commits, push, deployments, child agents or manual QA. Full required review, validation and evidence documents were read, including root’s final phase/latency sections. No builder wait or polling occurred. No coordination message was sent because no steer tool was available.

Frozen native SHA256: `57d8100c0dc11c90330ce74a8d237a811d42141e54e6b5d140da52603f045f53`. All **19** snapshot inventory entries were verified against `target/root-phase-fix/source/`, not shared changing source. The executable was then copied to `validation/joint-attribution/phase-only/analyze-pcm`. Association/checks: `phase-only/association.json`; original snapshot: `phase-only/snapshot.json`. Engine label still says rust-dsp-3 and does not identify the old v3 binary. No rebuild was needed. The generic unchanged runner records a changing-checkout source inventory; that metadata does **not** associate this binary with current source. Only the frozen-source checks do.

Historical comparisons read retained v3 `validation/temporal-candidate/music-v3-complete` and retained d3e0 paths recorded in `comparison.json`. Neither historical detector was rerun. Old v3 WASM `21dea8…` was not used as the phase candidate. Native/WASM parity and tolerance fields: **not applicable, not tested** until a new matched WASM freeze.

## Existing immutable DEV runs

51 synthetic files × all 3 modes = 153 calls; 3 **whole** real DEV recordings in auto; all 12 supplemental DEV files in auto. All **168** runs complete, zero execution/wire/scorer failures. Original scorer functions, original 20ms centers, methods, event tolerances, labels, endings, thresholds, settled exclusions and denominators are unchanged. No result-selected crops. The owned wrapper imports original `validation/candidate/music.py` and redirects only output root/binary. `PYTHONDONTWRITEBYTECODE=1` prevents original scorer cache writes.

All three synthetic score objects are exactly equal to v3 except run_id, including every group/case/stream/route count. All existing-corpus 20ms union-note deltas are zero against v3 in every mode: no gained/lost true notes, no added/removed extras. `frame-deltas.json` retains every changed frame and MIDI count versus d3e0, for every case and mode; `comparison.json` retains every original score.

| Settled auto metric (%) | d3e0 | v3 | Phase only |
| --- | --- | --- | --- |
| mono_exact | 92.03 | 92.13 | 92.13 |
| mono_early_exact | 99.63 | 99.63 | 99.63 |
| poly_midi_exact | 6.65 | 8.94 | 8.94 |
| poly_pc_exact | 87.71 | 87.13 | 87.13 |
| overlap_midi_exact | 0.00 | 0.00 | 0.00 |
| overlap_pc_exact | 22.22 | 22.22 | 22.22 |
| root_accuracy | 87.96 | 88.10 | 88.10 |
| quality_accuracy | 82.55 | 82.05 | 82.05 |
| bass_accuracy | 98.20 | 98.25 | 98.25 |
| chord_root_quality_bass | 81.54 | 81.11 | 81.11 |
| compatible_identity_accuracy | 59.17 | 58.81 | 58.81 |
| ambiguous_abstention | 72.47 | 72.47 | 72.47 |
| negative_false_positive_rate | 0.00 | 0.00 | 0.00 |
| note_precision | 95.24 | 94.36 | 94.36 |
| note_recall | 66.95 | 68.53 | 68.53 |
| note_f1 | 78.63 | 79.40 | 79.40 |
| overlap_note_precision | 83.56 | 85.92 | 85.92 |
| overlap_note_recall | 55.62 | 55.62 | 55.62 |
| overlap_note_f1 | 66.79 | 67.53 | 67.53 |
| boundary_precision | 42.86 | 33.33 | 33.33 |
| boundary_recall | 100.00 | 100.00 | 100.00 |
| boundary_f1 | 60.00 | 50.00 | 50.00 |

Phase TP/FP/FN = **6887/412/3162**, exact MIDI **184/2059**, PC exact **1794/2059**, primary compatible **1138/1935**, boundaries **3/6/0**. Dedicated silence/noise/percussion false frames remain **0/300**, separate from other reference-empty margins **0/1445**. All abstentions remain in denominators, alternatives earn no primary credit.

Frozen gates: MIDI F1 ≥85%, precision/recall ≥80%, mono early/sustain ≥95/90%, PC exact ≥85%, root/quality ≥90%, compatible primary ≥85%, every intended group ≥70%, bass ≥85%, dedicated negatives ≤1%, boundary F1 ≥85%. Exact MIDI 80% remains a diagnostic target. F1, recall, identity/root/quality, several groups and boundaries still fail.

| Mode | Mono P/R/F1 (%) | Poly P/R/F1 (%) | Routing (%) | Wrong stream | Duplicates |
| --- | --- | --- | --- | --- | --- |
| auto | 100.00/87.77/93.49 | 91.13/67.28/77.41 | 97.27 | 22 | 0 |
| monophonic | 100.00/87.77/93.49 | —/—/— | 97.40 | 0 | 0 |
| polyphonic | —/—/— | 92.19/69.17/79.04 | 97.68 | 0 | 0 |

Forced monophonic refusal remains 100%; timed mono TP remains 1012 versus d3e0 1025. Forced-mono union recall on polyphonic truth is not an acceptance substitute.

| Intended group | PC exact (%) | MIDI F1 (%) | Primary compatible (%) |
| --- | --- | --- | --- |
| chord:maj | 73.05 | 70.90 | 73.76 |
| chord:min | 100.00 | 75.65 | 100.00 |
| chord:7 | 97.94 | 87.43 | 97.94 |
| chord:maj7 | 67.03 | 73.49 | 67.03 |
| chord:m7 | 95.05 | 87.55 | 0.00 |
| chord:sus2 | 100.00 | 80.00 | 0.00 |
| chord:sus4 | 100.00 | 81.14 | 0.00 |
| chord:add9 | 100.00 | 86.17 | 100.00 |
| chord:6 | 0.00 | 75.00 | 0.00 |
| chord:m6 | 100.00 | 92.23 | 0.00 |
| chord:dim | 100.00 | 85.71 | 100.00 |
| chord:aug | 100.00 | 84.33 | 0.00 |
| chord:none | 96.77 | 83.05 | — |
| note:none | — | — | — |
| silence:none | — | — | — |
| noise:none | — | — | — |
| percussion:none | — | — | — |
| transition:mixed | 93.10 | 78.22 | 93.10 |

Additional whole-duration 20ms union accounting (not substituted for settled/stream scores):

| Versus | Corpus | Mode | Gained true | Lost true | Added extra | Removed extra |
| --- | --- | --- | --- | --- | --- | --- |
| v3 | synthetic | auto | 0 | 0 | 0 | 0 |
| v3 | synthetic | monophonic | 0 | 0 | 0 | 0 |
| v3 | synthetic | polyphonic | 0 | 0 | 0 | 0 |
| v3 | real | auto | 0 | 0 | 0 | 0 |
| v3 | extended | auto | 0 | 0 | 0 | 0 |
| d3e0 | synthetic | auto | 166 | 33 | 82 | 44 |
| d3e0 | synthetic | monophonic | 0 | 13 | 0 | 0 |
| d3e0 | synthetic | polyphonic | 166 | 33 | 82 | 44 |
| d3e0 | real | auto | 55 | 109 | 181 | 828 |
| d3e0 | extended | auto | 22 | 10 | 36 | 19 |

Relative d3e0 settled changes: +159 true, +76 extra; exact MIDI +47, PC exact −12, compatible primary −7, boundary FP +2. Timed union synthetic +166/−33 true frames and +82/−44 extras include attacks/releases; these differ deliberately from settled counts. Every paired gain/loss is retained.

Additional timed-register TP/FP/FN (full synthetic auto 20ms centers, separate from settled metrics): 28-47 {'fn': 167, 'tp': 2324, 'fp': 6}; 48-59 {'fn': 1556, 'tp': 5015, 'fp': 81}; 60-71 {'fp': 374, 'fn': 2345, 'tp': 1833}; 72-96 {'fp': 327, 'fn': 79, 'tp': 131}. `additional-checks.json` also records exact raw-output hashes versus v3: 168/168 are byte-identical.

## Whole real and supplemental DEV

| Recording | Mono P/R/F1 (%) | Poly P/R/F1 (%) | Empty emitting / frames | Union exact MIDI | Union exact PC | Event onset+offset F1 (%) |
| --- | --- | --- | --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 100.00/29.32/45.35 | 60.04/92.81/72.91 | 113/175 | 416/1178 | 454/1178 | 10.59 |
| 00_SS3-84-Bb_comp | 100.00/30.96/47.28 | 71.31/60.85/65.66 | 74/135 | 372/2151 | 765/2151 | 12.78 |
| 01_Jazz3-150-C_comp | 100.00/26.00/41.28 | 60.44/74.26/66.64 | 232/382 | 224/898 | 233/898 | 29.25 |

All these values equal v3. d3e0 real gain/loss totals are +55/−109 true and +181/−828 extras. Per-recording changed frames/sets are retained, including every added extra and lost true. Room tails/annotation uncertainty are unresolved, not waived. Real stream, routing, bass, chord-quality, onset-only and onset+offset denominators are in the unchanged real report and comparison.

| Supplemental case | TP/FP/FN | Exact MIDI | PC exact | Primary / alternative / abstain |
| --- | --- | --- | --- | --- |
| dev_v1_Amadd9_capo0 | 240/3/60 | 0/60 | 60 | 60/0/0 |
| dev_v1_Amadd9_capo3 | 249/0/51 | 9/60 | 60 | 60/0/0 |
| dev_v1_Cadd11_capo0 | 240/0/60 | 0/60 | 60 | 60/0/0 |
| dev_v1_Cadd11_capo3 | 240/11/60 | 0/60 | 60 | 60/0/0 |
| dev_v1_Amadd11_capo0 | 183/0/117 | 0/60 | 0 | 0/60/60 |
| dev_v1_Amadd11_capo3 | 188/0/112 | 0/60 | 8 | 8/52/52 |
| dev_v1_Bdim7_capo0 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_Bdim7_capo3 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_Bhdim7_capo0 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_Bhdim7_capo3 | 244/0/0 | 61/61 | 61 | 0/61/61 |
| dev_v1_E5_capo0 | 124/0/62 | 0/62 | 62 | 62/0/0 |
| dev_v1_E5_capo3 | 138/22/48 | 14/62 | 62 | 62/0/0 |

All 244 dim/half-dim exact MIDI frames retained; unambiguous-primary denominator is zero. Both capo madd11 remain 0/60 exact. Capo grouping is explicit in case IDs; complete family/register counts remain in comparison and frame deltas.

Fixed whole-output probes (`fixed-probes.json`): C6 .70s `[48,52,57]` vs `[48,52,57,60,67]`; capo0 madd11 .71/1.21 `[45,50,60]` vs `[45,50,57,60,64]`; capo3 `[48,53,63]` vs `[48,53,60,63,67]`; Rock 4.21 `[64,69,83]` vs `[64,69]`; Jazz 3.61 `[45,57,60,64,68]` vs `[57,60,64]`. Missing register/defining tones and extras persist.

Reviewer PCM was read only and executed unchanged: whole .8/1.2/2.08s recovers `[57,69]`; 2.72/3.36/4/4.6s loses 69. Late-window .64/.8/1/1.4/1.8s is `[57]`, loses 69 at all five probes. Exact commands, input/output hashes, stdout/stderr are retained. No previous evidence was regenerated or overwritten.

## Frozen independent controls

20 original CC0 short clips: eight three-to-six voice shared-fifth/octave mixtures with simultaneous/offset onsets, independent gains/decays/releases, half-turn phases; two gain/transposition/quiet-late controls; six bright/tilting/vibrato singleton partners in low/high registers; two tonal-noise levels; two exact-signal-identical source descriptions. Five-voice controls include an actual gap and reattack of the upper source. Explicit notes, source IDs, onset/release/gain/phase/decay and stream rule are in `controls/manifest.json`. These are mathematical additive sources, not real guitars or proof of unique physical recoverability.

Manifest SHA256 `c6572520f78e6ec5f468b4d9875c31cb46ac11e49c2e2fefd2e99b78a85f3ad0`; generator SHA256 `7a6023147d7f73ac37a94dd95a839bc28de7b4e43d2d5b8e0cb347d60ce21236`. Generator, PCM hashes and labels were frozen **before** any detector run; they were not tuned after results. Finite PCM, unclipped amplitude, lengths/timings/truth, exact byte regeneration, hash association and exact ambiguity-pair identity pass in `final-selfcheck.json`. All 60 actual CLI runs (20×3 modes) pass wire validation, with zero execution failures.

All-duration 20ms centers include attacks, release tails, gaps and silence; exact denominators below include empty margins. Expected and observed sets and both streams at **every** center, plus fixed .8/1.1/1.4/1.9/2.2/3/4/4.5s probes where in range, are retained in `control-results/report.json`. “Lost true” is synthesis truth minus observed, not an identifiability claim. No crop was selected from results. Diagnostic event matching is one-to-one same pitch, onset ≤.10s and release ≤.15s; those are supplemental diagnostics, never modified original acceptance gates.

| Control (auto) | TP / extra / lost true | Exact / frames | Wrong stream | Events matched / ref / predicted |
| --- | --- | --- | --- | --- |
| voices3_simultaneous | 214/54/103 | 38/145 | 4 | 2/3/5 |
| voices3_offset_halfturn | 228/70/75 | 53/145 | 7 | 2/3/15 |
| voices4_simultaneous | 244/5/170 | 39/145 | 4 | 2/4/4 |
| voices4_offset_halfturn | 264/34/122 | 52/145 | 7 | 2/4/11 |
| voices5_simultaneous | 231/11/255 | 40/145 | 4 | 2/6/7 |
| voices5_offset_halfturn | 228/4/211 | 49/145 | 7 | 2/6/7 |
| voices6_simultaneous | 227/9/368 | 39/145 | 4 | 2/6/6 |
| voices6_offset_halfturn | 243/6/281 | 54/145 | 5 | 2/6/10 |
| quiet_late_transpose0 | 275/15/266 | 70/260 | 149 | 0/3/23 |
| quiet_late_transpose5 | 317/94/224 | 52/260 | 96 | 0/3/27 |
| single_bright_43 | 109/1/1 | 143/145 | 0 | 1/1/1 |
| single_bright_67 | 110/0/0 | 145/145 | 0 | 1/1/1 |
| single_tilt_43 | 109/1/1 | 143/145 | 0 | 1/1/1 |
| single_tilt_67 | 110/0/0 | 145/145 | 0 | 1/1/1 |
| single_vibrato_43 | 109/1/1 | 143/145 | 0 | 1/1/1 |
| single_vibrato_67 | 110/0/0 | 145/145 | 0 | 1/1/1 |
| tonal_noise_1 | 0/226/0 | 32/145 | 0 | 0/0/2 |
| tonal_noise_0.35 | 0/226/0 | 32/145 | 0 | 0/0/2 |
| ambiguity_two_sources | 109/114/111 | 34/145 | 24 | 0/2/7 |
| ambiguity_one_harmonic_source | 109/114/1 | 58/145 | 85 | 0/1/7 |

The two ambiguity descriptions have **identical PCM**: one arbitrary harmonic source or two octave-related sources. Their different synthesis source-score denominators are shown transparently but excluded from unique-source aggregates. At 1.1s both emit `[43,62]`, while admissible note explanations are `[43]` or `[43,55]`; 62 is extra under either explanation. Tonal noise has no performed-note truth but contains actual narrowband pitch evidence (auto `[54,63]` at 1.1s). Its 226 emitted note-frames per level are an abstention diagnostic, not proof a detector can uniquely infer nonmusical intent. These four ambiguity cases are separate from 16 source-truth controls.

auto, 16 source-truth controls: `{'tp': 3128, 'extra': 305, 'lost_true': 2078, 'exact': 1350, 'frames': 2550, 'duplicates': 0, 'wrong_stream': 287}`; event counts `{'reference': 50, 'predicted': 121, 'matched': 22}`. Forced mono is expected to refuse multi-voice input; its missing-poly-source count is not its own failure gate.

monophonic, 16 source-truth controls: `{'tp': 942, 'extra': 4, 'lost_true': 4264, 'exact': 1253, 'frames': 2550, 'duplicates': 0, 'wrong_stream': 239}`; event counts `{'reference': 50, 'predicted': 27, 'matched': 6}`. Forced mono is expected to refuse multi-voice input; its missing-poly-source count is not its own failure gate.

polyphonic, 16 source-truth controls: `{'tp': 3128, 'extra': 305, 'lost_true': 2078, 'exact': 1350, 'frames': 2550, 'duplicates': 0, 'wrong_stream': 0}`; event counts `{'reference': 50, 'predicted': 87, 'matched': 24}`. Forced mono is expected to refuse multi-voice input; its missing-poly-source count is not its own failure gate.

Actionable 1.1s cells, fixed before evaluation:

| Control | Expected | Observed |
| --- | --- | --- |
| voices3_simultaneous | [43, 50, 55] | [43, 50, 62] |
| voices3_offset_halfturn | [43, 50, 55] | [43, 50, 62, 67] |
| voices4_simultaneous | [46, 53, 58, 65] | [46, 53, 65] |
| voices4_offset_halfturn | [46, 53, 58, 65] | [46, 53] |
| voices5_simultaneous | [41, 48, 53, 60, 65] | [41, 48] |
| voices5_offset_halfturn | [41, 48, 53, 60, 65] | [41, 48] |
| voices6_simultaneous | [42, 49, 54, 61, 66, 73] | [42, 49, 61] |
| voices6_offset_halfturn | [42, 49, 54, 61, 66, 73] | [42, 49] |
| quiet_late_transpose0 | [44, 56, 63] | [44, 63] |
| quiet_late_transpose5 | [49, 61, 68] | [49] |
| single_bright_43 | [43] | [43] |
| single_bright_67 | [67] | [67] |
| single_tilt_43 | [43] | [43] |
| single_tilt_67 | [67] | [67] |
| single_vibrato_43 | [43] | [43] |
| single_vibrato_67 | [67] | [67] |

The multi-voice controls show the same pattern across transpositions: low voices survive while shared upper sources disappear or aliases appear. Quiet-late controls also fragment events and route continuing mixtures to mono. These paired singleton controls mostly retain their exact pitch, so blanket admission relaxation risks sacrificing rejection without fixing decomposition. Retain gaps/reattacks and separately score upper-source continuation rather than accepting rolling/full agreement. Do not hard-code these voicings or assert that source truth is universally identifiable from stationary late crops.

## Reproduction, limitations and handoff

Run from repo root; all paths below are owned. Initial commands were:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/joint-attribution/evaluate.py > validation/joint-attribution/evaluation.stdout 2> validation/joint-attribution/evaluation.stderr
PYTHONDONTWRITEBYTECODE=1 python3 validation/joint-attribution/generate.py build > validation/joint-attribution/controls-selfcheck.json
PYTHONDONTWRITEBYTECODE=1 python3 validation/joint-attribution/controls.py > validation/joint-attribution/control-evaluation.stdout 2> validation/joint-attribution/control-evaluation.stderr
PYTHONDONTWRITEBYTECODE=1 python3 validation/joint-attribution/compare.py > validation/joint-attribution/comparison.stdout 2> validation/joint-attribution/comparison.stderr
PYTHONDONTWRITEBYTECODE=1 python3 validation/joint-attribution/selfcheck.py > validation/joint-attribution/final-selfcheck.json 2> validation/joint-attribution/selfcheck.stderr
```

Creation runners intentionally refuse existing output directories. To verify the retained freeze, use `generate.py` with no arguments and `selfcheck.py`; do not delete/overwrite evidence. Original per-run metadata retains CLI/decode commands, errors and diagnostics; own evidence inventory hashes every input/output/log/script including decoded PCM. `comparison.json` includes baseline paths; `frame-deltas.json` includes every changed time/expected/old/new note set, all MIDI gains/losses and extras. Source snapshot hashes are authoritative; changing shared-checkout metadata is incidental. No normal whole-app tests were run against mismatched artifacts.

No new browser or latency measurement is claimed. Original targets are p95 window **compute ≤500ms**, p95 event **delay ≤1.5s**. Prior v3 compute 190.3ms / DOM estimate 560.7ms pass their respective original bounds, subject to original measurement limitations. The historical report’s 500ms DOM gate is invalid and is not repeated as a failure here.

Root must launch a **new independent post-freeze** evaluation of the replacement fitter and regenerated matching WASM. This report establishes only the phase-only red baseline and supplemental DEV controls, and grants no musical acceptance. No manual user QA is needed. Ownership released; no owned processes remain.
