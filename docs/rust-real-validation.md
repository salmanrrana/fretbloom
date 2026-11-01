# Independent real guitar validation

Prepared only under `validation/real-audio/**` and this document. No Rust
execution, detector-derived labels, implementation tuning, service startup,
production access, commits, or branch changes. This is an acquired and checked
corpus plus an evaluator, **not evidence of Rust music accuracy**.

## Acquired corpus and fixed selection

GuitarSet **1.1.0**, original MIC recordings and original JAMS annotations from
https://zenodo.org/records/3371780. Six complete mono WAV files total **15,300,212
bytes**, **173.468798 seconds**, **744 string-note events**. Four players, five
styles, six declared keys. Original 44.1 kHz recordings retained without trimming
or normalization. Annotation files are retained too, separately from the sample
budget. See [attribution](../validation/real-audio/ATTRIBUTION.md) for CC BY 4.0
verification, credits, and primary sources. Zenodo licenses the dataset including
both recording and annotation archives; the repository MIT license is irrelevant.

| Split | Original recording | Seconds |
| --- | --- | ---: |
| dev | 00_Rock2-142-D_solo | 27.042 |
| dev | 00_SS3-84-Bb_comp | 45.708 |
| dev | 01_Jazz3-150-C_comp | 25.600 |
| holdout | 04_BN1-129-Eb_solo | 22.324 |
| holdout | 05_Funk2-119-G_comp | 32.263 |
| holdout | 05_Jazz2-187-F#_solo | 20.532 |

Filenames were chosen by metadata before any detector run. Players and takes are
disjoint across splits; different lead sheets are selected as well. This small
convenience subset is not a representative population sample. All three known
erroneous files listed by the authors are excluded; no attempted repair.
Solo/comp describes the player's task, not guaranteed monophony/polyphony.

HTTP `206` ranges succeeded. `fetch.py` reads the ZIP central directory, then
only selected compressed members; it verifies exact Content-Range, ZIP member
size and CRC32. No full audio archive was downloaded. Cached ranges live under
ignored `.cache/`. Original member SHA-256 hashes are frozen in `manifest.json`.
Zenodo-advertised full-archive MD5s are preserved in the API snapshot but **not
verified**, because the whole archives were not fetched. `corpus-lock.json`
pins the manifest SHA-256; the runner checks all selected source hashes.

## Reproduction and future Rust command

From the checkout root, Python 3 standard library and FFmpeg are required:

```sh
python3 validation/real-audio/fetch.py
python3 validation/real-audio/prepare.py
python3 validation/real-audio/selfcheck.py
```

The source API snapshots are checked in. Refetching does not update source metadata
or select different files. Existing manifest replacement is refused if any labels
change. Cache can be removed; running fetch again uses HTTP ranges. Source-check
results are in `validation/real-audio/source-checks.json`.

After the builder produces the documented `analyze-pcm` CLI:

```sh
cargo build --locked --release -p fretbloom-analysis --bin analyze-pcm
python3 validation/real-audio/evaluate.py --binary "$PWD/target/release/analyze-pcm" --split dev
```

The runner decodes each source via FFmpeg to original-timeline 24 kHz mono f32le,
then invokes `--input PCM --sample-rate 24000 --mode auto --concert-a-hz 440
--spelling sharps --output JSON`. It reads `AnalysisOutput.result` as specified in
`docs/rust-architecture.md`; it imports no implementation. Results include binary,
manifest and decoded PCM SHA-256, FFmpeg version, failures and per-recording scores.
The report also records checkout revision, machine and auto-mode configuration.
Raw outputs/stderr remain in ignored `results/`; temporary decoded PCM is deleted.
Each invocation uses a fresh directory; failing stage, exit status and stderr are
retained. Any failure prevents publication of partial scores. No automatic pass threshold
has been claimed for real recordings.

**Do not run holdout until root explicitly freezes the implementation.** After
that approval, substitute root's recorded binary hash (a hash alone is not approval):

```sh
python3 validation/real-audio/evaluate.py --binary "$PWD/target/release/analyze-pcm" --split holdout --frozen-binary-sha256 ROOT_APPROVED_64_HEX_HASH
```

The runner requires a matching hash. Do not tune to holdout or recycle it as dev.
A newly appearing binary is not permission to run it on holdout.

## Labels, metrics and limitations

Original notes are fractional MIDI semitones, one annotation per string. The
manifest keeps string and original center pitch; evaluation rounds to nearest
MIDI note, including octave. Overlapping equal-MIDI strings merge for audible
note-event scoring. No string/fret accuracy claim is possible from MIC analysis.

Frames use fixed 20 ms centers. Frames with exactly one distinct reference MIDI
score `monophonicNotes`; frames with two or more score `polyphonicNotes`.
Precision, recall, F1 and exact MIDI-set agreement are reported separately.
Reference-silent frames count the union of both output streams to expose false
positives. This is reference-conditioned measurement, not an oracle mode choice
provided to the detector, which always runs auto. A union-only diagnostic and wrong-stream/duplicate emissions are reported
separately; the union never replaces separate-stream scores. Finite numerical
evidence, note pitch/name/cents, chord candidates and bass fields are checked
before scoring, without treating fit scores as probabilities. Frame scores include attacks
and decays; no result-dependent stable-window selection or alignment correction.

Events use maximum one-to-one matching, exact MIDI, 50 ms onset tolerance, and
separate onset-only and onset+offset F1. Offset tolerance is max(50 ms, 20% of
reference duration). Poly events score the whole excerpt; mono events score
reference notes without any overlap, and predicted mono events outside reference
polyphony. Counts reveal absent/very small mono-event support. Soft guitar tails,
rearticulation and merged unisons limit event interpretation.

Chord root, exact quality, annotated bass and root+quality+bass joint accuracy
are duration/frame weighted **separately**, with unknown/no-chord output counting
as disagreement on labeled chords. Source-quality counts and supported-quality
accuracy are included. Source Harte labels retain additions, omissions and
alterations. Only exact supported bare qualities are mapped (7->dom7,
maj6->6, min6->m6). Extended/altered unsupported labels stay unsupported; they
remain in all-label denominators, and their coverage is explicit. No collapsing
ninths into sevenths or manufactured notes from chord names.

Performed and instructed annotations score separately. Treat **comp performed**
results as the primary chord evidence, with per-case results retained; solo
harmony and instructed labels are contextual comparisons. Do not pool these
into one accuracy headline. Played chord roots and boundaries come from lead
sheets; qualities/inversions derive from string notes, not independent acoustic
human adjudication. Source metadata mentions manual verification, but this does
not establish exact, human-adjudicated truth. A 100 ms region on both sides of
sheet boundaries is excluded, with counts reported. This tolerance does not fix
all strum anticipation/lag or sparse voicing ambiguity. Equivalent identities can
still disagree; the report deliberately does not grant guessed equivalences.

Two bass measures remain separate: source performed-chord slash degree converted
to absolute pitch class, and lowest simultaneously active annotated note pitch
class. Neither asserts an audible bass instrument nor exact bass timing. MIC room
response and any backing-track bleed can disagree with pickup-derived labels.
No full-band separation, instrument attribution, distortion, alternate tuning,
or noisy-phone accuracy is established by this acoustic-guitar subset.

## Coverage gaps

Exact performed qualities across this subset include maj, min, dom7, min7,
maj7, 6, m6, dim7 and hdim7. Dev contains exact maj/min/dom7/min7/hdim7;
maj7/6/m6/dim7 have exact examples only in holdout. That is a coverage warning,
not permission to inspect detector results or tune to those cases.

The subset has **no exact supported labels for sus2, sus4, add9, madd9, add11,
madd11, dim, aug, or power-5**. For example `A#:maj(2)` is retained as a source
extension rather than silently mapped to add9. Altered/rootless sus and ninth
labels occur but do not validate their simpler families. The chosen clips cannot
establish broad extended-family accuracy, and synthetic coverage remains needed.
Additional independently selected recordings would need a new versioned corpus.

## Checks actually completed

Four automated tests pass: frozen source/manifest/hash and annotation checks;
FFmpeg decode length/timebase on every file; event matching and octave/tolerance
counterexamples; and scoring fixtures for correct/wrong notes, root, quality,
bass, wrong-stream routing, malformed evidence and invalid timeline coverage. These are evaluator tests, not music results.
Source checks verify six string tracks, seconds against WAV duration (within
0.002 s), annotation containment, contiguous chord segments and pitch units.
All 744 centers were compared with source contour mean Hz in each note's
25–50% region: median error per recording is below 0.00034 semitones, maximum
0.241. This supports unit/string/timebase interpretation; it does not prove that
every source note is audible or that annotations match MIC onsets exactly.
