# Current pure-engine development review — 2026-10-31

Independent Astra review for root; development triage, not acceptance. **Assign DSP fixes before claiming musical reliability.** Current real omissions are confirmed; several old octave/family findings changed materially. No holdout detector execution, rebuild, source/corpus/label/lock/threshold changes, services, or delegation occurred. Only this new document and ignored result/scratch artifacts were written.

## Reproduction and provenance

Reviewed executable SHA-256: `d933b4ef53fd70849c900203a9e5e31407a7d20da86f9ed933bdc7570e2ac659`.
Copied with `shutil.copyfile` (not a hardlink) at 14:29:42 UTC to
`validation/real-audio/results/snapshots/review-20261031T142942Z/analyze-pcm`, made read-only/executable, verified before/after copying and after probes. `snapshot.json` records observed source hashes, dirty state and revision. No rebuild: source lines below describe observed checkout source; matching the builder's recorded binary hash is not independent proof of binary/source association.

Commands, from repository root:

```sh
python3 validation/real-audio/evaluate.py --binary validation/real-audio/results/snapshots/review-20261031T142942Z/analyze-pcm --split dev
python3 validation/extended-audio/evaluate.py evaluate --binary validation/real-audio/results/snapshots/review-20261031T142942Z/analyze-pcm
python3 validation/real-audio/development_probes.py --run validation/real-audio/results/dev/d933b4ef53fd7084-2gfkb4_g
python3 validation/audio/selfcheck.py
```

Evidence locations (relative to repository):

- **R:** `validation/real-audio/results/dev/d933b4ef53fd7084-2gfkb4_g/`. Complete run 14:29:46–14:29:55 UTC, all three DEV recordings. `report.json` preserves commands, PCM hashes and configuration; named recording JSONs are raw outputs. `probes/evidence.json` and WAV crops reproduce the three fixed examples.
- **E:** `validation/extended-audio/results/20261031T142946Z-u1q13924/`. All 12 supplemental DEV inputs; `report.json` contains counts and examples, alongside raw outputs.
- **S:** `validation/audio/results/rust-dev/20261031T142656.939008Z-1b3d0dc7/`. Existing current-binary all-mode synthetic result, not rerun. Read auto raw C6/transition output, labels and recorded score evidence.
- **P:** `validation/real-audio/results/snapshots/review-20261031T142942Z/`. `probe.py`, `gate.json`, `probe-summary.json`, raw PCM and raw output JSON. The script reconstructs the source spectral gate in NumPy over original full DEV decodes, then invokes the frozen executable on explicit scratch signals. Gate values are a source-model reproduction, not internal instrumentation of the binary. The script's output destinations are scratch artifacts; preserve this completed run when repeating elsewhere.

Input settings: 24 kHz mono float PCM, auto, A4=440 Hz, sharps. Original and supplemental immutable inputs remain untouched. Evaluator/schema success establishes valid output, not accurate music.

## High: real pitched input is rejected before pitch fitting — accepted

R confirms both note streams empty and `no_chord/unpitched`:

- Jazz comp 3.60 s, annotated [57,60,64], event 3.50–3.64 s. The 400 ms crop has RMS −32.25 dBFS and strong 220/262/330 Hz evidence.
- Rock solo 4.20 s, annotated [64,69], event 4.18–4.34 s. Crop RMS −34.14 dBFS, strong 330/440 Hz evidence.

These are not failures of the absolute silence threshold (`config.rs:7`, 0.00004 RMS), nor simply a wrong output stream. `segments.rs:149` emits this reason when the frame's tonal flag is false. `lib.rs:123–132` suppresses the entire fit, and `lib.rs:146` suppresses YIN too.

P reproduces distinct vetoes at the actual 20 ms cell centers:

- Jazz center 3.61 s: RMS 0.0492795, flatness **0.469453**, tonal fraction 0.665171, estimated noise 0.0246150. Flatness exceeds 0.4 despite concentrated pitched peaks.
- Rock center 4.21 s: RMS 0.0182420, flatness 0.287911, tonal fraction 0.620682, estimated noise **0.0162278**. It fails `rms > noise*1.3` and the flatness escape `<0.08`.

`lib.rs:120–124` updates noise only when flatness exceeds 0.4; it does not decay on subsequent tonal frames. A broadband guitar attack can therefore leave a persistent floor that vetoes later decay. `spectrum.rs:65–74` computes magnitude flatness across 35–6500 Hz, so broadband room/pick energy can veto genuine narrowband notes. These mechanisms are strongly supported by reason codes and reproduced values; the exact classification of the original noise remains uncertain.

**Fix request:** redesign tonal eligibility/noise tracking so sustained local harmonic evidence can survive broadband accompaniment/attack energy. Do not simply lower every threshold. Add focused tests pairing pitched decays after noisy attacks with noise-only/percussive negatives, across gain levels and noise levels; inspect the two fixed real intervals as regression examples. Measure false positives alongside recall. The intended change is recovery of independently supported pitches, not forcing the sheet's chord.

## High: greedy shared-partial allocation loses voices and admits aliases — accepted

The source is independent of chord templates: `polyphony.rs:23–249` uses observed peaks, and `chords.rs:80` receives its notes downstream. There is no evidence of notes manufactured from chord names. **A spectral peak is nevertheless not independent evidence of another fundamental.**

Concrete structural issues:

- `polyphony.rs:68` assigns the full measured amplitude of every matching peak to each candidate. Once a lower candidate wins, lines 164–190 let it consume that shared energy. Coordinate refitting cannot reconstruct a higher voice that was excluded before joining the active set.
- Lines 120–132 explicitly skip candidates at integer harmonics 2–32 of an active lower note, even if the upper voice has real support. The later recovery at 225–237 is restricted to +12/+19/+24 semitones and requires the upper fundamental amplitude to exceed the lower fundamental by 1.3, plus another peak. That is a heuristic for spectral shape, not a general independent-voice test.
- Candidate fundamentals need only be observed (`81–82`); a one-peak candidate is allowed. Non-integer/inharmonic residual peaks can become notes while genuine shared fundamentals disappear. The recovery pass also uses fixed support 0.72 (`241`) without refitting residual energy.

Current repros:

- S `auto/dev_chord_23_C6.raw.json`, 0.70 s: [48,52,57], expected [48,52,57,60,67]. Output Am/C over 0.40–1.72 s; PC exact remains zero. Missing G4 is a fifth harmonic of C3, and C4 an octave, exactly the family of suppression above. This is an observation failure, **not** a demand to choose C6 over equivalent Am7. Proving attribution of each masked voice still requires inspection of its peaks.
- E Amadd11 capo0 at 0.45 s: [45,50,57,60,69], expected [45,50,57,60,64]. Old B5/F#6 example is stale, but missing E4 and extra A4 remain. Compatible primary remains 0/60. Capo3 improves to 41/60, so the old combined 0/120 claim is stale.
- E E5 capo0 at 0.41 s: [40,47,59,64,66,71], expected [40,47,52]. Capo3: [43,50,55,69,74], expected [43,50,55]. Both have zero PC-exact and zero compatible-primary frames (62 each); capo3 regressed from 46/62 primary. Both now abstain throughout with compatible alternatives; that is not correct primary identification.
- E Amadd9 capo0 at 0.45 s adds 57 to the correct five-note set. Both transpositions get all 60 PC/primary frames correct while exact MIDI remains zero: PC/chord success masks extra register errors.
- R SS comp at 3.20 s now outputs [53,57,69], not old [53,57]. **Missing A4 is stale; unannotated A3 remains.** F4's absence is not independently proved by its shared F3 harmonic. The F-major alternative correctly lists missing C; do not invent C from the sheet.

**Fix request:** one DSP owner should improve shared-partial attribution and upper-note admission together, preserving the observed-fundamental requirement or explicitly representing weaker missing-fundamental hypotheses. Test isolated bright single notes against true octave/fifth doubles, independent two/three-note mixtures, transpositions and unequal decay envelopes. Require both precision and recall; removing upper notes globally would merely exchange one failure for another. P's one-second bright A3 control (220/440/660/880 Hz, amplitudes .05/.10/.04/.05) correctly emits only A3 in mono: preserve that counterexample rather than assuming every bright harmonic produces a phantom.

## High for live integration: short valid buffers can emit false multi-note results — new

P feeds a pure 440 Hz sine at amplitude .1, no padding, into the frozen CLI. 20 ms and 40 ms produce no note events (consistent with the three-hop minimum); 100 ms also produces no note events. **60 ms produces polyphonic MIDI [67,68,69,70,71], each 0–0.06 s**, although only A4 was generated. Raw evidence is `short_60.json` and the hash-recorded PCM. These are hard-truncated tones, not realistic plucks, but valid finite input and a useful edge counterexample. The claim is false-note behavior, not that every 60 ms guitar note must be identifiable.

Likely mechanism: the 170.7 ms centered FFT window is mostly zero-padded for short input (`spectrum.rs:36–57`), producing broad/side-lobe peaks; peak-to-candidate fitting admits them, while the periodic mono override does not rescue the frame. This is a source-supported hypothesis, not an instrumented proof of each selected peak.

**Fix/test:** under-supported short windows should abstain or retain only defensible pitch evidence, not populate nearby semitones. Test truncated and smoothly windowed tones at varied lengths/phases, and deliberate nearby two-note mixtures. Avoid a blanket adjacent-note ban. The WASM adapter must not call this batch API independently on capture chunks and concatenate results. The architect owns the stateful contract; the DSP owner owns valid-window evidence and matching tests.

## Medium: timing and harmony segmentation need qualified treatment

S transitions are staggered physical strums with overlapping prior notes, not instantaneous chord switches. Dadd9 at 2.70–2.76 s overlaps old Am through 2.75 s (E is still present); Gadd9 at 3.78–3.88 overlaps D through 3.85 s (A is still present). These are plausible intermediate acoustic identities, not sufficient grounds for smoothing away notes. Brief unknown spans during attacks are also legitimate uncertainty. Boundary F1 54.55% does not by itself isolate a defect.

There are actionable timing hazards:

- The unpitched gaps 1.28–1.48, 2.38–2.58 and 3.48–3.74 s warrant the same gate investigation as real omissions; no intentional silence is labeled there. Broadband strum energy can coexist with old/new pitches.
- `segments.rs:96–104` requires three frames **per routed stream**, while routing is chosen per frame at 76–87. A stable note can be lost if mono/poly routing changes before either stream accumulates 60 ms. Assess routing stability separately from true attacks; current real mono recall is particularly poor.
- `segments.rs:167–178` splits harmony on bass MIDI, then `187–200` demotes any chord segment under 60 ms. Bass flicker can demote an otherwise unchanged chord. Test a constant observed chord with uncertain/changing bass, retaining bass events without declaring a new harmonic attack.
- Centered windows require future audio (85.3 ms short, 170.7 ms bass), plus temporal support. Reported 20 ms timestamps are not wall-clock detection latency. No streaming latency or chunk-invariance claim was tested here.

Do not treat every extra event as flicker or use a long smoothing window to improve the headline. Test actual note reattacks, releases and overlapping strums alongside constant-chord stability.

## Supplemental status and uncertainty semantics

All six grips were independently specified by the tester; this review did not derive truth from detector templates. Current settled counts (exact MIDI / exact PCs / compatible primary, followed by denominator):

- Amadd9 capo0: 0 / 60 / 60 of 60; capo3: 0 / 60 / 60 of 60.
- Cadd11 capo0: 0 / 9 / 9 of 60; capo3: 0 / 60 / 60 of 60. Register-dependent failure accepted.
- Amadd11 capo0: 0 / 0 / 0 of 60; capo3: 0 / 41 / 41 of 60. Partly improved, not fixed.
- Bdim7 capo0: 24 / 24 / 0 of 61; capo3: 51 / 51 / 0 of 61.
- Bhdim7 capo0: 0 / 0 / 0 of 61; capo3: 60 / 61 / 0 of 61. Capo0 now has extra pitches, despite all four true notes recovered.
- E5 capo0 and capo3: 0 / 0 / 0 of 62 each. Accepted/regressed.

All 244 dim7/hdim7 frames abstain with compatible alternatives. Reject the interpretation that this alone demonstrates broken vocabulary support or should be fixed by choosing arbitrary roots. `chords.rs:138–165` preserves low-margin ambiguity; alternatives never count as primary correctness. Bass is correct on all 728 supplemental frames but cannot rescue wrong notes or establish intended root.

Evidence scores are heuristic, not calibrated probabilities: `polyphony.rs:199–203` normalizes amplitude against other selected candidates; `segments.rs:104` supplies a fixed note margin .25. Consumers must preserve that distinction. Harmony merging retains the first event's candidate/evidence payload (`segments.rs:171–172`); it does not aggregate evidence over the merged span. This is a contract caveat for live consumers, not a reason to fabricate stronger certainty.

## Current real measurements and remaining gaps

Raw R separate-stream mono recall: Rock 8.36%, SS 21.37%, Jazz 9.09%; precision 100% for all three. Poly precision/recall: Rock 68.01/51.68%, SS 67.91/61.43%, Jazz 61.24/34.69%. The current fit improves some poly recall but substantially hurts mono coverage relative to the old snapshot; Rock poly precision also falls. Wrong-stream poly emissions on mono-reference frames are 512/331/167. Union diagnostics cannot replace these required stream scores. This is why DSP changes need independent regression measurements, not one improved aggregate synthetic number.

The updated `validation/audio/harness_checks.py:216` uses .2 s instead of .03 s. This review's complete selfcheck passed all 18 tests, including timeout diagnostics and 102 frozen input checks. Treat the old intermittent timeout assertion as stale timing evidence, not a current musical defect; one pass cannot prove it never flakes. No harness patch requested on present evidence.

GuitarSet MIC and pickup-derived per-string labels can disagree in audibility and timing. Shared harmonics do not prove a separate string voice; sheet roots and solo context do not prove simultaneous acoustic harmony. Crops and FFT evidence here have no independent human listening adjudication. Supplemental takes share one synthetic renderer and correlated transpositions; they do not establish real extended-family accuracy. Unknown equivalents remain uncertainty. Composer identity, instrument separation, distorted/full-band behavior and live microphone robustness remain outside established evidence; none is a prerequisite to fixing the concrete defects above. Holdout remains untouched by the detector and needs a later authorized freeze.

## Handoff to root

Assign the requested **different Sol xhigh DSP fixer** exclusive ownership of `crates/fretbloom-analysis/src/**` and focused `crates/fretbloom-analysis/tests/**`, prioritizing (1) tonal/noise gating, (2) shared-partial voice attribution and routing, (3) short-window false pitches. Keep the main architect and WASM/UI builders out of those files concurrently. Root should negotiate API changes separately; no source edit was made by this reviewer.

Have the fixer first preserve meaningful failing counterexamples above, then run focused crate checks and independently rerun all DEV synthetic modes, all three real DEV recordings and all 12 supplemental cases on a newly copied/hash-recorded binary. Report per-stream precision/recall, false positives, exact MIDI/PC, abstentions, and physical transition behavior; retain equivalent alternatives without headline credit. Do not adjust labels, score thresholds or acceptance gates to match fixes. Root can proceed with these bounded fixes now; this review does not claim complete musical validation or block the separate WASM architecture work.
