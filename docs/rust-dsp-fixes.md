# DSP reliability repairs — 2026-10-31

These are bounded implementation repairs and DEV measurements, **not musical
acceptance**. Pitch-class accuracy, synthetic negatives, several real omissions,
endpoint validity and independent detuned voices improve. Exact-register recall
remains poor and regresses on the synthetic set. Real false positives increase.
The engine must not be described as reliable guitar transcription.

Only `crates/fretbloom-analysis/src/{lib,config,spectrum,polyphony,segments}.rs`,
new focused `tests/dsp_reliability.rs`, and this document were changed by this
fixer. Existing README and independent reports remain historical evidence.
No manifest/lock/toolchain, public wire types/signature/options/modes/CLI,
architecture, corpus/labels/scorers, frontend, backend or packaging changes.
No holdout detector runs or holdout outputs, services, production, secrets,
branches, commits, push, deployment or subagents. Root owns acceptance and the
subsequent source-associated WASM/native regeneration.

## What changed

- **Local tonal evidence:** a median spectral floor outside each peak's Hann
  main lobe adapts to the current window. Prominent peaks must account for at
  least .35 of window spectral power. All measured peaks remain available to
  the fit; a weak fundamental can use independently prominent partials. There
  is no historical RMS noise estimate that rises on attacks and never decays.
  A cell must also have at least .25 of its surrounding-window RMS, preventing
  a loud neighboring note from filling a quiet nonzero-noise gap. Absolute
  silence threshold, original-amplitude RMS and clipping behavior are retained.
- **Attribution/admission:** candidates start at observed fundamentals and use
  partial frequency coherence (12 cents) anchored there. Up to eight partials
  enter the measured fit. An unused higher partial up to harmonic 64 is still
  checked against active voices before counting it as independent admission
  evidence. Integer harmonic candidates are no longer unconditionally skipped;
  independently shifted residual partials can admit real upper voices. A strong
  independent fundamental can support a singleton sine voice; harmonic aliases
  need multiple independently prominent residual peaks and at least three
  measured matches. The old +12/+19/+24 fixed-.72-support recovery is removed.
  Every admitted voice participates in the bounded nonnegative refit. Six-voice,
  20-refit-pass and cancellation bounds remain. Notes never come from a chord
  template. Note support is explained measured residual amplitude relative to
  that candidate's own residual norm, rather than another voice's loudness;
  this is heuristic evidence, not probability or proof of physical voice count.
- **Mono corroboration:** YIN does not erase independently admitted voices just
  because they are approximately integer harmonics. Very tight single-period
  spectral explanation (98% of peak power within 8 cents) can still reject a
  rich single note's false octave stack. The general periodicity and observed
  fundamental requirements remain.
- **Short input:** a recording shorter than its fixed FFT window cannot support
  the narrow-window comb/YIN decision. It abstains rather than fitting truncation
  lobes. This is conservative: no minimum buffer length was added to the API.
  Most short pitched controls report unknown/insufficient evidence; the 20 ms
  original probe remains unpitched. No short-buffer pitch accuracy is claimed.
- **Timing:** three-hop pitch support is confirmed before mono/poly routing.
  A continuous note can have short routed pieces without disappearing or being
  duplicated. Bass events keep their own boundaries, while an unchanged harmonic
  root/quality accumulates confirmation across bass changes/uncertainty. Actual
  chord changes, silence and unknown gaps are not merged away. Precise same-pitch
  reattack separation without a release remains unimplemented.
- **Wire endpoint:** feature centers round first, then clamp to exact duration.
  Off-grid final endpoints can retain exact unrounded seconds. Event endpoints
  already clamp after grid calculation; focused checks found no analogous event
  overflow. TS validators and the schema were not relaxed.

New thresholds are inspectable in `src/config.rs`; frequency/coherence and
corroboration gates are documented at their decisions. Engine identity is now
`rust-dsp-2`; schemaVersion remains 1. The core remains pure, portable, single
threaded and bounded, with no I/O, models, network or external processes.

## Red counterexamples and focused verification

The first command, before repairs, was:

```sh
cargo test --locked --release -p fretbloom-analysis --test dsp_reliability -- --nocapture
```

All three initial tests failed: unpadded 60 ms A4 emitted `{67,68,69,70,71}`;
a broadband attack suppressed a later decaying A3 (gain .03, noise .015, .4 s);
and an exploratory unresolved low semitone mixture emitted `{45,58,65}`.
Removing the old noise veto alone also failed the paired noise-only control.

The low A2/Bb2 and E3/F3 semitone fundamentals are inside the short window's
resolution limit; these were explicitly excluded from the exact-recovery test,
not silently counted as recovered. Their original failures remain a known
unresolved-resolution counterexample. Resolvable adjacent notes are now checked
both as harmonic voices and as **two pure sines** at three registers. No blanket
adjacent-semitone ban was introduced.

The final locked release run passes 22 tests: four internal attribution/timing,
eight retained analysis, nine new DSP controls and the one all-18-family path
exercise. That family-path test does not establish music accuracy. Controls cover:

- 20/40/60/80/100/140/180 ms, three phases and hard/smooth envelopes;
- pitched decay after a deterministic 180 ms noise attack, three gains and three
  added-noise levels, paired with the same noise without pitch;
- bright isolated four-partial notes, and 20-partial notes over three registers
  and three harmonic envelopes;
- independently detuned fifth/octave/+19-semitone mixtures, unequal envelopes
  and decay rates, three independent voices and a real voice change;
- a true release/repeated note, and a nonzero-noise gap that previously inherited
  A3 at .47 s from its neighboring FFT window;
- continuous pitch switching streams, changing/uncertain bass under a constant
  chord, and an actual different chord separated by silence;
- lengths 1,17,479,481,1441,4097,61696,65536: finite strictly increasing feature
  times <= exact duration, finite positive bounded events, exact harmony end.

The endpoint test was red at one sample: `0.000042` exceeded
`0.000041666666666666665`. It is green after clamp-after-round, including both
reported WASM sample lengths. Root/W independently own actual browser validation.

An adaptive smooth-envelope attribution experiment was discarded: it introduced
higher register extras and lost real notes. A 64-partial ownership experiment
was also discarded: it swallowed upper voices. Those completed intermediate DEV
runs remain ignored evidence, not the final snapshot. They include snapshots
`target/dsp-fixes/candidate-{1,2}` and the `dsp-fixes-20261031T144534Z` snapshot.
The final wider-range check is an **admission veto**, not consumption of 64
measured partials by every lower voice.

## Final provenance and reproduction

Starting CLI SHA256:
`d933b4ef53fd70849c900203a9e5e31407a7d20da86f9ed933bdc7570e2ac659`.
Final CLI SHA256:
`d3e0e9bc8bd73a034cf36ebded05979dbed68f63a3539a37fb5c9001437bcccd`.

Copied with `shutil.copyfile`, made read-only/executable, verified against the
built executable and again after evaluations/resource probes:
`validation/real-audio/results/snapshots/dsp-fixes-20261031T145845Z/`.
Its `snapshot.json` records source/test/manifest/lock hashes, build command,
Rust version, platform, revision and dirty state. The fixer actually invoked the
successful build after release tests. Shared checkout inventory is not a
clean-room reproducibility proof. Final core source stayed fixed while root
prepared subsequent browser artifacts; that build has separate provenance.

Use installed Rust 1.89.0 because AppImage proxies can select another compiler:

```sh
export RUSTC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustc
export RUSTDOC=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/rustdoc
CARGO=/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/cargo
$CARGO test --locked --release -p fretbloom-analysis --tests --no-fail-fast
$CARGO build --locked --release -p fretbloom-analysis --bin analyze-pcm
$CARGO clippy --locked -p fretbloom-analysis --all-targets -- -D warnings
$CARGO fmt --check -p fretbloom-analysis
BINARY=validation/real-audio/results/snapshots/dsp-fixes-20261031T145845Z/analyze-pcm
python3 validation/audio/rust_eval.py --binary "$BINARY" --split dev
python3 validation/real-audio/evaluate.py --binary "$BINARY" --split dev
python3 validation/extended-audio/evaluate.py evaluate --binary "$BINARY"
python3 crates/fretbloom-analysis/tests/resource_probe.py
```

All these final checks succeeded. Cargo remained `--locked`; the runtime owner
resolved its dependency changes. Lock SHA256 at this build:
`4cf9ea7903f854b54c1eb312c6f0ad828b2a3234015da44afb619c2687bae953`.
The resource script uses `target/release/analyze-pcm`; its hash was verified equal
to the copied snapshot after the probe. No concurrent Cargo builds were started
by this fixer; independent evaluator subprocesses were batched. Other builders
occasionally held the shared Cargo lock.

Completed final result directories:

- Synthetic, all 51 DEV files in all three modes:
  `validation/audio/results/rust-dev/20261031T145849.507449Z-16456adc/`.
- All three real DEV recordings:
  `validation/real-audio/results/dev/d3e0e9bc8bd73a03-v8zpgs1o/`.
- All 12 supplemental DEV cases:
  `validation/extended-audio/results/20261031T145849Z-16msrgo8/`.
- `snapshot.json`, `probes.json`, original-probe raw JSON and `resource-probe.json`
  under the final snapshot above. Comparison utility/results are scratch under
  `target/dsp-fixes/`; the authoritative scores/raw outputs are the named runs.

Comparisons use exactly the starting synthetic run
`20261031T142656.939008Z-1b3d0dc7`, real run
`d933b4ef53fd7084-2gfkb4_g`, and supplemental run
`20261031T142946Z-u1q13924`, as identified by the independent review.

## Synthetic DEV: improvements and regressions

Settled auto measurements, percent. Explicit polyphonic has the same settled
union music scores; explicit monophonic intentionally disables polyphonic notes.

| Measure | Starting | Final | Final gate status |
|---|---:|---:|---|
| Mono early exact | 97.43 | 99.63 | met on DEV |
| Mono sustained exact | 90.52 | 92.03 | met on DEV |
| Poly MIDI exact | 15.88 | 6.65 | unmet diagnostic target |
| Poly PC exact | 81.98 | 87.71 | met on DEV |
| MIDI precision | 80.41 | 95.24 | met on DEV |
| MIDI recall | 82.14 | 66.95 | unmet |
| MIDI F1 | 81.26 | 78.63 | unmet |
| Unambiguous root | 80.39 | 87.96 | unmet |
| Unambiguous quality | 73.47 | 82.55 | unmet |
| Bass | 96.60 | 98.20 | met on DEV |
| Compatible primary identity | 52.66 | 59.17 | unmet |
| Ambiguous abstention | 72.47 | 72.47 | descriptive only |
| Reference-empty false positives | 2.46 | 0.00 | 0 / 1745 final |
| Harmonic boundary F1 | 54.55 | 60.00 | unmet |
| Overlap note F1 | 47.73 | 66.79 | diagnostic |

Settled note counts: TP/FP/FN `8254/2011/1795` -> `6728/336/3321`.
Exact MIDI sets `327/2059` -> `137/2059`; exact PCs `1688/2059` -> `1806/2059`.
Dedicated silence/noise/percussion and all scored empty margins now have zero
false-positive frames on this small synthetic set. This does not transfer to
real-recording negatives below.

Boundaries: `3 TP,5 FP,0 FN` -> `3 TP,4 FP,0 FN`; mean matched error
110 -> 16.67 ms. Overlap precision/recall `94.59/31.91` -> `83.56/55.62`.
Intermediate physical strums were not flattened to improve these figures.
These centered FFT windows require future context (about 85 ms short/171 ms bass)
and temporal support; matched timestamp error is not wall-clock live latency.

Separate timed streams, percent, including attacks/releases/overlap:

| Mode / stream | Starting P/R/F1 | Final P/R/F1 |
|---|---|---|
| auto / monophonic | 98.98/83.95/90.85 | 100.00/88.90/94.12 |
| auto / polyphonic | 79.17/77.41/78.28 | 91.24/66.00/76.59 |
| monophonic / monophonic | 98.98/83.95/90.85 | 100.00/88.90/94.12 |
| polyphonic / polyphonic | 80.65/77.97/79.29 | 92.44/68.18/78.48 |

Auto routing accuracy `92.96 -> 97.57%`; explicit monophonic multi-voice refusal
remains 100% on this corpus. All modes retain zero cross-stream duplicate frames.
Union results do not replace these per-stream results.

Per intended group, auto PC exact / MIDI F1 / compatible primary, percent:

| Group | Starting | Final |
|---|---|---|
| chord:maj | 67.61/80.86/67.38 | 73.05/68.46/73.76 |
| chord:min | 95.05/79.67/95.05 | 100.00/75.65/100.00 |
| chord:7 | 74.49/86.87/74.49 | 97.94/87.59/97.94 |
| chord:maj7 | 75.27/74.76/67.03 | 67.03/73.49/67.03 |
| chord:m7 | 96.70/91.63/0.00 | 97.80/88.19/0.00 |
| chord:sus2 | 100.00/82.83/0.00 | 100.00/80.00/0.00 |
| chord:sus4 | 100.00/88.64/0.00 | 100.00/80.00/0.00 |
| chord:add9 | 83.61/87.26/83.61 | 100.00/87.41/100.00 |
| chord:6 | 0.00/71.48/0.00 | 0.00/75.00/0.00 |
| chord:m6 | 75.41/72.43/0.00 | 100.00/88.89/0.00 |
| chord:dim | 91.80/81.70/90.16 | 100.00/85.71/100.00 |
| chord:aug | 96.72/74.09/0.00 | 100.00/85.71/0.00 |
| chord:none | 96.77/72.81/— | 96.77/83.05/— |
| transition:mixed | 91.38/75.70/87.36 | 97.13/75.21/97.13 |

## Real DEV: sensitivity rises, false positives remain serious

Agreement with original imperfect GuitarSet annotations over whole recordings;
no result-dependent stable-window selection or alignment adjustment. Mono/poly
precision/recall below use the separately required streams.

| Recording | Mono P/R starting -> final | Poly P/R starting -> final | Reference-empty emitting frames starting -> final |
|---|---|---|---|
| 00_Rock2-142-D_solo | 100.00/8.36 -> 100.00/28.29 | 68.01/51.68 -> 59.13/93.58 | 1/175 -> 125/175 |
| 00_SS3-84-Bb_comp | 100.00/21.37 -> 98.21/30.14 | 67.91/61.43 -> 70.39/60.41 | 33/135 -> 86/135 |
| 01_Jazz3-150-C_comp | 100.00/9.09 -> 100.00/25.79 | 61.24/34.69 -> 58.29/76.85 | 2/382 -> 252/382 |

Wrong-stream poly pitch emissions on mono-reference frames rise from
`512/331/167` to `1602/606/686` (Rock/SS/Jazz); mono emissions on poly-reference
frames are now `3/178/4`. Cross-stream duplicates stay zero. These are still
routing/precision failures, even where notes in the union agree. Real lowest-note
bass remains weak: final `238/1178`, `641/2151`, `146/898` respectively. Comp
performed quality accuracy is only SS 14.16%, Jazz 3.48%; no real harmony claim.

The increased empty-reference emissions are a regression, not a waived gate.
MIC audibility, annotation offsets, room sound and decay tails can differ, but
this work has no independent listening adjudication proving those predictions
correct. Raising a single absolute floor to fit these labels would also discard
quiet supported notes. The white-noise/unit negatives do not establish real
noise robustness or full-band/instrument separation.

Concrete final probes (all observed notes, no sheet filling):

- Rock 4.21 s: `[64,69]`, previously both streams empty. The gate defect is
  repaired at this cell; sparse A/E evidence is not proof of the sheet's F chord.
- Jazz 3.61 s: `[45,57,60,64,68]`, previously empty. The three annotated pitches
  are recovered, **with two extras**. Harmony stays unknown/ambiguous with aug
  alternatives; this is not correct Am harmony or a clean transcription.
- SS 3.21 s: `[53,69]`; the unannotated A3 from the reviewed baseline is gone.
  The F-major alternative still lists missing C. F4 is not forced from labels.

## Supplemental DEV: keep register and identity evidence separate

Counts are exact MIDI / exact PCs / compatible primary / abstentions, followed
by the fixed frame denominator. A compatible alternative never counts as primary.

| Case | Starting | Final | Frames |
|---|---|---|---:|
| dev_v1_Amadd9_capo0 | 0/60/60/0 | 0/60/60/0 | 60 |
| dev_v1_Amadd9_capo3 | 0/60/60/0 | 0/60/60/0 | 60 |
| dev_v1_Cadd11_capo0 | 0/9/9/51 | 0/60/60/0 | 60 |
| dev_v1_Cadd11_capo3 | 0/60/60/0 | 0/60/60/0 | 60 |
| dev_v1_Amadd11_capo0 | 0/0/0/60 | 0/0/0/60 | 60 |
| dev_v1_Amadd11_capo3 | 0/41/41/13 | 0/0/0/60 | 60 |
| dev_v1_Bdim7_capo0 | 24/24/0/61 | 61/61/0/61 | 61 |
| dev_v1_Bdim7_capo3 | 51/51/0/61 | 61/61/0/61 | 61 |
| dev_v1_Bhdim7_capo0 | 0/0/0/61 | 61/61/0/61 | 61 |
| dev_v1_Bhdim7_capo3 | 60/61/0/61 | 61/61/0/61 | 61 |
| dev_v1_E5_capo0 | 0/0/0/62 | 0/62/62/0 | 62 |
| dev_v1_E5_capo3 | 0/0/0/62 | 14/62/62/0 | 62 |

Totals: predicted false notes `895 -> 0`, missed notes `324 -> 587` on 3148
reference note-frames. Exact MIDI `135 -> 258` /728, PC exact `366 -> 608` /728.
This precision gain trades away register recall and does not solve the task.

All 244 dim7/hdim7 settled frames now recover the exact MIDI set and remain
unknown with compatible alternatives. The primary unambiguous denominator for
those equivalent identities is zero. This is useful note/uncertainty evidence,
not 100% primary chord accuracy and not evidence on real dim7 recordings.

E5 now has correct PCs/primary on both takes, with zero false upper aliases;
capo0 still omits E3 and has zero exact MIDI. Amadd9 loses its phantom A3 but
still omits E4: correct PCs hide the register miss. Cadd11 now has all PCs on
both takes but misses the doubled C. Both Amadd11 takes remain wrong; capo3
regresses from 41 to zero compatible primary frames. At .45 s capo0 has
`[45,50,57,60]`, missing E4; capo3 has `[48,53,63]`, missing two annotated voices.
No extra A4 or chord-template E was added to make the label look right.

## What remains an implementation limitation

C6 at .70 s still reports `[48,52,57]` and Am/C; it misses C4 and G4. The
missing G pitch class is distinct from choosing between equivalent C6/Am7 names.
No naming change can repair this observation failure.

A static spectrum can have the same partials for one bright note and an exact
harmonically aligned double. The new fitter recovers independently detuned
upper voices in focused tests, but conservative admission still misses many
exact/shared voices in frozen DEV. The actual recordings can contain onset,
phase and decay cues that this framewise attribution does not use. Therefore
these omissions are **remaining implementation limitations**, not proof every
missing annotated voice is physically inaudible or fundamentally unknowable.
The results do not meet the requested register-recall objective. A future fix
must use independent temporal/source evidence; reintroducing fixed octave
supports or adding sheet/chord tones would hide failure rather than solve it.

## Resource and cancellation checks

Linux x86_64, Rust 1.89.0 release, same four-voice repeated development waveform
as the historical probe. Core and CLI only; not a browser/device benchmark.

| Input | Wall | User CPU | Peak process RSS | Features | Poly events | Harmony events |
|---|---:|---:|---:|---:|---:|---:|
| 30 s | .43 s | .43 s | 9,180 KiB | 375 | 24 | 17 |
| 600 s | 8.66 s | 8.56 s | 115,472 KiB | 7,500 | 450 | 302 |

Both exited 0. Historical wall times were 1.11/19.22 s. Combined result+features
JSON is 54,173/1,074,297 bytes; this is not the result-envelope size. Result and
note/harmony limits were not raised. SIGINT exited 130 in .00625 s with no
published destination. Malformed raw length and NaN returned exit 2 without
output. This fixture's reduced event/voice counts are not music-accuracy proof.

Root now owns source-associated native/WASM regeneration, broader independent
recheck, acceptance, any future authorized holdout and deployment. This handoff
explicitly leaves musical gates unmet; no holdout permission is inferred.
