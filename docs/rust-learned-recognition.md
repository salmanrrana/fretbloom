# Official Basic Pitch recognition probe — reject for adoption

**NO-GO for this checkpoint/default decoder as the replacement recognizer.** Actual reference inference completed the entire requested DEV scope; note gates, defining/register tones, singleton rejection and dim retention fail. Fast CPU inference and substantial real-recording improvements do not override those failures. No product integration, Rust/WASM runtime prototype, model conversion, production optimization of v4 or threshold search was performed.

Read the joint-attribution, temporal review (including root corrections), temporal validation, joint validation, Rust architecture/live contracts and the new independent strategy review. Rejected v4 and stale generated v3 WASM remain untouched. The phase baseline executable was rehashed, never rebuilt or rerun. All implementation/dependencies/model downloads/results are isolated under ignored `target/learned-recognition/`; this is the only new document.

## Candidate identity, upstream rights and possible training overlap

The candidate is **Python Basic Pitch 0.4.0, official ICASSP-2022 ONNX**, not the separately released TFJS graph. Archives came directly from Spotify's GitHub API at pinned revisions, with no checkout/worktree. Official source code and every bundled artifact are inventoried in `upstream-inventory.json`; original archives, API commit metadata and licenses are retained. All 122 upstream files rehash unchanged. No random rehosted weights or training were used.

| Artifact | Revision / SHA256 | Bytes |
| --- | --- | --- |
| Python source commit | fa5997af0a8210982619003269994a1be25eddf3 | — |
| Python archive | e3ee7112880131a323bab04c7e38903021324534041391c3bb8cffccce0f7871 | 3745554 |
| ONNX nmp.onnx | 2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec | 230444 |
| Python LICENSE | 929c910bae2152fa87199a5d0660e09263419b7eee6d4b301d05ee2aaf211c37 | 11384 |
| TS source commit (inspected only) | 2d498f82b61c71898edf0e8dd661b99076676c8b | — |
| TS graph (not evaluated) | 1ed1aaee3409ec1dc098c8b01f430c0911f6fe9412e7af8086750f9e8f302f68 | 174537 |
| TS weights (not evaluated) | b142a95737a52e1e412d5f92e73d8bb80dfe8d04941acc0702f11f4524fb377c | 742392 |

Spotify's [Python LICENSE](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/LICENSE) is Apache-2.0, copyright Spotify AB; inference/constants/decoder files carry Apache headers. The [TS repository](https://github.com/spotify/basic-pitch-ts/tree/2d498f82b61c71898edf0e8dd661b99076676c8b) declares Apache-2.0 separately. A recursive license/NOTICE check found only each repository's root LICENSE, no model-specific license or exclusion file. The exact ONNX is distributed inside Spotify's licensed repository, and [README](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/README.md) identifies the bundled conversions. Its ONNX metadata has no license or checkpoint-training manifest. This establishes official distribution provenance and repository terms; it does **not** establish an additional explicit weight-specific redistribution grant. Keep that legal provenance question open before redistribution, rather than assuming all data/assets inherit a code badge. No evaluation audio is included in a distributable model package.

`dependency-licenses.json` records the actual resolved environment and hashes bundled notices; `requirements.lock` pins every installed version. ONNX Runtime 1.23.2 is MIT; ONNX 1.19.1 includes its own notices; librosa 0.11.0/resampy 0.4.2 are ISC; pretty_midi 0.2.11 and mir_eval 0.8.2 are MIT. The installed **soxr 1.1.0 declares LGPL-2.1-or-later**, and numerical wheels include additional native-library notices. This evaluation environment is not a reviewed redistribution bundle. TensorFlow, CoreML, GPU runtimes and global package installation were avoided. The owned Python environment occupies about 727 MiB on disk, distinct from 230,444-byte weights and measured RSS.

The [paper](https://arxiv.org/html/2203.09893v2) and [official constants](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/constants.py) identify GuitarSet, MAESTRO, Slakh, iKala and MedleyDB among training data. The paper lists 648 GuitarSet training and 72 test tracks, but the README warns the released implementation improved beyond the paper. Current [GuitarSet pipeline](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/data/datasets/guitarset.py) uses MIC/JAMS, shuffled track IDs and an optional split seed; its CLI defaults to .8/.1/remainder. That is not a checkpoint-specific split manifest and does not identify which of our recordings trained these weights. All three existing GuitarSet DEV recordings are **potentially seen**. Their scores below are not independent unseen-guitar accuracy. No holdout files/labels were inspected or executed to resolve this. Existing evaluation metadata identifies GuitarSet 1.1.0 audio/annotations as CC-BY-4.0; original synthetic/supplemental/independent-control generators identify CC0-1.0. No additional datasets were downloaded. Dataset licenses, the paper’s CC-BY-NC-SA-4.0 license, and model rights remain distinct.

## Frozen preprocessing, decoder and adapter semantics

`predeclared.json` predates corpus inference. Code revisions, constants, decoder defaults and routing were fixed before evaluation; no grid search, hand veto, chord fill or score-driven adjustment occurred. Exact per-file code SHA256s are in `upstream-inventory.json`.

- Input remains the original **24 kHz mono f32 canonical PCM**, hash unchanged. Existing independently retained decoded PCM was copied read-only into ownership, rather than re-decoding or reinterpreting labels. Owned float WAVs preserve samples without quantization or normalization. Official `librosa.load(sr=22050, mono=True)` internally resamples with librosa 0.11's `soxr_hq` default.
- Model input `[1,43844,1]`: 1.98839 s at 22,050 Hz. Hop 256 samples; prepend 3,840 zeros, use 7,680-sample overlap (30 output frames), step 36,164 samples (1.64009 s), right-zero-pad incomplete windows. Model internal padding includes reflection and zero padding; see full graph inventory.
- Raw note/onset outputs `[1,172,88]`, contour `[1,172,264]`. Notes cover MIDI21–108 (27.5–4186 Hz); contour has three bins per semitone. Official unwrap removes 15 frames at both ends of each output, concatenates the remaining 142, and trims according to original resampled length. Raw window tensors and unwrapped outputs are both retained.
- Official defaults: onset .5, frame .3, minimum note length 127.7 ms converted to 11 frames, inferred onsets enabled, Melodia recovery enabled, energy tolerance 11 frames, no frequency restriction, bends enabled, multiple overlapping bends disabled, MIDI tempo120. The decoder rejects lengths <=11 frames. It combines local onset maxima and note-difference onsets, follows note energy, then extracts remaining Melodia energy; actual `inference.predict` and its unchanged decoder execute, not a surrogate network or rewritten decoder.
- Timing uses **official `model_frames_to_time`**, with `t(i)=i*256/22050-floor(i/172)*((256/22050)*(172-43844/256)+.0018)`, including the approximately .0103261-second per-172-frame correction. Leading 3,840-sample padding and 15-frame trimming align nominal time zero; direct frame index × hop is insufficient. Batch resampling's impulse at 1.000 s peaks at 22,050 with zero measured timestamp displacement. That does not prove a causal streaming resampler has zero delay. Original corpus durations and sample counts remain authoritative; only decoded note spans are clipped to `[0,duration]` for wire compatibility, with raw events preserved.
- Official model mode is **polyphonic notes**, including possible singleton output. `polyphonic` below is that native note stream. Optional `auto`/`monophonic` are explicitly **predicted-pitch-count adapters**, not learned source separation: split at predicted event boundaries; one distinct predicted pitch goes to mono; >=2 to poly in auto; monophonic refuses those predicted multi-pitch spans. No truth/labels affect routing. These derived modes can merge same-pitch reattacks and change event boundaries, so raw model events remain separate. All union metrics refer to native events unless stated otherwise.
- Chord identity, bass, confidence calibration, cents/tuning and harmonic alignment features are unsupported. Wire compatibility uses one all-duration `unknown` harmony span, null bass, no alternatives, and explicitly labeled zero chroma/null feature MIDI/zero cents/margin placeholders. RMS is measured from input. Note score is model mean activation, with a conservative placeholder `low` level; it is not probability or product evidence calibration. No chord, bass, boundary or alignment pass is claimed from this shell. `adapterCapabilities` exposes these limitations. The actual trained contours/bends remain in raw diagnostics instead of pretending zero cents is measured.

## Complete unchanged DEV evaluation

**86 distinct full input model runs**: all 51 synthetic DEV, all 3 whole GuitarSet DEV, all 12 supplemental DEV, all 20 frozen independent controls. Each result was scored in native-poly and both derived routing modes: **258 wire/scorer adaptations, zero failures** (153 synthetic, 9 real, 36 supplemental, 60 controls). The original required 168 DEV-call shape is included; the extra real/supplemental modes are diagnostics. These are not 258 independent network executions. Two reviewer whole/late PCM probes ran additionally. No favorable crops, changed labels/scorers, unknown exclusions, threshold tuning or manual QA.

`evaluate.py` imports original synthetic `score/evaluate`, `rust_eval.adapt`, `streams`, real `score/events`, supplemental `score`, independent control `score` and `validate_wire` unchanged. It redirects only its own outputs and supplies the explicit unsupported harmony shell. Original report objects, every case/family/capo/mode/stream denominator, original 20 ms centers, onset/offset tolerances and boundary counts survive in `evaluation/reports.json`. Unsupported harmony fields score zero or abstain in those raw reports, not a chord acceptance claim.

`evaluation/phase-deltas.json` preserves **every changed 20 ms frame**, expected/old/new MIDI sets and per-MIDI gained/lost true, added/removed extra, plus register counts across every corpus/mode. `summary.json` and `additional.json` aggregate, without replacing original scorers. Phase executable identity is `57d8100c0dc11c90330ce74a8d237a811d42141e54e6b5d140da52603f045f53`; retained phase reports/outputs, not rejected v4 or stale WASM, are the comparison.

| Settled synthetic metric % | Phase baseline | Basic Pitch native notes | Original gate |
| --- | --- | --- | --- |
| mono_early_exact | 99.63 | 67.65 | >=95 |
| mono_exact | 92.13 | 67.13 | >=90 |
| poly_midi_exact | 8.94 | 6.95 | 80 diagnostic |
| poly_pc_exact | 87.13 | 89.61 | >=85 |
| note_precision | 94.36 | 92.01 | >=80 |
| note_recall | 68.53 | 70.48 | >=80 |
| note_f1 | 79.40 | 79.82 | >=85 |

Settled TP/FP/FN **7083/615/2966**; exact MIDI **143/2059**, PC **1845/2059**. Dedicated silence/noise/percussion emits on **8/300=2.67%** frames (gate<=1%, phase 0/300); other reference-empty margins **204/1445**. Original all-empty aggregate remains 212/1745=12.15%. They are separate denominators. Unsupported root/quality/bass/primary are zero, boundary 0 TP/0 FP/3 FN, not passed or waived.

| Intended group | MIDI F1 % | PC exact % |
| --- | --- | --- |
| chord:maj | 74.10 | 88.89 |
| chord:min | 78.43 | 89.56 |
| chord:7 | 82.99 | 100.00 |
| chord:maj7 | 84.06 | 96.15 |
| chord:m7 | 84.20 | 98.35 |
| chord:sus2 | 79.38 | 89.34 |
| chord:sus4 | 79.02 | 100.00 |
| chord:add9 | 75.83 | 54.10 |
| chord:6 | 75.00 | 0.00 |
| chord:m6 | 77.00 | 62.30 |
| chord:dim | 85.71 | 100.00 |
| chord:aug | 82.81 | 100.00 |
| chord:none | 89.34 | 94.35 |
| transition:mixed | 79.19 | 96.55 |

Every low/high mono case remains visible; blanket polyphonic-to-mono relabeling cannot fix the union misses/extras:

| Mono case | True MIDI | Settled exact % |
| --- | --- | --- |
| dev_note_00 | [40] | 0.00 |
| dev_note_01 | [41] | 68.97 |
| dev_note_02 | [47] | 0.00 |
| dev_note_03 | [45] | 96.55 |
| dev_note_04 | [48] | 44.83 |
| dev_note_05 | [50] | 100.00 |
| dev_note_06 | [54] | 100.00 |
| dev_note_07 | [55] | 100.00 |
| dev_note_08 | [60] | 100.00 |
| dev_note_09 | [59] | 100.00 |
| dev_note_10 | [67] | 100.00 |
| dev_note_11 | [64] | 100.00 |
| dev_note_12 | [69] | 100.00 |
| dev_note_13 | [76] | 50.00 |
| dev_note_14 | [81] | 12.07 |
| dev_note_15 | [84] | 1.72 |

Full-duration synthetic register TP/FP/FN (different from settled gates):

| Register | TP / FP / FN |
| --- | --- |
| 21-39 | 0 / 280 / 0 |
| 40-47 | 2431 / 133 / 60 |
| 48-59 | 5322 / 388 / 1249 |
| 60-71 | 1765 / 283 / 2413 |
| 72-108 | 58 / 278 / 152 |

Native note union deltas versus retained phase (every new extra/lost true retained, including attacks/releases):

| Corpus | Gained true | Lost true | Added extra | Removed extra |
| --- | --- | --- | --- | --- |
| synthetic | 779 | 506 | 1282 | 708 |
| real | 1257 | 468 | 820 | 4237 |
| extended | 66 | 453 | 381 | 99 |
| controls | 1039 | 115 | 524 | 546 |

The control aggregate above includes intentionally ambiguous cases; they are separated below for acceptance interpretation. Native union equals auto union by construction, while forced mono removes predicted multi-pitch spans. Original synthetic auto stream P/R/F1 is mono 83.23/66.70/74.05%, poly 85.80/69.87/77.02%; routing 88.61%, wrong-stream 436, duplicates 0. These are adapter diagnostics, not proof the network learned our route contract. All three complete stream reports remain attached to original score objects.

## Whole real DEV: potentially training-exposed

| Recording | Native union P/R/F1 % | Exact MIDI / nonempty | PC exact / nonempty | Union onset / onset+offset F1 % |
| --- | --- | --- | --- | --- |
| 00_Rock2-142-D_solo | 71.17 / 94.43 / 81.17 | 773 / 1178 | 901 / 1178 | 81.88 / 63.04 |
| 00_SS3-84-Bb_comp | 88.74 / 77.11 / 82.52 | 892 / 2151 | 1402 / 2151 | 67.32 / 36.10 |
| 01_Jazz3-150-C_comp | 80.52 / 75.40 / 77.88 | 468 / 898 | 515 / 898 | 82.05 / 60.07 |

For fair event comparison, `additional.json` invokes the unchanged original event matcher on **both note streams' union** for phase and native learned poly. Phase union onset+offset F1: Rock 11.81%, SS 12.41%, Jazz 28.17% (34/448/128,49/606/184,80/423/145 TP/pred/ref); learned 63.04%,36.10%,60.07% (87/148/128,74/226/184,82/128/145). Original per-stream real scores remain independently preserved; do not compare a raw-poly all-note event score to an auto-only poly subset and call the entire difference recognition improvement.

Nonempty exact sets improve from phase 416/1178→773/1178,372/2151→892/2151,224/898→468/898; these encouraging results are still exposed to possible training overlap. Empty emitting frames: Rock 121/175, SS 17/135, Jazz 79/382. Whole real gains 1257/losses 468 true frames; added 820/removed 4237 extras. Rock loses 47 true, SS 254, Jazz 167, all retained rather than excused as annotation errors. Room tails/labels can be uncertain, but no disagreement was relabeled correct.

## Required probes and supplemental retention

| Whole-output probe | Time | Truth | Observed | Extra / missing |
| --- | --- | --- | --- | --- |
| dev_chord_23_C6 | 0.7 | [48, 52, 57, 60, 67] | [48, 52, 57] | [] / [60, 67] |
| dev_v1_Amadd11_capo0 | 0.71 | [45, 50, 57, 60, 64] | [26, 45, 50, 60] | [26] / [57, 64] |
| dev_v1_Amadd11_capo0 | 1.21 | [45, 50, 57, 60, 64] | [45, 50, 60] | [] / [57, 64] |
| dev_v1_Amadd11_capo3 | 0.71 | [48, 53, 60, 63, 67] | [48, 53, 63] | [] / [60, 67] |
| dev_v1_Amadd11_capo3 | 1.21 | [48, 53, 60, 63, 67] | [48, 53, 63] | [] / [60, 67] |
| 00_Rock2-142-D_solo | 4.21 | [64, 69] | [64, 69] | [] / [] |
| 01_Jazz3-150-C_comp | 3.61 | [57, 60, 64] | [45, 60] | [45] / [57, 64] |

C6 still misses 60/67; both madd11 miss defining/register tones. Rock 4.21 removes 83 while retaining 64/69. Jazz 3.61 removes 68 but retains extra 45 and now misses 57/64; dropping extras is not sufficient. Every reviewer whole/late probe recovers 57/69 **and adds 81**, so none is exact. This includes late-window 1.8. Both raw tensor/event evidence and fixed times are in `evaluation/late/` and `late-probes.json`.

| Supplemental case | TP / extra / missing | Exact MIDI / frames | PC exact |
| --- | --- | --- | --- |
| dev_v1_Amadd9_capo0 | 180 / 14 / 120 | 0 / 60 | 0 |
| dev_v1_Amadd9_capo3 | 151 / 0 / 149 | 0 / 60 | 0 |
| dev_v1_Cadd11_capo0 | 198 / 17 / 102 | 0 / 60 | 18 |
| dev_v1_Cadd11_capo3 | 197 / 4 / 103 | 0 / 60 | 17 |
| dev_v1_Amadd11_capo0 | 186 / 10 / 114 | 0 / 60 | 0 |
| dev_v1_Amadd11_capo3 | 160 / 0 / 140 | 0 / 60 | 0 |
| dev_v1_Bdim7_capo0 | 219 / 64 / 25 | 3 / 61 | 36 |
| dev_v1_Bdim7_capo3 | 200 / 17 / 44 | 0 / 61 | 17 |
| dev_v1_Bhdim7_capo0 | 231 / 88 / 13 | 7 / 61 | 48 |
| dev_v1_Bhdim7_capo3 | 244 / 24 / 0 | 37 / 61 | 53 |
| dev_v1_E5_capo0 | 127 / 0 / 59 | 3 / 62 | 62 |
| dev_v1_E5_capo3 | 140 / 28 / 46 | 16 / 62 | 62 |

Dim/half-dim exact retention collapses from **244/244 to 47/244**, losing 197 exact frames. Equivalence/primary denominators remain unchanged; no harmony output exists here. Both madd11 are 0/60 exact. Supplemental union adds 66/loses 453 true frames and adds 381/removes 99 extras versus phase; these regressions independently block replacement.

## All 20 frozen independent stress controls

Manifest is unchanged, SHA256 `c6572520f78e6ec5f468b4d9875c31cb46ac11e49c2e2fefd2e99b78a85f3ad0`. Native poly below; per-frame truth, observed streams, all preselected probes and event errors remain in original control scorer outputs. Event diagnostic uses unchanged .10s onset/.15s release matching.

| Control | TP / extra / missing | Exact / frames | Matched / ref / pred events |
| --- | --- | --- | --- |
| voices3_simultaneous | 317 / 10 / 0 | 135 / 145 | 3 / 3 / 3 |
| voices3_offset_halfturn | 303 / 11 / 0 | 134 / 145 | 3 / 3 / 3 |
| voices4_simultaneous | 317 / 9 / 97 | 39 / 145 | 3 / 4 / 3 |
| voices4_offset_halfturn | 279 / 15 / 107 | 43 / 145 | 2 / 4 / 5 |
| voices5_simultaneous | 381 / 9 / 105 | 39 / 145 | 5 / 6 / 5 |
| voices5_offset_halfturn | 321 / 9 / 118 | 52 / 145 | 2 / 6 / 6 |
| voices6_simultaneous | 337 / 9 / 258 | 39 / 145 | 3 / 6 / 5 |
| voices6_offset_halfturn | 303 / 9 / 221 | 53 / 145 | 3 / 6 / 3 |
| quiet_late_transpose0 | 330 / 3 / 211 | 74 / 260 | 1 / 3 / 4 |
| quiet_late_transpose5 | 392 / 3 / 149 | 111 / 260 | 2 / 3 / 3 |
| single_bright_43 | 110 / 7 / 0 | 138 / 145 | 1 / 1 / 1 |
| single_bright_67 | 110 / 3 / 0 | 142 / 145 | 1 / 1 / 1 |
| single_tilt_43 | 110 / 6 / 0 | 139 / 145 | 1 / 1 / 1 |
| single_tilt_67 | 110 / 3 / 0 | 142 / 145 | 1 / 1 / 1 |
| single_vibrato_43 | 110 / 7 / 0 | 138 / 145 | 1 / 1 / 1 |
| single_vibrato_67 | 110 / 73 / 0 | 72 / 145 | 1 / 1 / 3 |
| tonal_noise_1 | 0 / 321 / 0 | 29 / 145 | 0 / 0 / 3 |
| tonal_noise_0.35 | 0 / 332 / 0 | 29 / 145 | 0 / 0 / 3 |
| ambiguity_two_sources | 220 / 7 / 0 | 140 / 145 | 2 / 2 / 2 |
| ambiguity_one_harmonic_source | 110 / 117 / 0 | 30 / 145 | 1 / 1 / 2 |

The 16 source-truth controls total 3940 TP/186 extra/1266 missing, 1490/2550 exact cells; 33/50 reference events match among 48 predictions. Phase native-poly had 3128 TP/305 extra/2078 missing, 1350 exact; this route helps three-voice mixtures but does not solve four-to-six voice recall or quiet-late loss. High vibrato singleton 67 gains 73 extra note-frames; singleton partners have small release overruns too. Adapter auto has 264 wrong-stream cells and 31/50 matched events among 74 predictions; forced mono has 850 TP/77 extra/4356 missing and 5/50 matched among 29, deliberately refusing predicted multi-pitch spans, without claiming its missing-poly denominator a standalone mono failure.

The two ambiguity descriptions are **byte-identical PCM** and produce identical raw tensors/events, verified independently of ZIP timestamps. Native output favors both octave sources; source-count scores therefore differ under the two descriptions. This is not unique-source identification. Tonal-noise cases emit 321/332 note-frames at two gains. Their narrowband energy can legitimately resemble notes; intent-based abstention remains a separate diagnostic, not an acoustic oracle or acceptance credit. No source-truth aggregate silently includes these four ambiguous cases.

## Reference resources, context and cancellation

Named hardware: Intel i7-1165G7 @ 2.80GHz, 4 cores/8 logical CPUs, Linux 7.0.0-42, CPython 3.12.3, ONNX Runtime 1.23.2 CPUExecutionProvider, librosa 0.11.0, NumPy 2.5.4. Exact resolved versions and load observations are retained. OMP/OpenBLAS thread env=1; **ORT session defaults were unchanged and inference used multiple CPUs**. No GPU or exclusive-host claim. Cold imports .70–.85s and model load .015–.023s; four smoke neural calls were14.5–16.4 ms. Whole-process `/usr/bin/time -v` logs include startup/serialization separately.

Uninstrumented official `Model`/`predict`, after one graph warm-up, on repeated whole SS3 DEV audio (resource workload, no accuracy labels/crops):

| Duration | Prediction wall s | Peak RSS before serialization KiB | Events |
| --- | --- | --- | --- |
| 30 | 0.987 | 350112 | 143 |
| 300 | 5.795 | 572412 | 1469 |
| 600 | 15.524 | 799228 | 2932 |

30 s total-process wall 2.26 s/user CPU 4.01 s; 300 s 8.65 s/19.08 s; 600 s 20.17 s/39.54 s, all exit 0. `pure-*.stderr` preserves full RSS including subsequent tensor serialization; the table separates inference peak from artifact compression. Additional instrumented runs retain every input window/raw tensor and have higher ownership costs; they are not used to claim a smaller runtime footprint. Python 300 s is about 559 MiB RSS before serialization, **not WASM memory**. Libraries, whole-file PCM, concatenated outputs and decoder scratch contribute; no inference about passing or failing128 MiB WASM/96 MiB JS is made from this RSS. Model size alone predicts neither.

32 sequential existing **2.56s** windows at **.64s** origins (14.4–21.3 ms individual graph calls; two model windows per call): reference prediction p50 **43.7ms**, p95 **45.5ms**. These timings include file load/internal resampling/official decoding and capture copies, exclude sidecar compression and wire feature assembly, and are unpaced CPU Python measurements. No queue, browser worker, browser allocation, DOM or steady acoustic event-delay pass is claimed.

Using the existing warmup/future interval `[.64,2.24)` without moving it, whole/window note sets disagree at **352/2560=13.75%** fixed 20 ms cells. `resources/live.json` retains every disagreement and source origin. This is agreement evidence, not truth accuracy or a proven minimal context. The ONNX graph includes time/frequency-wide `ReduceMin/ReduceMax` normalization; exact inference depends on the full local model window in addition to convolution support. Default reverse-onset/Melodia event decoding operates over a completed prediction sequence and can revise ends. The 11-frame energy tolerance is ~128ms, but it is not the entire prediction delay. A stable causal decoder/resampler and measured output support have not been established. Existing24k/2.56/.64/.64/.32 contracts are unchanged; no longer lookahead or new budgets were silently accepted.

Long-output last-frame timestamps using the official correction are29.984610,299.986703,599.985017s for30/300/600s inputs; output lengths2597/25974/51948. Irregular original endings retain their original sample-count durations and pass all258 wire adaptations. These checks prevent simple accumulated-index drift; they do not prove onset accuracy or streaming seams. Input impulse at 1 s has zero batch resampling peak displacement; actual causal filter buffering remains unmeasured.

The reusable CLI was interrupted during 300 s processing: **exit130 in145ms after SIGINT, no published result** (`cancel.json`, stdout/stderr retained). A subsequent short CLI inference matches the frozen C6 result/features exactly, proving retry in a fresh process. NaN input fails with exit2 before publication; finite rate/length/byte validation and pinned model hash are enforced. Publication uses an owned temporary result and atomic rename. Reference native-call cancellation has no cooperative callback inside ONNX execution; the signal is handled at a Python boundary. Browser cancellation/linear-memory disposal are **untested**, and process termination is only an isolated native feasibility result.

## Why no Rust/WASM build was attempted

The agreed conditional gate stops runtime work when the reference fails note quality/retention. This candidate fails F1, recall, mono, negatives, dim, C6/madd11, late exactness and paired singleton controls. Therefore no tract dependency or browser model was installed and no production manifests/artifacts changed. This is an evidence-based stop, not missing browser performance disguised as a pass.

The independent review verifies tract main `b947b78e3e5ff01db7d276788cfee9b96b76e721` needs Rust 1.91. **Rust 1.89 was not upgraded.** Any later authorized runtime experiment must pin and actually build a compatible older release on 1.89, with an isolated lock and target. `resources/operators.json` inventories the chosen ONNX graph's exact domains/opsets 15/ai.onnx.ml 2, nodes, attributes, shapes/constants and initializer bytes; the model was converted by tf2onnx 1.15.1. Successful ORT execution is not tract operator support. MirrorPad/reflection, convolution/downsampling, shape/slice, global min/max normalization and Div/Where paths need exact coverage, then numeric/event parity and actual browser compute/memory. Python scores cannot be combined with the different TS weights to bypass that proof.

## Concrete reusable deliverable and next boundary

`adapter.py` provides actual official-model inference, pinned-hash validation, raw tensor/input/event capture and an explicit limited Rust-schema scoring shell. `evaluate.py`, `profile.py`, `profile-reference.py`, `additional.py`, `summarize.py`, `verify.py`, `launch.py` and all retained outputs are reusable. No installation instructions substitute for results: the example output, all 86 model runs, 258 scorer adaptations, 32 live-sized measurements, 30/300/600 s profiles and cancellation actually ran.

Run from repository root, always with **new output paths**:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 target/learned-recognition/launch.py \
  target/learned-recognition/adapter.py \
  --input target/learned-recognition/evaluation/synthetic/dev_chord_23_C6.f32le \
  --sample-rate 24000 --mode polyphonic \
  --output target/learned-recognition/NEW-example.json
PYTHONDONTWRITEBYTECODE=1 python3 target/learned-recognition/launch.py \
  target/learned-recognition/verify.py
```

`launch.py` uses the owned environment with normal child-process argv because this T3 shell reports the AppImage as Python's executable; the initial venv bootstrap lacked ensurepip and was repaired locally with pip's `--python` into the owned venv. Minimal missing reference imports (mir_eval/resampy/setuptools 80.9) were installed only there. Upstream inference files were never patched. Original corpus/evidence directories are not output destinations. Evaluation intentionally refuses an existing `evaluation/`; archive existing results and update an owned run directory before a new scientific evaluation, never overwrite frozen evidence.

A later *passed* provider should accept finite 24k PCM plus segment origin/available support/cancellation; internally resample with exact original-sample timestamp mapping; return bounded note/onset/contour evidence and a valid-output interval with weights/runtime/preprocess/decoder identity. Rust backend retains jobs/media/cancellation. Browser keeps local PCM in its existing worker/ownership lifecycle, with explicit capability failure rather than silent upload. Correct note evidence would feed the existing chord mapper under separate review; do not fill missing notes from intended chord templates. Genuine spectral alignment features, tuning, bass and evidence levels require meaningful implementations or an explicit contract amendment, not these scoring placeholders.

Before any adoption: exact weight redistribution provenance, checkpoint/split audit by an authorized data custodian or new independently recorded rights-cleared guitar evaluation, the original note gates plus all 244 dim/required truth controls, then a pinned 1.89 native/WASM runtime with tensor/event parity, actual p95 compute <=500 ms/event delay <=1.5 s,128 MiB WASM/96 MiB JS,300 s <=120 s refinement/native 600 s original resource limit, reliable seams, irregular/pause endpoints, cancellation/disposal and independent post-freeze validation. Chord/root/quality/primary/bass/boundary gates remain separate and unmet. No user manual QA is needed.

**Next recommendation:** do not tune these same DEV thresholds or integrate this checkpoint anyway. The real-event gains justify preserving this replaceable reference harness. The failed low notes, doubled/defining tones, dim aliases and vibrato need a different demonstrated provider/data experiment with independent real guitar recordings; this report does not claim every learned recognizer will fail, select an unmeasured successor, or call offline refinement live.

## Attestation and ownership release

`verification.json`: 161 protected source/scorer/manifest/lock files rehash unchanged; 122 downloaded upstream files unchanged; phase binary identity correct; model/input/event associations and exact-signal pair verified; CLI parity/invalid-input/cancel checks pass. This inventory's scope is explicit, not a claim that every preexisting untracked file was reviewed. `evidence-inventory.json` hashes owned source/reports/inputs/outputs/licenses excluding private dependency/JIT caches, and associates this report. No original score/label/report was overwritten. No root Cargo/npm lock, generated WASM, UI, runtime or core changes; no holdout execution, production/DB/credentials, commits, push, deploy, sibling checkout or child agent.

All owned subprocesses finished; no servers or browsers were started. Exclusive ownership is released. **Reference candidate rejected; Rust/WASM and full product acceptance remain unproven.**
