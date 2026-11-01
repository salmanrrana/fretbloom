# Independent validation triage

Reviewed 2026-10-31, before Rust implementation exists. Read inherited `/home/xtra/AGENTS.md`; no checkout-local AGENTS.md exists. Only this report was written. No detector was run on holdout, no real-audio files were changed, and no engine acceptance is implied.

**Decision:** the frozen development PCM is safe to use for implementation and exploratory diagnostics. Do not use the current boundary gate or merged-stream scores as acceptance evidence without the harness fixes below. Keep the corpus frozen; these findings do not call for a generator or architecture rewrite.

## Evidence and accepted findings

`PYTHONDONTWRITEBYTECODE=1 python3 validation/audio/selfcheck.py` passed all nine checks and all 102 audio/label hash checks; worst single-note tuning discrepancy was 0.46 cents. In-memory rescoring of the stored development predictions exactly reproduced `baseline-summary.json` overall counts and metrics. Focused probes below used existing data or fabricated output in memory, without writing artifacts. Existing application tests were not rerun in this review.

### 1. High — boundary gate penalizes correct note transcription

**Harness fixer:** `validation/audio/score.py:45-65`, `generate.py:133-138`.

The boundary state includes MIDI-derived pitch classes and bass as well as harmony. The reference contains only three chord strum onsets, despite staggered string attacks and 300 ms old-chord overlap. Correct physical note changes therefore become false positives. Reproduction: partition `dev_transitions` at every reference note start/end; fill each interval with `truth(case, midpoint)` and null identity/bass; call `boundary_counts`. Result: **3 TP, 5 FP, 0 FN**, F1 **54.55%**, even with exact reference note timing. Adding chord identity does not remove those note changes. The proposed 85% gate rewards suppressing real changes.

Narrow fix: score harmonic boundaries from harmonic state alone against a declared harmonic timing convention. Score note-set changes separately against timed note truth, if needed. Add this oracle probe before freezing the gate. Do not ask engine builders to smooth away real notes to pass it. Historical boundary precision 37.5% is not sufficient evidence of five spurious detector flickers.

### 2. Medium — overlap note truth is constructed but never scored

**Harness fixer:** `validation/audio/score.py:38-42,78-92`; `docs/rust-validation.md` corpus/metrics claims.

`stable()` returns nothing whenever two chord events overlap. All polyphonic counts are guarded by that result, so overlap removes note scoring as well as identity scoring. Reproduction: take the exact timed-note prediction above and erase all notes during overlap; `poly_*`, `pc_exact`, and `note_*` counts are unchanged. This is broader than the document's explanation that identity is deliberately unscored while note truth is the union.

Narrow fix: retain current settled metrics, explicitly label their exclusions, and add a separate overlap-note metric using timed union truth. Keep identity excluded there. Until then, do not claim the scorer validates release-overlap transcription.

### 3. Medium — baseline nearest-center support is implemented incorrectly

**Harness fixer:** `validation/audio/baseline.mjs:44-54`.

The adapter partitions at frame centers, then selects a nearest center once per resulting segment. Nearest-center ownership actually changes at *midpoints between centers*. A center-to-center segment spans two different frame owners; its midpoint choice assigns one owner to the entire interval, with floating-point ties affecting selection.

Reproduction: rebuild canonical predictions in memory from `baseline-dev.raw.json`, replacing frame-center boundaries with adjacent-center midpoints, retaining chord boundaries and nearest-center selection. Sustained mono changes **42.03% → 43.32%**, early mono **54.04% → 54.78%**, overall negative false positives **49.86% → 48.14%**. Root/quality are unchanged. Narrow fix: use midpoint support, rescore development, and refresh baseline summary/prose. This is an adapter correction, not a request for a replacement TS engine.

### 4. High — failed reruns can leave a success score beside failure metadata

**Harness fixer:** `validation/audio/rust_eval.py:64-95`.

The runner reuses `results/rust-<split>` and never invalidates an existing `score.json`. After a successful run, a decode/process/schema failure exits at line 93 with the old score still present. Raw output is removed only after decoding succeeds, so a decode failure also retains the prior raw output. Failed subprocess stderr is captured but not saved; only successful analyzer stderr is written. `str(CalledProcessError)` omits the diagnostic text.

Malformed streams also escape bookkeeping: setting `monophonicNotes` to null raises `TypeError` in `adapt` (confirmed in memory), which line 84 does not catch, so even run metadata can remain stale. Canonical validation occurs only in final `score()` outside the per-case failure handler; e.g. an out-of-range root can fail there without a fixture failure record.

Narrow fix: use a fresh run directory or invalidate all current-run outputs before execution; validate each adapted prediction inside the per-case handler; convert malformed schema into recorded failures; retain failing stage, exit status and stderr. Publish a score only for a completely successful run, clearly associated with that run. Reproduce success-then-failure with a stub binary in fixer-owned scratch space; this review did not create one.

### 5. Medium — union scores do not validate the separate note streams or evidence

**Harness fixer, with engine owner confirming semantics:** `validation/audio/rust_eval.py:28-47`; `docs/rust-architecture.md:328-349,369-374`.

Unioning both streams is reasonable for an overall audible-note diagnostic in auto mode, but removes stream provenance and deduplicates cross-stream mistakes. All notes emitted through the wrong stream can score identically; the adapter's own test intentionally deduplicates overlapping stream entries. The architecture explicitly requires separate scoring and single-/multi-voice routing. The adapter also accepts note events without evidence/name/cents (its self-check does so), ignores evidence validity, and tests only auto mode. Correct notes alone cannot establish that the wire contract or uncertainty behavior works.

Narrow fix: retain the union diagnostic, add separate stream/routing counts and contract validation, and exercise explicit modes on dev. Validate finite bounded evidence fields without treating them as probabilities or inventing a confidence cutoff. Confidence calibration is correctly disclosed as untested; no confidence-accuracy claim is justified. Unknown harmony must continue to remain null, without promoting alternatives.

### 6. Medium — frozen input verification is separate from evaluation

**Harness fixer:** `validation/audio/rust_eval.py:63,86-89`; `selfcheck.py:106-116`.

Selfcheck verifies the frozen lock, but the runner never calls that verification or checks WAV hashes itself. Altered WAV bytes with unchanged manifest are evaluated and recorded under the same manifest hash. The documented direct runner command can therefore produce apparently frozen results from changed audio.

Narrow fix: check manifest and selected WAV hashes against the lock before launching the binary, and record the input inventory. Keep the lock unchanged. Record source revision/configuration/machine as already required by the evaluation procedure; the current binary hash alone is not that complete provenance.

## Baseline triage for builders

- **Accepted engine defect to address in Rust:** the low-note failures are real development failures, not just quiet tails. On E2/F2/B2/A2 (`dev_note_00..03`), independent early-window RMS is respectively **−31.3, −26.9, −24.2, −29.6 dBFS**, tuning checks pass, and each has **0/17** early exact frames. Use these as Rust development checks; there is no need for a parallel TS rewrite. Energy/tuning evidence does not by itself diagnose the failing algorithm.
- **Accepted timing problem, magnitude qualified:** silent-margin detections remain large after midpoint correction (48.14% overall reference-empty false positives). Dedicated silence/noise/percussion remain clean in these three development clips. Engine builders should check original timeline support and state release; centered windows and smoothing are plausible causes, not proven diagnoses. The harness fixer owns correcting the baseline percentages first.
- **Historical capability limits:** triad-only labels, singleton predominant MIDI and absent bass explain extension/polyphonic/bass failures. They are not regressions in capabilities the TS engine possessed. Rust builders own the requested new capabilities; no synthetic note set or root-as-bass substitution is acceptable. Evaluate completed Rust independently later.

## Coverage and metric qualifications

The handwritten standard-tuning voicings are musically consistent with their declared pitch classes, including C/E and D/F# basses; grips are plausible compact guitar shapes. String indices are explicitly low-to-high (not conventional high-E string 1). No detector imports, template-derived predictions, manifest-derived musical output, or promotion of unknown alternatives was found. The adapter reads duration/IDs for transport only. Shapes and labels are public to builders, and capo/renderer variants are correlated: holdout is process-separated, not statistically independent real guitar.

Sixth/minor-seventh, suspended and augmented equivalences are handled reasonably within the declared vocabulary. Power chords get note/bass scoring but **no compatible-identity denominator**, so this corpus does not establish correct `5` identity support. Minor-sixth equivalence to half-diminished is outside the generator's truth vocabulary; if full wire-vocabulary ambiguity becomes an acceptance claim, add the equivalent candidate in a deliberate new label version rather than penalizing it silently.

All selected IDs are required, duplicate/missing predictions fail, and null identities fail eligible denominators rather than being skipped. Null precision for no predictions must not be called a pass; recall/F1 still reveal misses. Counts are 20 ms samples, not independent examples. Settled windows exclude attacks/releases/overlap; note precision/recall omit negative spans, whose false positives are reported separately. `score.py:145-147` groups the mixed transition phrase under its first quality (`transition:maj`), including its Am event: do not interpret that group as major-only accuracy. Narrow fix is event-level grouping or a `transition:mixed` label.

Thresholds remain provisional: fix the impossible boundary gate first; report per-fixture failures alongside the duration-weighted gates. The 1% negative target rests on only one clip of each negative type per split, and silent-margin 10% depends on a timing convention. Pitch labels persist into natural decay, potentially near the quantization/noise floor; early-window metrics help, but late/high-note failures require audibility inspection before blaming the detector. Autocorrelation near the expected frequency verifies tuning, not realistic polyphonic spectra or real-instrument recognition.

The renderer is useful plucked-string PCM, with realistic-enough harmonic decay for a development challenge, but no measured guitar body/room/pickup response, playing noise, mixed music or full-song structure. **102 synthetic clips do not prove real guitar or song accuracy.** Licensed real-audio work remains with the separate evaluator. Builders can proceed now with the frozen dev audio and qualified settled metrics while a separate harness fixer resolves the findings above. No Rust result has been reviewed or accepted here.
