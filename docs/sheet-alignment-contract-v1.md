# Sheet alignment contract v1

Tier A is sheet-informed placement: place an ordered pasted sheet on the
recording, or explicitly refuse automatic timing with a reason. Accepted times
must increase, stay within the associated recording, and identify the matched
section and any transposition. A partial sheet may cover only part of a song.
Repeated identical chords without audible boundaries are ambiguous, not new
sound changes. Manual timing remains available.

- **Major/minor triads:** use frame evidence to choose among the sheet targets.
- **Tab notes:** use octave-sensitive MIDI for single notes and chroma evidence
  for simultaneous notes; ambiguous evidence can refuse placement.
- **Rich chords and inversions:** also require matching harmony evidence for
  root, quality and characteristic tones. Inversions require bass evidence.
  Chroma timing alone cannot verify an added tone or slash bass. Current rich
  evidence must cover at least 60% of the inferred span and support its start.

Engine/alignment compatibility is an explicit allowlist, separate from sheet,
source, decoded PCM and playback checks. Alignment v1 accepts `rust-dsp-1` and
`rust-dsp-3.1`; old results keep their original identity. Unreviewed engines or
alignment versions cannot restore automatic timing. Estimates may remain
readable, and manual timing survives. Reopening still requires the existing
recording verification; this policy does not replace it.

**Tier A quality is currently unmeasured.** Deterministic frame tests, the
historical detector-derived CCR fixture and runtime correctness checks do not
establish real-song placement accuracy. Independent prewritten sheets and
annotated audible changes, including refusal cases, are still needed. Frame
features depend on detected notes; rich placement also depends on harmony.

Tier B is a provisional free estimate of notes, harmony and bass without a
sheet. Show unknown/unresolved spans and equivalent chord names honestly.
Evidence scores are not probabilities; suggested diagrams are not identified
fingerings. No general transcription accuracy is promised.

Tier C is research into better recognition. Changes need a causal explanation
of a measured failure and a frozen test that can reject the proposal. Keep
resource caps and refused/failed cases visible. A diagnostic trace does not
itself justify changing the engine or establish musical accuracy.
