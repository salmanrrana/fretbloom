# Pinned GAPS reference evaluation — NO-GO at A2

2026-10-31. **Reject this selected checkpoint with its unchanged reference/default decoder for the requested recognition contract.** A1 passes its original settled low-note gates. The first A2 low-A pluck emits no notes and misses the required reattack. Only its five paired diagnostics were completed; the remaining 30 A2 inputs, B–D, full DEV, live variant and Rust/WASM work were not run. Runtime completion is not musical acceptance. Keep active 3.1; all existing musical acceptance failures remain open.

Worked alone, no children. All implementation, archives, weights, environment, caches and outputs are in ignored `target/gaps-reference-builder/**`; this is the only new report outside it. No product integration, corpus generation/edit, training, threshold search, alternative checkpoint, original holdout access, baseline rerun, manual QA, shared-cache writes, host configuration, production, databases, upload, commit, push or deployment occurred.

## Exact artifact and safe execution

Independent primary metadata and downloaded-byte checks agree:

| Artifact | Pin / SHA256 |
| --- | --- |
| HF revision | `b7bec65a2b860aca72856b0feef58b5df407b777` |
| Only downloaded weights | `guitar-gaps.pth`, 99,178,877 bytes; `65483e7c0e340a90415b15b520687587698c8c728f5fa470a205f13ee45c6513` |
| Wrapper revision | `96f6797881e9497cbfc8f8e5deccea9c1f2f7adc` |
| Actual inference fork revision | `7568dc7f78b625e40cf9776e2806d164006610e3` |
| Primary predeclaration | `5b90f4f6ad9c4d94fe9494940b4e2304921d635235d8cc6aed7db6da83d7c842` |
| A2 supplementary predeclaration | `1fb2d714a7591fadd91ecfad74ad8440f96f82c08aa196d4927473da491a57a3` |

[Acquisition receipts](../target/gaps-reference-builder/acquisition.json) retain pinned HF blob metadata, model card, GitHub commit API responses and source archives without `.git`. [Primary freeze](../target/gaps-reference-builder/predeclared.json) binds 84 input/code/scorer/configuration files; [A2 freeze](../target/gaps-reference-builder/a2-predeclared.json) binds all 36 exact selected PCM files, requests and six ordered paired groups before any A2 prediction. Both retain defaults, limits, outputs and gate order. A2 adds the explicitly authorized next selection after A1 passes; it changes no model, frontend, decoder or scoring threshold.

Static pickle inspection found tensor reconstruction plus numeric NumPy metadata. `weights_only=True` succeeds with an explicit NumPy ndarray/reconstruct/dtype allowlist, including float64 and int64 dtype classes. PyTorch 2.5 lacks alias-tuple support, so the known NumPy reconstruct symbol receives its legacy module alias only during safe loading, then is restored. No `weights_only=False`, arbitrary object allowlist or unsafe fallback executes. The checkpoint additionally contains iteration 5000 and numeric sampler indexes, not a sufficient training/split manifest.

[State coverage](../target/gaps-reference-builder/state-coverage.json): **316/316 keys**, matching shapes/dtypes, finite tensors, no missing or unexpected keys, strict load. Total state bytes 98,655,820; parameter bytes 98,607,612 include the frozen frontend parameters. Each state tensor has a retained hash. The adapter directly constructs `Regress_onset_offset_frame_velocity_CRNN`, safely loads all of it, and executes the actual network. It bypasses only the unsafe/non-strict constructor. Published `transcribe`, `enframe`, `deframe`, forward and decoder source remain byte-identical. The wrapper identity `forward` is never used.

CPU-only PyTorch 2.5.1+cpu, torchlibrosa 0.1.0, librosa 0.11.0, soxr 1.1.0 and NumPy 2.5.4 are pinned. Seeds 0, CPU intra/inter-op threads 1, batch 1, deterministic algorithms and evaluation mode are recorded at execution. A second complete first-input execution produces **bit-identical four-branch window tensors and identical fractional events**. All ten completed inputs exit 0; these are ten unique inputs plus one repeated model execution, not broad DEV acceptance.

## Frontend, timing, tails and scoring boundaries

Finite mono little-endian 24 kHz f32 PCM requires integer original origin/count and an exact supplied support extent. Unsupported tuning correction/options reject explicitly. Internal resampling uses pinned `librosa.resample(..., res_type='soxr_hq', fix=True, scale=False)` to 16 kHz, with no gain normalization. Fractional note times retain their original values; clipped valid note spans also map to original sample coordinates.

[Frontend checks](../target/gaps-reference-builder/frontend-checks.json) verify centered 2048 Hann/reflect STFT, hop160, 229 mel bins30–8000 Hz, log reference1/floor1e-10/no top-dB, and the checkpoint's fixed mel filter. Against independent librosa frontend calculations, maximum absolute STFT-power/log-mel differences are 8.35e-7/1.53e-5. Seven resampled sizes match ceil(2N/3). An impulse at input 24000 peaks at output 16000: zero batch timestamp displacement. A separate streaming filter probe returns no output on its initial 480-sample chunk and retains up to 470 output samples in the five measured steps. Batch delay compensation is not a zero-latency streaming claim. No label-selected alignment is applied.

All scored inputs are1.6–2 seconds, padded by the unchanged reference to one10-second segment. Raw windows are `[1,1001,88]` and deframed outputs `[1001,88]` for each of onset/offset/frame/velocity. Their excess8.01/8.41 seconds are preserved. The upstream sample-count-on-frame-array trim is not corrected or called valid. Every A1 event extends to6.25 or6.2600002289 seconds; each is explicitly clipped to the authoritative2-second input for scoring. All four original starts/ends and clipping records remain available. No A2 tail events exist.

The actual underlying decoder records onset .3, offset .3, frame .1 and pedal-offset .2; original regression and two/four-neighbor rules are unchanged. Native union event IDs survive the separate scoring shell. Its optional auto/mono routes depend only on predicted distinct pitch count; segments never merge different original events. Eight focused checks cover nonfinite PCM, count/origin/support/options/cancel rejection, adjacent-event identity and the4000-note cap.

The shell explicitly marks harmony, bass, cents/tuning, confidence and alignment unsupported. Its unknown harmony/null bass, zero cents/evidence/chroma and null feature MIDI are **compatibility placeholders**, not measured musical fields or earned product gates. RMS alone is measured there. The existing4000-per-stream/3000-harmony/1MiB-result/8MiB-feature bounds remain enforced. Union accuracy and predicted routing reports are separate.

## Ordered results and original denominators

A1 imports unchanged `validation/audio/{score,rust_eval,streams,wire}.py`. Exact frozen PCM hashes agree with both retained phase PCM and prior learned-evaluation copies. No audio is regenerated or baseline inference rerun.

| A1 input | MIDI | Early exact | Sustain exact | Full-input TP / extra / lost cells |
| --- | --- | --- | --- | --- |
| dev_note_00 |40|17/17|58/58|69/18/1|
| dev_note_01 |41|17/17|58/58|69/18/1|
| dev_note_02 |47|17/17|58/58|69/18/1|
| dev_note_03 |45|17/17|58/58|69/18/1|

Union early 68/68 and sustain 232/232 pass95%/90%. Full-input exact is324/400, with72 extra and4 lost note-cells. The original scorer reports72/120 emitting reference-empty margin cells; these margins are **not** the dedicated silence/noise/percussion corpus and cannot pass or fail that separate denominator. Original mono-case aggregate `note_f1` is undefined because that scorer's settled note TP/FP/FN applies to chords; the additional union counts remain explicit. [Original complete reports](../target/gaps-reference-builder/evaluation/original-scorer-reports.json) preserve native and derived routes without substituting routing accuracy for union accuracy.

A2 predeclared six gain/phase groups, each consisting of its pluck and five partners. Group1 is MIDI45, gain .03, phase0, original 80 full-duration 20ms cells each. **Every input below produces zero raw decoded events**, not an execution error filled with fake empty success.

| A2 first paired group | Reattack hits within original21ms | TP / extra / lost cells | Exact cells |
| --- | --- | --- | --- |
| pluck |0, required1|0/0/80|0/80|
| vibrato |0|0/0/80|0/80|
| beating |0|0/0/80|0/80|
| tilt |0|0/0/80|0/80|
| neighbor |0|0/0/120|0/80|
| phase |0|0/0/80|0/80|

**Decisive failure: no target note or .8-second reattack on `45-0.03-0.0-pluck`.** The remaining paired diagnostics establish failure to admit these low-level controls, rather than successful rejection of confounders: zero extras does not excuse 520 lost note-cells. No onset activation peak is treated as a physical event.

The original acoustic scorer lives inside a top-level script that creates the frozen corpus and reruns binaries when imported. To avoid those unauthorized side effects, A2 compiles and executes its exact unchanged success-scoring `if proc.returncode==0` AST block, isolated from generation/execution. Its source hash and verbatim block are frozen. Original21ms logic and frame counts are untouched; per-frame extra/lost vectors and raw event lists are retained separately. The full module is never imported or run. [A2 decision](../target/gaps-reference-builder/a2-evaluation/decision.json) lists all 30 skipped inputs. No higher-gate claim is made.

## Execution limits, verification and handoff

Observed short-input command wall times are10.995–11.611 seconds without the repeat; the repeated first input takes16.329 seconds. Measured internal startup after base Python/NumPy imports is1.590–1.689 seconds, model loading3.083–3.514 seconds, resampling .099–.125 seconds, first reference pass5.400–5.819 seconds, and decoder .025–.034 seconds. First-pass frontend .118–.135 seconds is included inside model-forward timing, not additional independent compute. Outer command wall time includes all worker startup. Peak sampled RSS reaches1,013,116 KiB; worker high-water readings are retained too. These Python CPU measurements do not establish Rust/WASM/browser memory, throughput, p95 latency or600-second completion.

Owned process groups enforce110-second full-command deadlines,600-second input maximum,6GiB address-space and sampled2GiB RSS guards,256MiB single-file and512MiB raw-artifact guards. All successful packages publish by directory rename only after complete provider/raw output validation; failed `.partial` diagnostics are never accepted results. One cancellation after model-ready receives TERM and then bounded KILL; exit -9, no accepted output, measured .2365 seconds to reap. This is one native Python supervisor probe, not a proven browser cancellation bound. Its partial diagnostics and explicit failure status remain retained.

Dependency installation was estimated before installation:207,273,369 added wheel bytes; installed owned runtime892MiB, owned cache204MiB, weights94.58MiB. Existing727MiB numerical environment is read-only via an owned `.pth`. No CUDA wheel or global installation was used. Initial missing-ensurepip/Python-launch, incomplete-install import, and safe-loader alias/dtype compatibility failures are retained in setup/inspection logs; none caused an unsafe load or music-driven adaptation. `requirements.lock`, wheel URL/hash receipts, dependency versions and notices are frozen. [Integrity verifier](../target/gaps-reference-builder/verification.json) rehashes 29,478 installed dependency files plus both source/input freezes with **zero mismatches** and checks all raw tensor shapes/finiteness, events/clipping, execution statuses and repeat equality.

All 25 active source entries match the preserved3.1 archive. Native remains `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`; generated WASM remains `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`. Normal 245-test/build results are prior root evidence, not rerun or repurposed as music acceptance here.

The [HF model card](https://huggingface.co/xavriley/midi-transcription-models/blob/b7bec65a2b860aca72856b0feef58b5df407b777/README.md) explicitly declares MIT: positive publisher weight-license evidence. Wrapper/inference MIT metadata remain separate declarations; neither inspected archive contains its referenced full LICENSE. All source/metadata notices are preserved. Dependency notices include separate native libraries and soxr's LGPL declaration. GAPS dataset restrictions, GuitarSet/piano pretraining sources and exact training association remain separate unresolved provenance matters; no dataset download is required or performed. GuitarSet remains potentially training-exposed; Guitar-TECHS exclusion is unproven. This package does not approve redistribution or production rights.

Reusable [adapter](../target/gaps-reference-builder/adapter.py), [launcher](../target/gaps-reference-builder/launch.py), [scoring shell](../target/gaps-reference-builder/scoring_shell.py), exact [commands/statuses](../target/gaps-reference-builder/verification.json), raw outputs, [artifact hashes](../target/gaps-reference-builder/evidence-inventory.json) and [handoff](../target/gaps-reference-builder/handoff.json) are retained. Commands executed from the repository root:

```sh
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/contract_checks.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/freeze.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/check_cancel.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/run_a1.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/freeze_a2.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/run_a2.py
/usr/bin/python3 target/gaps-reference-builder/launch.py target/gaps-reference-builder/verify.py
```

The direct adapter accepts `--input`, `--request`, `--output` and optional `--repeat` through the launcher; output must be a new owned directory. Frozen runners intentionally refuse old destinations. Setup/frontend/inspection commands and failures are retained separately. All final listed commands exit0; their passing execution does not change the A2 NO-GO.

**No next eligible gate within this package.** No gain adjustment, decoder tuning, other checkpoint, live variant, full DEV expansion or port follows the failed reference. The unchanged10-second/bidirectional reference already needs roughly2.5–7.5 seconds interior future support by source inspection, exceeding the1.5-second live contract even if offline accuracy passed. All owned workers are stopped and ownership is released. Root owns separate independent review/testing and any later architecture decision; no self-approval or deployment recommendation is made.
