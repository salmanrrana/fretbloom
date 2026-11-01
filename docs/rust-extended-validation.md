# Supplemental extended-chord development corpus v1

New immutable inputs live in `validation/extended-audio/v1/`: 12 mono 24 kHz
16-bit PCM WAVs, independent `manifest.json`, and manifest-hash `lock.json`.
Manifest SHA-256: `5ffc1729f9db6132150d6552bc56a1c2d5ab026ab1bf8789fb490954fbc0192c`. Frozen before the first detector run.
No original frozen corpus, source selection, labels or locks were edited.

CC0-1.0 generated audio and labels. `validation/extended-audio/evaluate.py`
contains handwritten low-to-high string/fret/MIDI labels and standalone scoring.
Only the read-only original renderer's `pluck` is reused; no detector imports or
engine-derived truth. Each chord is rendered with staggered 18 ms string plucks,
fixed deterministic noise excitation and zero detuning, 0.25–1.75 s sustain,
2.1 s total. Settled scoring starts 120 ms after last string attack and ends at
1.65 s. Grips use standard E2/A2/D3/G3/B3/E4 tuning, low E string index 0:

| Intended name | Grip low to high | MIDI at capo 0 | Other equivalent identities |
|---|---|---|---|
| Amadd9 | x02410 | 45,52,59,60,64 | none within declared vocabulary |
| Cadd11 | x33010 | 48,53,55,60,64 | none within declared vocabulary |
| Amadd11 | x00210 | 45,50,57,60,64 | none within declared vocabulary |
| Bdim7 | x2313x | 47,53,56,62 | Ddim7, Fdim7, Abdim7 |
| Bhdim7 | x2323x | 47,53,57,62 | Dm6/B |
| E5 | 022xxx | 40,47,52 | thirdless power chord, eligible quality 5 |

Each has capo 0 and physical capo 3 versions, for two transpositions per family.
Amadd9 uses a reachable 0–4 fret spread; the other grips use 0–3. Handedness,
actual fingering and composer intent are not scored. Equivalent candidates are
checked by independently declared pitch-class intervals. dim7 root symmetry and
hdim7/m6 ambiguity are explicit; bass alone cannot prove intended root.

```sh
# Initial creation only; refuses to replace existing v1:
python3 validation/extended-audio/evaluate.py build
python3 validation/extended-audio/evaluate.py selfcheck
python3 validation/extended-audio/evaluate.py evaluate --binary validation/real-audio/results/snapshots/20261031T142452.943030Z/analyze-pcm
```

Input selfchecks verify frozen manifest/audio hashes, physical string/fret/MIDI
consistency and every equivalent pitch set. The oracle test accepts true notes,
rejects octave-shifted exact-set answers and wrong chord identity, and proves an
unknown event with a correct alternative receives zero primary credit.

Actual binary SHA-256 `f941005b62b1199831b8bc6b2711b66bbc5928b09d913c8660a99ef172e25c24`. Exact snapshot source/config/platform provenance is
in `validation/real-audio/results/snapshots/20261031T142452.943030Z/snapshot.json`; no exact binary-source association is attested.
Raw outputs, decoded PCM, commands and stderr: `validation/extended-audio/results/20261031T142544Z-jqig_e1j`.

| Case | Settled frames | Exact MIDI | Exact PCs | Intended primary | Compatible primary | Compatible alternative | Abstention | Bass correct |
|---|---|---|---|---|---|---|---|---|
| dev_v1_Amadd9_capo0 | 60 | 0 | 60 | 60 | 60 | 0 | 0 | 60 |
| dev_v1_Amadd9_capo3 | 60 | 0 | 53 | 53 | 53 | 7 | 7 | 60 |
| dev_v1_Cadd11_capo0 | 60 | 0 | 7 | 7 | 7 | 2 | 53 | 60 |
| dev_v1_Cadd11_capo3 | 60 | 0 | 60 | 60 | 60 | 0 | 0 | 60 |
| dev_v1_Amadd11_capo0 | 60 | 0 | 0 | 0 | 0 | 30 | 56 | 60 |
| dev_v1_Amadd11_capo3 | 60 | 0 | 0 | 0 | 0 | 48 | 16 | 60 |
| dev_v1_Bdim7_capo0 | 61 | 34 | 34 | 0 | 0 | 61 | 61 | 61 |
| dev_v1_Bdim7_capo3 | 61 | 45 | 45 | 0 | 0 | 61 | 61 | 61 |
| dev_v1_Bhdim7_capo0 | 61 | 46 | 46 | 0 | 0 | 61 | 61 | 61 |
| dev_v1_Bhdim7_capo3 | 61 | 58 | 59 | 0 | 0 | 61 | 61 | 61 |
| dev_v1_E5_capo0 | 62 | 0 | 0 | 0 | 0 | 0 | 19 | 62 |
| dev_v1_E5_capo3 | 62 | 0 | 46 | 46 | 46 | 5 | 16 | 62 |

All entries are counts, with the displayed settled-frame denominator. Primary
intended and compatible identity are distinct; neither grants credit for an
alternative. On dim7/hdim7 the unambiguous-primary denominator is **zero**, not
244; all 244 frames abstain with compatible alternatives. This is descriptive
uncertainty support, not 100% primary accuracy. Examples with times, expected and
actual MIDI and full event evidence are embedded per case in report.json.

Concrete failures: Amadd11 capo 0 at 0.45 s expects [45,50,57,60,64]; consult
that report's first example: actual [45,50,57,60,83,90], adding B5/F#6
while omitting E4 (64); the event is unknown with alternatives. The two
madd11 takes receive 0/120 compatible primary frames. Cadd11 capo 0 receives
7/60, compared with 60/60 in capo 3: inspect register dependence. E5 at capo 0
gets 0/62 compatible primary, vs 46/62 in capo 3. Bass is correct on all 728
settled frames, but this does not rescue incorrect chord or note identities.

These are development challenges, not an acceptance extension or independent
real-guitar validation. Rendered noise-string excitation omits measured body,
room, pickup, finger/pick noise, nonlinear amplifier effects and player timing.
All takes share one synthesis family; capo variants are correlated. Some high
register voices can decay faster than the literal note interval. Only six grips
and two transpositions are covered. There is no real madd9/add11/madd11/power-5
coverage here, and real dev dim7 is absent; real dev hdim7 exists only in solo
sheet context, not strong comp identity evidence. No real extended-family success
can be inferred. Evidence goes through root to a new independent Astra reviewer
before engine changes. The builder continues, so snapshot failures may be stale.
