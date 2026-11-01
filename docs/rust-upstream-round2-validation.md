# Round 2 — independent tester, phase 1

Phase 1 complete. No candidate binary was inspected or executed. Baseline remains rust-dsp-3.1. This report makes no accuracy improvement or adoption claim.

Frozen **2026-10-31T19:05:00.640483+00:00**, before first baseline analysis **2026-10-31T19:05:00.719089+00:00**. Manifest SHA256: `cd66d9015fd8c31d0dcea4ac84e674899607287cb53351119ce081d1953bf4f6`. [Freeze](../validation/upstream-round2/freeze.json) binds generator, scorer, thresholds, manifest, bounded runner and future unchanged-scorer full-DEV driver. All script and 335 input hashes verified again after analysis.

Baseline native SHA256: `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`. Canonical source digest independently reconstructed from generated manifest tools and verified source map: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`. [Identity](../target/upstream-round2-test/baseline/identity.json) retains that map and the pre-analysis freeze. Builder paths were not read or written.

## Controls and conventions

335 frozen whole-input calls: **156 new inputs**, all ≤4 s (587.104 seconds total, approximately 54 MiB), **171 original acoustic inputs**, and **8 unchanged event controls**, including the full 480-second long-stable input. Thus the suggested 300-case size is exceeded when counting reused cases; newly generated PCM stays below 300 cases. No inherited input was shortened to meet the new-input bound.

- 72 vibratos: complete MIDI45/57/69/81 × excursion15/35/65 c × rate3/5/7 Hz × stable-prelude/cold-start. Gains.03/.15, carrier phases0/.9/2.4 and modulation phases0/π/2/π are cyclic balanced nuisance factors, not their full cross product. The original24 asymmetric-FM cases retain their original bytes and identities.
- 27 sustained dyads: roots45/57/69 × intervals7/12/19 × ratios.25/1/2. Relative phases, delayed/simultaneous arrival, common/independent decay, and upper-first/parent-first/common release use a fixed balanced allocation. Octave and octave+fifth remain distinct from the noninteger-ratio fifth.
- Seven new singleton negatives include Astra's byte-identical even/third/all-upper/smooth-ramp sources plus .5/2/5 Hz unison beats. Three added-octave cancellation controls span phases0/π/2/π and independent releases. All original tilt, phase, beating and neighbor controls remain.
- Eight slides/abrupt-legato cases: both directions, 0/40/100/400 ms transitions. Four held/return ±70 c bends; two simultaneous adjacent-source overlaps; seven static offsets0/±15/±35/±49 c.
- Twenty rolling2.56 s crops every.64 s: two wide vibratos, destructive-phase octave, and the full9 s late_voice source. The latter includes onset-free upper sustain and independent release. Six ordinary65536/irregular61696-sample inputs cover seam placements1.38/1.40/1.42, in addition to all27 original seam controls.

**Bend convention:** held/return bends preserve the source MIDI identity throughout. No nearest-pitch alternate score is accepted for these bends. Slides/legato switch at their ±50 c crossing; vibrato preserves its source MIDI. Static detuning preserves its intended lattice MIDI. Unison labels are MIDI union, not source count. Even/third-partial singleton constructions have an alternate phase-aligned-added-source interpretation; no contradictory two-source hard truth is assigned to identical PCM.

## Scoring and gates

[Thresholds](../validation/upstream-round2/thresholds.json) freeze Astra's numbers: vibrato one correct run, ≥95% target coverage, no extra MIDI/internal dropout, ≤40 ms onset/offset error; B's unclaimed sustain target≥95% exact interior after120 ms confirmation, no gaps/extras, ≤60 ms release error; no added false/lost cells or longer false runs on safety controls; even/third false duration≤560 ms; stable slide destination≤60 ms, no persistent old/double identity. Keep attack counts, no new false attacks or lost correct boundaries. Cold-start/crop failures cannot be netted against prelude success.

The scorer stores 20 ms exact MIDI and pitch-class cells, added/lost cells, false duration and maximum false run, merged physical membership runs, each serialized note stream's events/cells/onset/offset matches, and harmony event counts. Crops retain both whole-call and emitted-local[.64,2.24) scores against shifted construction truth. Adjacent same-pitch physical union runs merge; serialized event boundaries remain separately reported. Eight focused scorer assertions passed: exact membership, internal dropout, false octave, PC/MIDI distinction and gate rejection. Per-input output JSON, scores and expanded commands are preserved; subprocess failures are never converted to empty success.

B sustain and A1 tuning are retention/named-failure measurements, not claimed repairs. Original tuning fields remain in each raw result. Full-DEV chord/harmony metrics remain the unchanged harnesses' job in phase 2.

## Baseline result

**335/335 scored; 0 whole-input/harness failures.** Vibrato strict gates: prelude **26/36**, cold **26/36**, original **0/24**. Wide±65 c subset **4/24**; wide-vibrato crops **0/6**. These are baseline failure measurements, not proposed relaxed thresholds.

| Family | Inputs | Scored | Extra MIDI cells | Lost true MIDI cells |
| --- | ---: | ---: | ---: | ---: |
| vibrato | 72 | 72 | 1948 | 772 |
| sustain | 27 | 27 | 618 | 1771 |
| negative | 7 | 7 | 347 | 1 |
| cancellation | 3 | 3 | 34 | 295 |
| slide | 8 | 8 | 7 | 1 |
| bend | 4 | 4 | 356 | 360 |
| neighbor | 2 | 2 | 3 | 65 |
| static | 7 | 7 | 0 | 0 |
| original-pluck | 24 | 24 | 18 | 2 |
| original-vibrato | 24 | 24 | 798 | 806 |
| original-beating | 24 | 24 | 12 | 38 |
| original-tilt | 24 | 24 | 0 | 2 |
| original-neighbor | 24 | 24 | 268 | 476 |
| original-phase | 24 | 24 | 34 | 2 |
| original-seam | 27 | 27 | 0 | 0 |
| event | 8 | 8 | 95 | 229 |
| rolling | 20 | 20 | 786 | 897 |
| seam | 6 | 6 | 0 | 0 |

See [per-input scores](../target/upstream-round2-test/baseline/scores.json), [run ledger](../target/upstream-round2-test/baseline/runs.json), [family summary](../target/upstream-round2-test/baseline/summary.json), and [vibrato/attack headline](../target/upstream-round2-test/headline.json). Attack headline preserves physical and serialized counts separately; merging a true re-pluck remains a visible miss, while beating/phase modulation has no constructed re-pluck truth.

## Coverage limits and next stage

This is a bounded synthetic development selection, not exhaustive coverage or new holdout evidence. Nuisance-factor interactions are not fully crossed; static tuning and bends are at MIDI57; gains/ratios, timbres, decays and release phases are finite. Phase-cancellation coverage is three harmonic octave mixtures, not arbitrary destructive interference. Rolling windows cover selected families and origins, not every input and modulation phase; seam offsets and ordinary/irregular lengths use MIDI57. No noisy/inharmonic wide vibrato, fret noise, acoustic room/pickup variation, sub-hop boundary sweep or human-source ambiguity adjudication is newly covered.

The ignored Rust `sustained_source_truth_survives_full_and_cropped_context` test is preserved by source hash and name in the manifest, but **not executed** in phase 1. Its6 s fixture exceeds the new-generator4 s bound; late_voice full/crops and27 sustained dyads are separate measurements, not a claim that this exact test passed. Sustained-upper loss, cold-start, attack ambiguity and tuning aliases remain named failures.

Executed: construction/freeze; baseline335; scorer assertions; final frozen-script/PCM/source identity verification. Skipped deliberately: all candidate/ablation inference, full51×3 synthetic DEV,3 GuitarSet,12 supplemental,20×3 joint,28 whole Guitar-TECHS, dim/half-dim244-frame retention checks, native600-second resource probe, passive palm union-run observer, Rust ignored test, WASM/browser parity/cost/disposal. No conclusion about C6/madd11, mono/shared/octave scope retention, cap recovery, or browser resources follows from phase 1.

Phase 2 requires lead-supplied frozen candidate binary SHA and source inventory. First verify them, then execute these frozen controls and reject on any claimed-vibrato/safety failure before expensive DEV. The runner's automated compare is a screening aid; acceptance also requires review of per-stream metrics, per-input deltas, release boundaries and all retained baseline failure scopes. Only survivors proceed to unchanged full-DEV scorers, with per-input deltas and all28 whole Guitar-TECHS inputs, preserving the three named baseline cap failures. No cap relaxation, partial-success scoring, precision-at-lower-recall overall claim, or tuning fallback. Existing cost gates and palm≤9694 union runs remain mandatory before acceptance; absent browser measurements cannot be inferred from native timings.

## Exact commands and ownership

From `/home/xtra/code/personal_projects/fretbloom-song-audit`:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/generate.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/run.py baseline target/event-stability-baseline/analyze-pcm d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8 > target/upstream-round2-test/baseline.log 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 target/upstream-round2-test/report.py
```

Every actual analysis argv, UTC start, status, output existence/hash, input hash and wall time is in the run ledger; every child deadline is110 s. Full-DEV driver is prepared but unexecuted; it imports existing scorers read-only and redirects binary/output roots following the prior builder pattern. Its music-command deadline is bounded to110 s without editing any original scorer.

Writes are confined to new `validation/upstream-round2/**`, `target/upstream-round2-test/**`, and this report. No candidate fixture, active source, previous evidence, original holdout, commits, pushes, deployments, services or child agents. Phase 1 stops here; no builder wait.

## Phase 2 — independent frozen-candidate test

Completed 2026-10-31T19:20:51.928518+00:00. **Reject both candidates. Stage 2 SKIPPED**: neither passes the claimed vibrato gate and all stage-1 safety gates. Baseline rust-dsp-3.1 remains the reference.

### Identity and method

All 440 recorded hashes matched before and after: six frozen harness files, 335 PCM inputs, source manifests, baseline/candidate native and WASM/JS, candidate canonical source maps, 40-file source inventories and diffs. Manifest remains cd66d9015fd8c31d0dcea4ac84e674899607287cb53351119ce081d1953bf4f6. [Before](../target/upstream-round2-test/phase2/identity-before.json), [after](../target/upstream-round2-test/phase2/identity-final.json). No controls, truths, thresholds or frozen scorer changed. Phase-1 text above is preserved.

| Engine | Native SHA256 | WASM SHA256 | Canonical source SHA256 |
|---|---|---|---|
| a2 | 634f7890c1d82aefc48a40fab8a62cfb418d4516782c06cb6fd049a02781c17c | adbcdcc71f56e8d353dc7d829a44aa8be44980d6900ac1ce38cada1f21196867 | 85144102d9b3c8f1c10798dc8ef68ec37c7b5667c974cf047dfd5bb8146222f1 |
| g | 78627fa665c0a3c36b2956b7d79c6a440e52f5308435dc8ce2ed79df94b77261 | 0136063a4c45a0177aa1d51b5cf686612cd98e972be3fb8466f429003d8c8d4f | 5275e973cffe73008a278a55d8540b50bd8ad16591e96c7c73e516c0da36b276 |
| baseline | d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8 | c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61 | f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9 |

Used unchanged phase-1 runner with labels phase2/a2 and phase2/g: identical input/mode/options, 110 s deadline per child. Both complete 335/335 with zero whole-input/scoring failures. Baseline phase-1 outputs reused. Runs retain exact argv, UTC, duration, PCM/output hashes, stdout/stderr and raw results.

Frozen compare uses net counts and is only a screening aid. Additional assessment uses set differences of each (20 ms, MIDI) cell: newly false, removed false, newly lost and recovered. Additions never cancel removals. Every input, stream and emitted crop interval is retained, alongside physical/serialized boundary retention and false-run maxima. This does not alter scoring truth.

### Claimed vibrato gate

Strict passes / inputs, with coverage, runs, extras, dropout and boundary errors retained per input.

| Scope | Baseline | A2 | G |
|---|---:|---:|---:|
| prelude | 26/36 | 22/36 | 29/36 |
| cold | 26/36 | 22/36 | 27/36 |
| wide65 | 4/24 | 3/24 | 8/24 |
| original | 0/24 | 6/24 | 6/24 |
| crops | 0/6 | 0/6 | 0/6 |

### Per-family safety

Distinct changed cells versus baseline. Unsafe inputs include cell, false-run, or physical/serialized boundary regressions. Claimed vibrato failures independently reject candidates.

| Engine | Family | Inputs | New false | Removed false | Newly lost | Recovered | Longer false runs (inputs) | Unsafe inputs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| a2 | vibrato | 72 | 2246 | 383 | 138 | 380 | 22 | 26 |
| a2 | sustain | 27 | 0 | 1 | 0 | 3 | 0 | 0 |
| a2 | negative | 7 | 22 | 119 | 0 | 0 | 1 | 2 |
| a2 | cancellation | 3 | 0 | 0 | 0 | 3 | 0 | 0 |
| a2 | slide | 8 | 17 | 0 | 17 | 0 | 6 | 8 |
| a2 | bend | 4 | 66 | 94 | 0 | 98 | 0 | 2 |
| a2 | neighbor | 2 | 0 | 0 | 0 | 19 | 0 | 0 |
| a2 | static | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| a2 | original-pluck | 24 | 6 | 0 | 0 | 0 | 0 | 2 |
| a2 | original-vibrato | 24 | 1230 | 174 | 0 | 222 | 18 | 18 |
| a2 | original-beating | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| a2 | original-tilt | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| a2 | original-neighbor | 24 | 18 | 10 | 0 | 6 | 0 | 6 |
| a2 | original-phase | 24 | 6 | 0 | 0 | 0 | 0 | 2 |
| a2 | original-seam | 27 | 0 | 0 | 0 | 0 | 0 | 0 |
| a2 | event | 8 | 9 | 0 | 0 | 0 | 2 | 2 |
| a2 | rolling | 20 | 573 | 1 | 8 | 48 | 2 | 5 |
| a2 | seam | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | vibrato | 72 | 313 | 966 | 0 | 307 | 2 | 7 |
| g | sustain | 27 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | negative | 7 | 51 | 102 | 0 | 0 | 0 | 1 |
| g | cancellation | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | slide | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | bend | 4 | 0 | 0 | 0 | 4 | 0 | 0 |
| g | neighbor | 2 | 0 | 0 | 0 | 23 | 0 | 0 |
| g | static | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-pluck | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-vibrato | 24 | 312 | 330 | 0 | 264 | 0 | 6 |
| g | original-beating | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-tilt | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-neighbor | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-phase | 24 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | original-seam | 27 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | event | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| g | rolling | 20 | 0 | 335 | 0 | 68 | 0 | 3 |
| g | seam | 6 | 0 | 0 | 0 | 0 | 0 | 0 |

**A2:** 73 safety-failing inputs; 73 frozen screening failures including vibrato. [All per-input/stream details](../target/upstream-round2-test/phase2/a2/independent-details.json), [frozen scores](../target/upstream-round2-test/phase2/a2/scores.json), [run ledger](../target/upstream-round2-test/phase2/a2/runs.json).

Even/third ambiguity controls retain singleton construction truth; identical-byte added-source interpretations do not receive contradictory hard truth. False duration baseline → candidate:
- even_ramp: 0.56 → 0.56 s (ceiling 0.56).
- third_ramp: 0.56 → 0.56 s (ceiling 0.56).

Slides: destination delay / persistent-old cells / double-identity cells (baseline → candidate).
- slide--1-0.04: 0.000/0/0 → 0.000/0/0.
- slide--1-0.1: 0.000/0/0 → 0.000/0/0.
- slide--1-0.4: 0.000/0/0 → 0.000/0/0.
- slide--1-0: 0.000/0/0 → 0.020/0/0.
- slide-1-0.04: 0.000/0/0 → 0.000/0/0.
- slide-1-0.1: 0.000/0/0 → 0.000/0/0.
- slide-1-0.4: 0.000/0/0 → 0.000/0/0.
- slide-1-0: 0.000/0/0 → 0.020/0/0.

Rolling emitted interval new false / newly lost cells:
- roll-vib-57-65-5-0-0.00: 0 / 0.
- roll-vib-57-65-5-0-0.64: 48 / 0.
- roll-vib-57-65-5-0-1.28: 88 / 0.
- roll-vib-69-65-7-1-0.00: 90 / 4.
- roll-vib-69-65-7-1-0.64: 82 / 0.
- roll-vib-69-65-7-1-1.28: 88 / 4.
- roll-cancel-3.1416-0.00: 0 / 0.
- roll-cancel-3.1416-0.64: 0 / 0.
- roll-cancel-3.1416-1.28: 0 / 0.
- roll-event-late_voice-0.00: 0 / 0.
- roll-event-late_voice-0.64: 0 / 0.
- roll-event-late_voice-1.28: 0 / 0.
- roll-event-late_voice-1.92: 0 / 0.
- roll-event-late_voice-2.56: 0 / 0.
- roll-event-late_voice-3.20: 0 / 0.
- roll-event-late_voice-3.84: 0 / 0.
- roll-event-late_voice-4.48: 0 / 0.
- roll-event-late_voice-5.12: 0 / 0.
- roll-event-late_voice-5.76: 0 / 0.
- roll-event-late_voice-6.40: 0 / 0.

Sustain details retain exact interior ratio, upper missing interior cells, upper physical runs and per-truth-note nearest same-MIDI release errors. Fifth (+7), octave (+12), octave+fifth (+19), phase cancellation, whole late_voice and onset-free crops remain distinct. B is unclaimed: retention is not a sustain repair. Bend truth remains source MIDI; static detuning truth remains intended MIDI. No alternative labeling was substituted.

**G:** 17 safety-failing inputs; 40 frozen screening failures including vibrato. [All per-input/stream details](../target/upstream-round2-test/phase2/g/independent-details.json), [frozen scores](../target/upstream-round2-test/phase2/g/scores.json), [run ledger](../target/upstream-round2-test/phase2/g/runs.json).

Even/third ambiguity controls retain singleton construction truth; identical-byte added-source interpretations do not receive contradictory hard truth. False duration baseline → candidate:
- even_ramp: 0.56 → 0.56 s (ceiling 0.56).
- third_ramp: 0.56 → 0.56 s (ceiling 0.56).

Slides: destination delay / persistent-old cells / double-identity cells (baseline → candidate).
- slide--1-0.04: 0.000/0/0 → 0.000/0/0.
- slide--1-0.1: 0.000/0/0 → 0.000/0/0.
- slide--1-0.4: 0.000/0/0 → 0.000/0/0.
- slide--1-0: 0.000/0/0 → 0.000/0/0.
- slide-1-0.04: 0.000/0/0 → 0.000/0/0.
- slide-1-0.1: 0.000/0/0 → 0.000/0/0.
- slide-1-0.4: 0.000/0/0 → 0.000/0/0.
- slide-1-0: 0.000/0/0 → 0.000/0/0.

Rolling emitted interval new false / newly lost cells:
- roll-vib-57-65-5-0-0.00: 0 / 0.
- roll-vib-57-65-5-0-0.64: 0 / 0.
- roll-vib-57-65-5-0-1.28: 0 / 0.
- roll-vib-69-65-7-1-0.00: 0 / 0.
- roll-vib-69-65-7-1-0.64: 0 / 0.
- roll-vib-69-65-7-1-1.28: 0 / 0.
- roll-cancel-3.1416-0.00: 0 / 0.
- roll-cancel-3.1416-0.64: 0 / 0.
- roll-cancel-3.1416-1.28: 0 / 0.
- roll-event-late_voice-0.00: 0 / 0.
- roll-event-late_voice-0.64: 0 / 0.
- roll-event-late_voice-1.28: 0 / 0.
- roll-event-late_voice-1.92: 0 / 0.
- roll-event-late_voice-2.56: 0 / 0.
- roll-event-late_voice-3.20: 0 / 0.
- roll-event-late_voice-3.84: 0 / 0.
- roll-event-late_voice-4.48: 0 / 0.
- roll-event-late_voice-5.12: 0 / 0.
- roll-event-late_voice-5.76: 0 / 0.
- roll-event-late_voice-6.40: 0 / 0.

Sustain details retain exact interior ratio, upper missing interior cells, upper physical runs and per-truth-note nearest same-MIDI release errors. Fifth (+7), octave (+12), octave+fifth (+19), phase cancellation, whole late_voice and onset-free crops remain distinct. B is unclaimed: retention is not a sustain repair. Bend truth remains source MIDI; static detuning truth remains intended MIDI. No alternative labeling was substituted.

### Beat versus re-pluck

Serialized counts sum both streams; physical union runs remain separate. Input details preserve correct/unmatched/missed onset and offset counts per stream. Attack improvement is unclaimed.

| Engine | Family | Physical runs | Wire events | Correct wire onsets | Missed wire onsets | Correct wire offsets |
|---|---|---:|---:|---:|---:|---:|
| baseline | original-pluck | 30 | 30 | 24 | 72 | 24 |
| baseline | original-beating | 46 | 46 | 24 | 24 | 24 |
| baseline | original-phase | 34 | 34 | 24 | 24 | 24 |
| baseline | original-seam | 27 | 27 | 27 | 81 | 27 |
| a2 | original-pluck | 32 | 32 | 24 | 72 | 24 |
| a2 | original-beating | 46 | 46 | 24 | 24 | 24 |
| a2 | original-phase | 36 | 36 | 24 | 24 | 24 |
| a2 | original-seam | 27 | 27 | 27 | 81 | 27 |
| g | original-pluck | 30 | 30 | 24 | 72 | 24 |
| g | original-beating | 46 | 46 | 24 | 24 | 24 |
| g | original-phase | 34 | 34 | 24 | 24 | 24 |
| g | original-seam | 27 | 27 | 27 | 81 | 27 |

### Independent WASM cost recheck

Node 24.22.2; 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz; 8 exposed threads; linux. Copied retained builder harness with module/input/output paths repointed; added two baseline real crops. Three warmups then 15 timed calls, unchanged interpolated p95. All runs sequential, after stage-1 analysis/scoring exited, with no concurrent owned analysis/build. Normal desktop/background processes remained. Includes bridge copying and JSON serialization; excludes file I/O/module initialization. Node/WASM timing does not establish browser scheduling or UI latency.

Dense and sideband PCM are byte-identical retained builder inputs. Ordinary 2.56 s GuitarSet DEV windows start at 5.00 s in 00_Rock2-142-D_solo and 01_Jazz3-150-C_comp. [PCM hashes/origins](../target/upstream-round2-test/phase2/cost-pcm/manifest.json). [All timing samples](../target/upstream-round2-test/phase2/cost/wasm-cost.json).

| Engine | Window | Median ms | p95 ms | Linear MiB | 500 ms gate |
|---|---|---:|---:|---:|---|
| baseline | dense | 194.65 | 195.94 | 3.19 | PASS |
| baseline | sideband | 675.83 | 678.49 | 3.31 | FAIL |
| baseline | real-solo | 363.75 | 365.13 | 3.50 | PASS |
| baseline | real-comp | 227.92 | 245.66 | 3.50 | PASS |
| a2 | dense | 195.93 | 196.59 | 3.19 | PASS |
| a2 | sideband | 683.86 | 687.09 | 3.25 | FAIL |
| g | dense | 206.66 | 209.82 | 3.19 | PASS |
| g | sideband | 771.05 | 777.20 | 3.38 | FAIL |

Baseline-over-budget sideband claim **REPRODUCED**. Baseline also pays this sideband cost. Ordinary crops contextualize only these two windows, not all real inputs. Linear memory is not a full JS/incremental-memory audit.

### Executed and skipped

Executed: pre/post identity verification; A2 335 and G 335 whole-input frozen controls/scoring; distinct-cell and physical/stream boundary audit; sequential WASM baseline four windows and A2/G two each (18 calls per measurement). No run-blocking harness bug. Frozen automated net-count screening limitation was addressed only by separate reported cell-set analysis.

**Stage 2 SKIPPED for both** because claimed vibrato and stage-1 safety gates fail. Not executed: full 51 synthetic ×3 modes, 3 GuitarSet, 12 supplemental, 20 joint ×3, full-DEV event scoring, 28 whole Guitar-TECHS including three baseline cap failures, or 244/244 dim/half-dim retention. Eight frozen event controls did run in stage 1. No claims of cap recovery, C6/madd11 retention or palm union-run improvement. Native 600 s probe, ignored Rust sustain test, browser parity/UI delay/cancel/disposal, 300 s refinement and full memory gates also skipped.

Exact commands from repository root; child argv are in each runs.json:

~~~sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/phase2/verify.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/run.py phase2/a2 target/upstream-round2-builder/frozen/a2/analyze-pcm 634f7890c1d82aefc48a40fab8a62cfb418d4516782c06cb6fd049a02781c17c > target/upstream-round2-test/phase2/a2.log 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/run.py phase2/g target/upstream-round2-builder/frozen/g/analyze-pcm 78627fa665c0a3c36b2956b7d79c6a440e52f5308435dc8ce2ed79df94b77261 > target/upstream-round2-test/phase2/g.log 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/phase2/assess.py a2 > target/upstream-round2-test/phase2/a2-assessment.log
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/phase2/assess.py g > target/upstream-round2-test/phase2/g-assessment.log
.tools/node-v24.22.2-linux-x64/bin/node validation/upstream-round2/phase2/wasm-cost.mjs > target/upstream-round2-test/phase2/cost/wasm-cost.log 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/phase2/verify.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/upstream-round2/phase2/report.py
~~~

Preparation copied the retained harness and cost PCM and extracted the specified real crops into owned paths; controls were not regenerated. New scripts only in validation/upstream-round2/phase2; evidence only in target/upstream-round2-test/phase2; this section is append-only. No active source, builder, prior evidence or phase-1 files modified. No commits, pushes, installs, deployments, child agents or servers. Owned processes exited.

**A2: REJECT** — claimed vibrato and safety fail.

**G: REJECT** — gate ablation fails claimed vibrato and safety.
