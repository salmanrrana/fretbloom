# Development evaluation of actual Rust PCM detector

Development evidence only, 2026-10-31. No holdout detector execution, rebuild,
service, commit, push or deployment. Builders continue editing; none of these
results establishes feature completeness or final acceptance.

Executable snapshot: `validation/real-audio/results/snapshots/20261031T142452.943030Z/analyze-pcm` (copied, never hardlinked).
SHA-256 before copy, after copy and after every evaluation:
`f941005b62b1199831b8bc6b2711b66bbc5928b09d913c8660a99ef172e25c24`.
Snapshot UTC: `20261031T142452.943030Z`. Revision: `ed6507981fb61804098be7bfc6d955bdcf2cae37`.
Platform: `Linux-7.0.0-42-generic-x86_64-with-glibc2.39`.
Full dirty state and per-source-file hashes: `validation/real-audio/results/snapshots/20261031T142452.943030Z/snapshot.json`.
Source was changing in the shared checkout; this does **not** attest exact
binary-source association. Source inventory is observation, not a reproducible build.
All outputs below use this same snapshot; engine version is `rust-dsp-1`,
24 kHz mono, A4=440 Hz, sharps, auto unless explicitly stated otherwise.

## Artifacts and reproduction

* Real complete run: `validation/real-audio/results/dev/f941005b62b11998-50w46n_4/report.json`; sibling JSON files are untouched detector output,
  stderr retained. Report stores exact commands, decoded PCM hashes, source status,
  decoder version, timestamps and source manifest hash.
* Synthetic all-three-mode run: `validation/audio/results/rust-dev/20261031T142503.410904Z-88cdd9e7/run.json`; status `succeeded`, all
  51 dev cases in each mode. Raw JSON/decoded PCM/diagnostics, per-case/group counts,
  separate stream/routing reports and `score.json` remain in each mode directory.
* Supplemental run: `validation/extended-audio/results/20261031T142544Z-jqig_e1j/report.json`; 12 dev clips, strict wire validation, complete.
* Selfcheck logs and snapshot inventory: `validation/real-audio/results/snapshots/20261031T142452.943030Z`.
* Independent excerpt evidence and listening crops: `validation/real-audio/results/dev/f941005b62b11998-50w46n_4/probes/evidence.json`.

```sh
python3 validation/real-audio/selfcheck.py
python3 validation/audio/selfcheck.py
python3 validation/extended-audio/evaluate.py selfcheck
python3 validation/real-audio/evaluate.py --binary validation/real-audio/results/snapshots/20261031T142452.943030Z/analyze-pcm --split dev
python3 validation/audio/rust_eval.py --binary validation/real-audio/results/snapshots/20261031T142452.943030Z/analyze-pcm --split dev
python3 validation/extended-audio/evaluate.py evaluate --binary validation/real-audio/results/snapshots/20261031T142452.943030Z/analyze-pcm
# Optional probes on a NEW completed real run (requires NumPy):
python3 validation/real-audio/development_probes.py --run validation/real-audio/results/dev/f941005b62b11998-50w46n_4
```

The final real suite passes 5 tests; supplemental passes 2. Synthetic suite passes
all 18 and verifies all 102 frozen PCM/label hashes (0.46-cent worst single-note
check). Two synthetic selfcheck invocations failed the same 30 ms scratch-process
timeout diagnostic assertion; the intervening standalone invocation passed all 18.
The retained final synthetic-selfcheck.txt records the failure, not the successful
intervening run (whose output was captured in the tool transcript).
This is a timing-sensitive harness test observation, not an engine music failure;
synthetic files were left untouched. Passing waveform unit tests were not used.

## Real recordings: full timeline results

Agreement with imperfect GuitarSet annotations, 20 ms centers over whole original
recordings, no alignment fitting or stable-window cherry-picking. Mono/poly below
use their separately required stream, conditioned on reference voice count.
Precision/recall/F1, exactness, silent frames, event onset/offset scores, and all
performed/instructed quality counts remain in the raw report.

| Recording | Mono P/R/F1 | Poly P/R/F1 | Poly exact | Lowest-note bass |
|---|---|---|---|---|
| 00_Rock2-142-D_solo | 100.00/21.65/35.59 | 79.43/46.64/58.77 | 87/305 | 110/1178 |
| 00_SS3-84-Bb_comp | 98.46/35.07/51.72 | 64.00/42.96/51.41 | 105/1786 | 591/2151 |
| 01_Jazz3-150-C_comp | 100.00/21.14/34.90 | 59.46/28.69/38.71 | 10/425 | 54/898 |

Primary chord evidence is **comp performed only**; solo context is never pooled.

| Recording / role | Root | Quality all labels | Annotated bass | Joint | Supported quality | Boundary frames excluded |
|---|---|---|---|---|---|---|
| 00_Rock2-142-D_solo / performed | 0/1212 | 0/1212 | 29/1212 | 0/1212 | 0/978 | 140 |
| 00_Rock2-142-D_solo / instructed | 0/1212 | 0/1212 | 26/1212 | 0/1212 | 0/1212 | 140 |
| 00_SS3-84-Bb_comp / performed | 333/2125 | 177/2125 | 531/2125 | 85/2125 | 177/1859 | 161 |
| 00_SS3-84-Bb_comp / instructed | 333/2125 | 182/2125 | 522/2125 | 96/2125 | 182/2125 | 161 |
| 01_Jazz3-150-C_comp / performed | 17/1120 | 3/1120 | 54/1120 | 0/1120 | 3/1120 | 160 |
| 01_Jazz3-150-C_comp / instructed | 17/1120 | 3/1120 | 34/1120 | 0/1120 | 3/1120 | 160 |

Comp-performed total: root 350/3245 (10.79%),
quality 180/3245 (5.55%),
annotated bass 585/3245 (18.03%),
joint 85/3245 (2.62%).
Supported-quality accuracy is 180/2979
(6.04%);
unsupported quality occupies 266/3245 frames.
`maj(#11)` accounts for 266 comp-performed unsupported frames. The solo performed
context has 234 unsupported frames (`hdim7(11)` 75, `(1,5,2,b7,4)` 159).
These remain in all-label denominators, never simplified to easier chords.

Routing diagnostics (wrong-stream pitch emissions on 20 ms frames, not unique events):
* 00_Rock2-142-D_solo: {"mono_emissions_on_poly_frames": 11, "poly_emissions_on_mono_frames": 205, "cross_stream_duplicate_pitch_frames": 0}; union diagnostic F1 49.16% (does not replace separate-stream score).
* 00_SS3-84-Bb_comp: {"mono_emissions_on_poly_frames": 358, "poly_emissions_on_mono_frames": 208, "cross_stream_duplicate_pitch_frames": 0}; union diagnostic F1 55.76% (does not replace separate-stream score).
* 01_Jazz3-150-C_comp: {"mono_emissions_on_poly_frames": 1, "poly_emissions_on_mono_frames": 44, "cross_stream_duplicate_pitch_frames": 0}; union diagnostic F1 38.01% (does not replace separate-stream score).

## Concrete reproducible problems for independent Astra triage

1. **High: audible-pitch evidence is suppressed in real guitar.**
   Jazz comp at 3.60 s: reference MIDI [57,60,64] (A3,C4,E4), observed both note
   streams empty and `no_chord/unpitched`, bass null. Performed A:min/1 spans
   3.20–4.80 s; this probe is away from the 100 ms boundary exclusion. MIC crop
   3.40–3.80 s has RMS −32.25 dBFS; independent spectral peaks near 220, 262,
   330 Hz are 0.872, 0.774, 0.441 of the strongest peak, respectively. This is
   strong evidence for a real omission rather than silence, though no independent
   human listening adjudication was performed. Rock solo at 4.20 s similarly
   omits E4/A4 [64,69], both streams empty, at −34.14 dBFS with strong 330/440 Hz
   support. Its sheet F:maj/3 is sparse context, **not** proof a full F chord was
   acoustically present. Do not fix solo harmony by forcing sheet chords.
2. **High: octave/voice errors persist on comp.** SS comp at 3.20 s: reference
   [53,65,69] (F3,F4,A4), actual poly [53,57] (F3,A3), harmony unknown despite
   F:maj/1 annotation (2.857–5.714 s). Fundamental F3 and A4 evidence is present;
   F4 at 349 Hz coincides with F3's second harmonic, so its independent audibility
   is uncertain. A4-to-A3 is a concrete octave hypothesis to inspect, not evidence
   that every string label is independently audible. Crop RMS −42.11 dBFS.
3. **High: synthetic polyphonic register recovery and harmonic transitions.**
   Auto settled exact MIDI 102/2059 (4.95%), PC exact 1203/2059 (58.43%),
   MIDI precision/recall/F1 83.98/65.21/73.41%; root 895/1387, quality 846/1387,
   bass 1978/2059. Compatible primary identity 846/1935. Transition harmonic-only
   boundary score has 3 TP, 7 FP, 0 FN, F1 46.15%, mean matched error 110 ms.
   Overlap note F1 38.52% (83 TP,19 FP,246 FN), separate from settled scores.
   Inspect raw `dev_transitions` and per-case predictions before smoothing fixes.
4. **Medium/high: supplemental madd11 and power-5 failures.** See separate
   extended report for independent truth, exact cases and ambiguity treatment.
   madd11 has 0/120 compatible primary frames; E5 has 0/62 at capo 0, 46/62
   at capo 3. This establishes an eligible power-5 denominator previously absent.
   Symmetric dim7 and hdim7/m6 return unknown with compatible alternatives on all
   244 settled frames. That is reasonable uncertainty, not confident primary
   correctness and not proof of failed vocabulary support.

Review the supplied MIC WAV crops and complete raw events using timestamps above;
`development_probes.py` reproduces crops and FFT evidence without executing a
detector. FFT support does not replace listening, and shared harmonics, pickup/MIC
mismatch, decay, sparse guitar voicings and sheet-derived chord roots limit
annotation certainty. A full real chord headline is particularly fragile for the
arpeggiated Jazz comp: full sheet harmony need not sound simultaneously. Missing
well-supported simultaneous notes remain actionable independently of that caveat.

## Synthetic modes, coverage and harness corrections

Auto early monophonic 265/272 (97.43%), sustained 840/928 (90.52%). Dedicated
silence/noise/percussion results and each individual note are retained in the
per-mode report; overall negative rate includes margins (44/1745, 2.52%).
Explicit polyphonic gives the same union-level music scores as auto in this
snapshot; separate stream diagnostics distinguish routing. Explicit monophonic
poly-note recall is intentionally near zero (0.75%); do not call mode refusal
an overall polyphonic capability failure. All disabled streams passed wire checks.

Real harness corrections only:
* Apply `validation/audio/wire.py` to the complete AnalysisOutput before scoring,
  including features/options/name spelling/bass consistency; focused fixture tests
  prove valid silence accepted and malformed features/options rejected.
* Valid decoded durations can differ from original WAV metadata by up to one
  24 kHz sample. Old span checks used original duration with only 1 microsecond
  tolerance despite accepting output duration within one sample. Two actual
  recordings failed. Validate the duration first, then use checked output duration
  for wire span/coverage bounds; original labels and 20 ms musical truth unchanged.
  Focused rounded-duration oracle added.
* Preserve invocation/options/timestamps/dirty status in run reports.

Earlier immutable failed runs `f941005b62b11998-cl1k2p5w` (my import-path collision,
corrected) and `f941005b62b11998-f5yyw0d3` (duration mismatch above) retain raw output
and failure metadata, with no published partial scores. Only the named complete
run is cited for music metrics. No source/label/manifest/lock/selection changed.

These findings concern the snapshot hash above. All engine findings may be stale
against Builder A's subsequent binary or source. Root should give this evidence
to a **new independent Astra triage** before fixes; this tester started no agents.
Further acceptance requires a source-associated freeze, authorized holdout,
independent listening, real extended-family coverage and backend workflow tests.
