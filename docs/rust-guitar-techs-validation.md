# Frozen Guitar-TECHS DEV recognition validation

**Completed: 14 frozen DEV takes, paired DI/mic, ~591 MB downloaded, 56 actual calls.** Basic Pitch completed 28/28 observations; Rust completed 25/28. On the **12 matched completed pairs only**, unshifted union F1 is Rust **86.91%** vs Basic Pitch **86.43%**, exact MIDI **62.89% vs 48.49%**, onset F1 **32.75% vs 57.19%**, onset+offset F1 **23.16% vs 39.69%**. These are annotation-agreement diagnostics, not an all-scope pass or a confidence interval. Rust has no complete all-scope aggregate because three full-take calls failed.

**Decision implication:** this set does not support replacing Rust wholesale with frozen Basic Pitch. It independently exposes sustained extra/octave notes, incomplete exact voicings and capture sensitivity, while Basic Pitch improves event agreement on the completed common scope. Rust also has reproducible full-input event-cap failures that cannot be hidden by favorable crops. Better note-event stability and independently adjudicated label timing are needed before another adoption decision; neither candidate is integrated or approved here.

This is new DEV annotation-agreement evidence, not an acceptance holdout and not permission to integrate either engine. The previous adoption failures and thresholds remain in force. No original holdout, old corpus, app, model, threshold, decoder or scorer was changed or rerun.

## Source and frozen scope

[Attribution and paper citation](../validation/guitar-techs/ATTRIBUTION.md). [Official project](https://guitar-techs.github.io/) explicitly licenses data CC BY 4.0. [Zenodo v1](https://zenodo.org/records/14963133) published 2025-04-06, created 2025-03-17; [paper](https://arxiv.org/html/2501.03720v1) submitted 2025-01-07. The paper describes separate recording dates but no exact calendar dates; packaging dates do not establish recording dates. It also explicitly leaves human refinement of MIDI labels as future work. P3 music relates to EGSet12 and contributes one take here, not a second independently sourced dataset. No old holdout was inspected to resolve overlap.

[Predeclaration](../validation/guitar-techs/predeclared.json) selected 14 whole takes from directory metadata: P1 and P2 each Set1 major, Set4 minor, Set1 diminished, Set1 major seventh, Set1 half-diminished seventh and their entire single-note sweep; P1 PalmMute and P3 music 01. Every take has paired direct input and amp microphone observations: 28 inputs, 56 actual inference calls. A take contains many chromatically ascending voicings or notes; those are not counted as separate independent performances. Only three players/room setups exist, so even the 14 take units are correlated within player. No favorable crops or file-name-derived note/chord truth were used.

[Manifest](../validation/guitar-techs/manifest.json), [freeze](../validation/guitar-techs/freeze.json), and ignored [raw acquisition inventory](../target/guitar-techs/members.json) pin original audio/MIDI, derived labels and PCM. Each official archive's published MD5 is retained; whole-archive hashes are NOT independently verified because only selected ZIP byte ranges were downloaded. Central-directory records, member CRC32, local member name, decompressed size and SHA256, compressed slices and their hashes were independently checked. Safe named member writing rejects absolute/parent paths; no blanket extraction. Large audio, compressed slices and raw output stay ignored.

## Exact engines and scoring

Frozen Rust executable SHA256 `57d8100c0dc11c90330ce74a8d237a811d42141e54e6b5d140da52603f045f53`, engine string `rust-dsp-3`, is the phase-corrected snapshot, not an identity claim about current app rust-dsp-3.1. All 19 snapshot source hashes pass. It was not rebuilt. Basic Pitch 0.4.0 official ONNX SHA256 `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`, Python source revision `fa5997af0a8210982619003269994a1be25eddf3`, unchanged official decoder and existing adapter. Binary/model hashes checked before/after.

[Official model path history](https://github.com/spotify/basic-pitch/commit/dfb20ef559dff1792e11e022f3f0c7008c1dee6d) dates its introduction to 2024-02-27; downloading that exact historical ONNX reproduced the evaluated weight SHA256. This predates public Guitar-TECHS/EGSet12 releases, stronger evidence than comparing release names alone. However recording dates and a checkpoint-specific training inventory are unavailable, so training exclusion is plausible, NOT proved. The source-code revision being newer than the dataset does not date the weights. Existing GuitarSet exposure is not used as fresh evidence here.

Full source recording, FFmpeg default mono downmix, 24,000 Hz f32le, no normalization/crop; decoder version and source subtypes in manifest/audit. The existing Basic Pitch launcher executes an owned trampoline which only redirects NUMBA_CACHE_DIR to owned storage, then runpy executes the unchanged adapter. It does not change model, thresholds, dependencies or routing. Rust uses auto/440 Hz/sharps; Basic Pitch native polyphonic. Primary metrics use their note-stream union, never unfairly compare Rust's poly subset with all learned notes. The unchanged `validation/real-audio/score.py` supplies original frame/stream/routing and event metrics, with a thin new case adapter. Harmony has no performed labels here: the learned unknown shell is not chord evidence.

Primary: whole-duration unshifted 20 ms frame centers, including attacks, tails and reference-empty spans. Exact MIDI and PC set denominators are nonempty reference frames. Same-pitch overlaps merge for audible event matching; adjacent reattacks do not. Events use exact MIDI, maximum one-to-one matching, onset <=50 ms; offset <=max(50 ms,20% reference note duration). Separate fixed -100/+100 ms MIDI shifts are sensitivity diagnostics only, never chosen to replace primary. Labels retain channels, velocity, brief pickup events and outside-audio notes. Empty-label emission is not automatically acoustic silence.

## Primary results

The intended primary scope is all 14 takes. A failed observation has no invented score: the failing engine has no complete all-scope aggregate. The table below is a CONDITIONAL completed-pair diagnostic, equally averaging only takes where that engine returned both DI/mic outputs. Denominators differ and must not be compared as an all-scope ranking. Every failure remains in the coverage report below; incomplete pairs are not silently counted as complete performances.

| Engine | P % | R % | F1 % | MIDI exact % | PC exact % | Onset F1 % | Onset+offset F1 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rust (12 complete pairs) | 80.24 | 95.15 | 86.91 | 62.89 | 72.06 | 32.75 | 23.16 |
| basic-pitch (14 complete pairs) | 76.82 | 90.84 | 81.92 | 51.63 | 69.32 | 55.59 | 37.54 |

| Category | Takes | Rust F1 % | Basic Pitch F1 % |
| --- | --- | --- | --- |
| chords | Rust 10, BP 10 | 88.16 | 86.41 |
| singlenotes | Rust 1, BP 2 | 80.25 | 85.28 |
| techniques | Rust 0, BP 1 | unavailable | 27.25 |
| music | Rust 1, BP 1 | 81.12 | 84.93 |

### Per observation, unshifted

Exact counts are MIDI/PC exact over the same nonempty denominator. Empty is emitting/reference-empty frames. Events are matched/predicted/reference, onset and onset+offset respectively. Full routing and mono/poly diagnostics are preserved in each original score object.

| Take / observation | Engine | P/R/F1 % | MIDI / PC / nonempty | Empty emitting / empty | Onsets TP/pred/ref | Offsets TP/pred/ref |
| --- | --- | --- | --- | --- | --- | --- |
| P1_chords_Set1_maj_directinput | rust | 76.40/94.51/84.50 | 3613 / 4635 / 6740 | 539 / 860 | 101/448/131 | 73/448/131 |
| P1_chords_Set1_maj_directinput | basic-pitch | 65.62/96.69/78.18 | 1701 / 4179 / 6740 | 358 / 860 | 98/329/131 | 76/329/131 |
| P1_chords_Set1_maj_micamp | rust | 73.39/93.76/82.33 | 3001 / 4326 / 6740 | 578 / 861 | 101/1129/131 | 24/1129/131 |
| P1_chords_Set1_maj_micamp | basic-pitch | 77.27/96.23/85.71 | 2897 / 5353 / 6740 | 169 / 861 | 99/320/131 | 77/320/131 |
| P1_chords_Set4_min_directinput | rust | 84.98/95.07/89.74 | 4522 / 5605 / 6541 | 522 / 1059 | 106/475/126 | 83/475/126 |
| P1_chords_Set4_min_directinput | basic-pitch | 75.28/93.77/83.51 | 2361 / 5436 / 6541 | 306 / 1059 | 96/306/126 | 63/306/126 |
| P1_chords_Set4_min_micamp | rust | 80.09/94.13/86.55 | 4057 / 5175 / 6541 | 716 / 1060 | 97/842/126 | 68/842/126 |
| P1_chords_Set4_min_micamp | basic-pitch | 78.43/92.03/84.69 | 2842 / 5105 / 6541 | 235 / 1060 | 97/308/126 | 57/308/126 |
| P1_chords_Set1_dim_directinput | rust | 79.29/94.63/86.29 | 3715 / 4621 / 6638 | 560 / 962 | 101/403/133 | 83/403/133 |
| P1_chords_Set1_dim_directinput | basic-pitch | 73.00/94.81/82.49 | 2030 / 3343 / 6638 | 390 / 962 | 98/271/133 | 81/271/133 |
| P1_chords_Set1_dim_micamp | rust | 79.11/96.83/87.07 | 3827 / 4840 / 6638 | 652 / 963 | 98/835/133 | 68/835/133 |
| P1_chords_Set1_dim_micamp | basic-pitch | 86.87/93.15/89.90 | 4055 / 4954 / 6638 | 303 / 963 | 98/213/133 | 76/213/133 |
| P1_chords_Set1_Maj7_directinput | rust | 79.18/93.78/85.86 | 3501 / 5158 / 8909 | 254 / 1291 | 176/506/221 | 126/506/221 |
| P1_chords_Set1_Maj7_directinput | basic-pitch | 70.38/86.33/77.54 | 1295 / 3310 / 8909 | 92 / 1291 | 144/489/221 | 69/489/221 |
| P1_chords_Set1_Maj7_micamp | rust | 76.50/93.27/84.06 | 3172 / 4934 / 8909 | 346 / 1292 | 174/1303/221 | 70/1303/221 |
| P1_chords_Set1_Maj7_micamp | basic-pitch | 73.77/84.98/78.98 | 1509 / 3749 / 8909 | 70 / 1292 | 150/497/221 | 74/497/221 |
| P1_chords_Set1_m7b5_directinput | rust | 77.74/94.53/85.32 | 4024 / 5832 / 8577 | 757 / 1423 | 161/741/200 | 118/741/200 |
| P1_chords_Set1_m7b5_directinput | basic-pitch | 72.77/91.82/81.19 | 2217 / 4755 / 8577 | 415 / 1423 | 177/511/200 | 102/511/200 |
| P1_chords_Set1_m7b5_micamp | rust | 77.77/94.93/85.50 | 3875 / 5760 / 8577 | 815 / 1424 | 154/1241/200 | 98/1241/200 |
| P1_chords_Set1_m7b5_micamp | basic-pitch | 80.66/89.74/84.96 | 2961 / 5326 / 8577 | 340 / 1424 | 177/444/200 | 103/444/200 |
| P1_singlenotes_allsinglenotes_directinput | rust | 63.38/97.39/76.78 | 20161 / 20861 / 22656 | 3606 / 4944 | 136/1864/138 | 66/1864/138 |
| P1_singlenotes_allsinglenotes_directinput | basic-pitch | 73.96/89.95/81.18 | 16669 / 18425 / 22656 | 1885 / 4944 | 134/300/138 | 87/300/138 |
| P1_singlenotes_allsinglenotes_micamp | basic-pitch | 80.60/87.43/83.88 | 17068 / 19210 / 22656 | 1416 / 4945 | 133/335/138 | 83/335/138 |
| P2_chords_Set1_maj_directinput | rust | 86.03/97.61/91.46 | 5451 / 5480 / 7235 | 284 / 515 | 101/341/117 | 63/341/117 |
| P2_chords_Set1_maj_directinput | basic-pitch | 89.45/95.55/92.40 | 4805 / 6010 / 7235 | 28 / 515 | 111/203/117 | 77/203/117 |
| P2_chords_Set1_maj_micamp | rust | 87.49/97.70/92.31 | 5519 / 5569 / 7235 | 268 / 515 | 107/299/117 | 63/299/117 |
| P2_chords_Set1_maj_micamp | basic-pitch | 88.13/96.65/92.19 | 4667 / 5832 / 7235 | 51 / 515 | 109/208/117 | 72/208/117 |
| P2_chords_Set4_min_directinput | rust | 95.03/98.42/96.70 | 6408 / 6460 / 7063 | 319 / 687 | 108/279/117 | 104/279/117 |
| P2_chords_Set4_min_directinput | basic-pitch | 93.96/95.91/94.93 | 5428 / 6216 / 7063 | 65 / 687 | 114/169/117 | 105/169/117 |
| P2_chords_Set4_min_micamp | rust | 95.94/98.72/97.31 | 6387 / 6524 / 7063 | 180 / 687 | 109/223/117 | 105/223/117 |
| P2_chords_Set4_min_micamp | basic-pitch | 90.18/97.09/93.51 | 5147 / 6356 / 7063 | 76 / 687 | 109/195/117 | 102/195/117 |
| P2_chords_Set1_dim_directinput | rust | 83.76/95.77/89.36 | 5355 / 5496 / 7030 | 472 / 720 | 50/390/117 | 37/390/117 |
| P2_chords_Set1_dim_directinput | basic-pitch | 92.46/92.07/92.27 | 4883 / 5384 / 7030 | 147 / 720 | 104/183/117 | 76/183/117 |
| P2_chords_Set1_dim_micamp | rust | 84.96/95.92/90.11 | 5367 / 5483 / 7030 | 430 / 720 | 54/362/117 | 38/362/117 |
| P2_chords_Set1_dim_micamp | basic-pitch | 89.47/93.93/91.64 | 4632 / 5036 / 7030 | 159 / 720 | 99/187/117 | 69/187/117 |
| P2_chords_Set1_Maj7_directinput | rust | 77.73/96.19/85.98 | 5471 / 5627 / 9212 | 1017 / 1588 | 119/695/202 | 69/695/202 |
| P2_chords_Set1_Maj7_directinput | basic-pitch | 76.59/90.26/82.87 | 2558 / 4517 / 9212 | 442 / 1588 | 155/408/202 | 85/408/202 |
| P2_chords_Set1_Maj7_micamp | rust | 77.92/95.90/85.98 | 5478 / 5633 / 9212 | 1015 / 1589 | 117/799/202 | 68/799/202 |
| P2_chords_Set1_Maj7_micamp | basic-pitch | 85.06/85.86/85.46 | 3275 / 5001 / 9212 | 257 / 1589 | 156/365/202 | 96/365/202 |
| P2_chords_Set1_m7b5_directinput | rust | 81.00/96.24/87.96 | 6048 / 6209 / 9579 | 910 / 1421 | 163/681/205 | 106/681/205 |
| P2_chords_Set1_m7b5_directinput | basic-pitch | 77.57/95.99/85.80 | 3589 / 5744 / 9579 | 483 / 1421 | 192/456/205 | 116/456/205 |
| P2_chords_Set1_m7b5_micamp | rust | 82.41/96.29/88.81 | 5971 / 6149 / 9579 | 664 / 1422 | 142/673/205 | 80/673/205 |
| P2_chords_Set1_m7b5_micamp | basic-pitch | 87.97/92.26/90.06 | 4871 / 6508 / 9579 | 145 / 1422 | 189/364/205 | 139/364/205 |
| P2_singlenotes_allsinglenotes_directinput | rust | 69.53/99.18/81.75 | 21328 / 21425 / 23180 | 3218 / 4420 | 137/1103/137 | 112/1103/137 |
| P2_singlenotes_allsinglenotes_directinput | basic-pitch | 73.86/96.18/83.56 | 17504 / 18676 / 23180 | 1568 / 4420 | 137/293/137 | 117/293/137 |
| P2_singlenotes_allsinglenotes_micamp | rust | 65.43/98.92/78.76 | 20277 / 20356 / 23180 | 2984 / 4421 | 136/1593/137 | 81/1593/137 |
| P2_singlenotes_allsinglenotes_micamp | basic-pitch | 92.32/92.73/92.52 | 20638 / 21216 / 23180 | 832 / 4421 | 136/194/137 | 107/194/137 |
| P1_techniques_PalmMute_directinput | basic-pitch | 15.17/77.86/25.39 | 2321 / 2534 / 3726 | 12709 / 23874 | 103/381/143 | 40/381/143 |
| P1_techniques_PalmMute_micamp | basic-pitch | 17.97/76.70/29.11 | 2633 / 2800 / 3726 | 9945 / 23875 | 103/615/143 | 32/615/143 |
| P3_music_01_directinput | rust | 78.41/85.95/82.01 | 1651 / 2121 / 3492 | 70 / 133 | 140/476/193 | 97/476/193 |
| P3_music_01_directinput | basic-pitch | 82.86/84.39/83.62 | 1610 / 1926 / 3492 | 32 / 133 | 125/297/193 | 60/297/193 |
| P3_music_01_micamp | rust | 75.77/85.24/80.22 | 1504 / 1946 / 3493 | 49 / 133 | 140/512/193 | 97/512/193 |
| P3_music_01_micamp | basic-pitch | 89.40/83.30/86.24 | 1892 / 2057 / 3493 | 23 / 133 | 125/247/193 | 63/247/193 |

## Predeclared timing sensitivity

No shift is selected or treated as corrected truth. Entries are the same balanced F1 under the two fixed MIDI shifts, alongside raw primary.

| Engine | MIDI -100ms % | Raw % | MIDI +100ms % |
| --- | --- | --- | --- |
| rust | 85.05 | 86.91 | 85.41 |
| basic-pitch | 81.32 | 81.92 | 79.62 |

## Evidence and reproducibility

Manifest SHA256 `8e46904e4059ec5f1be62bd9d674a285050dfd14961aa272ae3ea32da42dd311`; audit SHA256 `b02eca5f103022dd339c86fccadcf166c1bb6425dec5fe4cbe10a2bccf47c9c5`. Official ZIP payload transfer: **590,685,361 bytes** (includes the initial 65,536-byte range probe and repeated central-directory reads). Provenance HTML/API/model downloads add a small separate amount; see final inventory. No whole archive was downloaded.

- [Audit](../target/guitar-techs/audit.json): MIDI tempo/tracks/channels, offs, note counts/ranges/duration quantiles, brief labels, overlapping unisons, audio rate/subtype/finite/clipping, first energy attacks, per-attack RMS-rise lags and independently measured spectra at 20 uniformly spaced source notes per take. This is a limited acoustic audit, not human adjudication.
- [Scores](../target/guitar-techs/evaluation/scores.json), [balanced summary](../target/guitar-techs/evaluation/summary.json), [per-performance results](../target/guitar-techs/evaluation/performance-balanced.json). Every engine/observation has raw wire JSON, stdout/stderr and complete timestamped `*.frames.json` reference/observed/missing/extra sets. Basic Pitch also retains original model inputs, tensors, unwrapped outputs and raw events.
- [Inference commands/status/timings](../target/guitar-techs/evaluation/commands.json), [decode commands](../target/guitar-techs/decode-commands.json), [run freeze](../target/guitar-techs/evaluation/run-freeze.json), [completion](../target/guitar-techs/evaluation/complete.json), [transfer ledger](../target/guitar-techs/transfer.jsonl).
- Reusable adapters under `validation/guitar-techs/`: `acquire.py`, `select.py`, `prepare.py`, `evaluate.py`, `summarize.py`, `owned_launch.py`, `selfcheck.py`. They refuse existing source/output files; preserve this freeze and use a new versioned directory for future runs. These are evaluation adapters, not production dependencies.

Selfchecks exercise a hand-constructed MIDI tempo change across tracks, velocity-zero off, channel preservation, unmatched off reporting, same-pitch overlap versus adjacent reattack, octave error, onset/offset tolerance and one-to-one event matching. These pass independently of recognizer outputs. Acquisition range/member checks, finite PCM, exact frozen hashes and unchanged scorers pass before inference.

## Completion failures (part of the intended primary scope)

56 actual calls; 53 scored outputs; 3 failures. No missing output was imputed as silence or retried with a shorter crop.

- P1_singlenotes_allsinglenotes_micamp, rust: exit 3, 34.24s: `analysis limit exceeded: too many note events`. Retained command and stderr; absent score.
- P1_techniques_PalmMute_directinput, rust: exit 3, 20.01s: `analysis limit exceeded: too many harmony events`. Retained command and stderr; absent score.
- P1_techniques_PalmMute_micamp, rust: exit 3, 49.26s: `analysis limit exceeded: too many note events`. Retained command and stderr; absent score.

Matched-completed-pair diagnostic: 12/14 takes, Rust F1 86.91%, Basic Pitch 86.43%. The missing/failed take(s) remain a product-reliability failure, not an accuracy waiver.

## Annotation audit findings and exact take inventory

All 28 decoded observations are finite and source/derived digital clipping counts are zero. Actual sources are 48 kHz; P1 is mono, P2/P3 stereo, and source subtypes include signed 24-bit DI and signed 16-bit amplifier mic, differing from the paper’s uniform float32 description. MIDI headers use 960 ticks/quarter, not the paper’s 9600; the parser uses each actual header. Tempo maps are applied across all tracks, note-off and velocity-zero note-on are supported, and overlapping same-channel notes use FIFO pairing. Track/channel details and stereo channel RMS/correlation are retained in the audit. No sustain-based reinterpretation was needed.

118 source note events across the 14 takes are shorter than 50 ms; all remain. The single-note sweeps contain 142 (P1) and 137 (P2) note events, versus the protocol’s 138 instructed tones: these are observed pickup-label counts, not proof of either wrongly played or wrongly detected notes. The source MIDI is not infallible truth. Four notes have no note-off (two P2 Set1_dim, two P2 Set1_Maj7); the [pre-inference audit decision](../validation/guitar-techs/audit-decisions.json) explicitly terminates these at MIDI EOF and marks offsets uncertain. Original note-ons are retained. P1_dim has a floating-point endpoint ~1e-13 s beyond audio; music 01 has one endpoint ~1.707 ms beyond audio. Neither is trimmed or dropped from event reference counts. No unmatched-off/nonpositive-duration issues were otherwise found.

The audit measures 10 ms RMS envelopes and the largest energy rise in a fixed +/-200 ms neighborhood of isolated MIDI starts. This can be confounded by strumming, decay or noise; P2 low-string minor includes a median rise lag near +154 ms, so the deposit’s <=100 ms warning is not sufficient evidence that every local onset is aligned. It is not used to fit a shift. Spectra from 20 uniformly spaced labels per observation include harmonic-dominated low notes and DC-dominated late intervals. For example P1’s first E2 label (82.4 Hz) has a strongest spectral peak near 248.4 Hz, while some P2 high-note sampled intervals peak at DC. A strongest-bin check neither adjudicates all fundamentals nor proves labels wrong. These independent findings make “annotation agreement” the honest measurement name, especially for offsets and tails.

| Complete take | Duration s | Source note events | MIDI range | <50 ms | Unclosed notes |
| --- | --- | --- | --- | --- | --- |
| P1_chords_Set1_maj | 152.000 | 131 | [51, 78] | 15 | 0 |
| P1_chords_Set4_min | 152.000 | 126 | [42, 63] | 13 | 0 |
| P1_chords_Set1_dim | 152.000 | 133 | [56, 78] | 22 | 0 |
| P1_chords_Set1_Maj7 | 204.000 | 221 | [45, 78] | 26 | 0 |
| P1_chords_Set1_m7b5 | 200.000 | 200 | [51, 78] | 12 | 0 |
| P1_singlenotes_allsinglenotes | 552.000 | 142 | [40, 86] | 0 | 0 |
| P2_chords_Set1_maj | 155.000 | 117 | [56, 77] | 0 | 0 |
| P2_chords_Set4_min | 155.000 | 117 | [42, 63] | 1 | 0 |
| P2_chords_Set1_dim | 155.000 | 117 | [56, 78] | 0 | 2 |
| P2_chords_Set1_Maj7 | 216.000 | 202 | [51, 79] | 0 | 2 |
| P2_chords_Set1_m7b5 | 220.000 | 205 | [51, 79] | 0 | 0 |
| P2_singlenotes_allsinglenotes | 552.000 | 137 | [40, 86] | 0 | 0 |
| P1_techniques_PalmMute | 552.000 | 148 | [40, 86] | 7 | 0 |
| P3_music_01 | 72.500 | 235 | [41, 69] | 22 | 0 |

## Concrete retained note-set disagreements

Illustrations below choose the first >=200 ms run of unchanged, nonempty reference and unchanged disagreeing prediction, separately for each engine/category. Timestamp is 100 ms into that run. This selection illustrates failures only; it does not alter selection, labels, intervals or score denominators. Every timestamped frame remains in raw evidence.

| Engine / category | Observation | Time s | Reference MIDI | Observed MIDI | Missing | Extra |
| --- | --- | --- | --- | --- | --- | --- |
| rust / chords | P1_chords_Set1_maj_directinput | 4.930 | [59, 63, 66] | [59, 63, 66, 71] | [] | [71] |
| rust / singlenotes | P1_singlenotes_allsinglenotes_directinput | 23.010 | [45] | [45, 53] | [] | [53] |
| rust / music | P3_music_01_directinput | 6.750 | [42, 58, 59] | [42, 58] | [59] | [] |
| basic-pitch / chords | P1_chords_Set1_maj_directinput | 1.070 | [58, 62, 65] | [58, 62, 65, 70] | [] | [70] |
| basic-pitch / singlenotes | P1_singlenotes_allsinglenotes_directinput | 0.630 | [40] | [40, 64] | [] | [64] |
| basic-pitch / techniques | P1_techniques_PalmMute_directinput | 0.590 | [40] | [40, 59] | [] | [59] |
| basic-pitch / music | P3_music_01_directinput | 0.670 | [43, 59] | [43, 55, 59, 62] | [] | [55, 62] |

## Limitations and next recognition decision

rust: conditional completed-pair raw union F1 86.91%, exact MIDI 62.89%, exact PC 72.06%. basic-pitch: conditional completed-pair raw union F1 81.92%, exact MIDI 51.63%, exact PC 69.32%. These completed-pair metrics have explicit coverage denominators; they are fresh electric-guitar agreement measurements; they do not replace any earlier failed adoption gate or establish a universal winner. The category and paired-channel results show which failures survive a new recording source. Sustained missing/extra notes in the illustrations cannot all be explained by a 50–100 ms boundary tolerance, although pickup pitch errors or unmodeled decay may still contribute. Onset/offset disagreements are substantially less trustworthy without human-verified releases.

The next authorized recognition work should use the frozen per-register/per-family losses and paired DI/mic differences to distinguish missing voicing tones, octave errors, and capture sensitivity, and test any new candidate against the same unchanged package plus a genuinely untouched acceptance set. Do not integrate either candidate from these DEV results, fit timing shifts to its outputs, fill voicings from chord filenames, or tune the existing thresholds. A separately licensed, independently adjudicated release/onset reference would resolve the largest annotation uncertainty; no user manual QA is assigned. This task does not authorize training or new provider/runtime work.

Coverage does not include all families (augmented, dominant/minor seventh were not selected), bends/vibrato/harmonics, ego/exo or phone microphones, band/source separation, heavy distortion, alternate tunings, or more than three player/room setups. Each chord take is a sweep, not a random sample of songs. The two uncertain EOF takes remain in primary scores. No chord-quality accuracy is claimed from intended filenames or Basic Pitch’s unsupported harmony shell. Timing sensitivity is diagnostic only, and no threshold was relaxed.

53/56 inference calls succeeded; failed calls remain in the intended scope. Total subprocess wall time: Rust 225.61 s; Basic Pitch 287.59 s. These include startup/serialization/cache warmup, exclude scoring, and are not browser/live latency benchmarks. Successfully downloaded source payload totals **591,231,451 bytes** (590,685,361 ZIP range bytes + 546,090 provenance/model-history bytes), excluding HTTP/TLS overhead and web-tool browsing. No acquisition failures occurred. Preparation stopped once for unclosed MIDI and once for metadata serialization; both failures and the early incomplete preparation probe are retained in [operations](../target/guitar-techs/operations.json) and failure logs. All happened before inference/freeze; original inputs and historical evidence were not changed.

[Final verifier](../validation/guitar-techs/verify.py) checks every frozen input, scorer/adapter identity, 19 Rust snapshot entries, retained output associations and all 56 command statuses, including failures. [Evidence inventory](../target/guitar-techs/evidence-inventory.json) hashes source/report/raw artifacts, excluding JIT caches. [Handoff](../target/guitar-techs/handoff.json) records verification and ownership release. All owned processes completed; no servers, children, builds, commits, pushes, production, databases, secrets or deployments were used.

## Failure-specific evidence

The frozen limits are 4,000 events per note stream and 3,000 harmony events (`source/.../config.rs` in the phase snapshot). Rust exits 3 on the P1 mic single-note sweep (note events), P1 DI palm mute (harmony events), and P1 mic palm mute (note events). Original stderr and full commands are retained. These are observed reliability failures, not missing musical scores to impute or permission to raise a limit. Fragmentation is a plausible mechanism; no failed partial output establishes exactly which notes were emitted.

Basic Pitch’s palm-mute failure is not merely low recall: DI P/R/F1 is **15.17/77.86/25.39%**, mic **17.97/76.70/29.11%**. It emits **381 / 615** merged note events against **143** audible-union reference events, matching **103** onsets in each view, and only **40 / 32** with offsets. The heavy extras/over-segmentation need attention alongside duration uncertainty; pickup imperfections cannot simply waive all those errors. The first retained stable example emits MIDI59 alongside labeled MIDI40. These remain agreement findings until independently adjudicated.

On the matched completed scope, Basic Pitch’s event advantage coexists with lower exact MIDI set agreement. That tradeoff, plus the unmatched full-input Rust failures, is the concrete reason not to declare a broad winner or fit thresholds from this package. [Register counts and timestamped examples](../target/guitar-techs/evaluation/diagnostics.json) and every per-frame row support a narrower next experiment.

[Comparison chart](../target/guitar-techs/comparison.html) uses the 12 matched completed pairs only. Automated HTML preview was blocked by the host’s T3 browser sandbox/AppArmor setup; this has no bearing on audio acquisition or inference. No host configuration was changed or user manual QA requested. The numeric report and raw artifacts remain authoritative.
