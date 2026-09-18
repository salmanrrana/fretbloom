# Local song analysis research

## Decision

Fretbloom retrieves the public YouTube video selected by the user through its server, converts its audio to a bounded mono WAV, then decodes and processes that audio in the browser. The result is timing evidence for matching a pasted tab, not a claim of perfect audio-to-tab transcription.

The implemented path is:

1. Reject empty files, encoded files over 50 MB, and decoded audio over 10 minutes.
2. Decode the complete file with `AudioContext.decodeAudioData()`.
3. Mix channels equally and reduce the sample rate to at most 12 kHz.
4. Transfer the reduced mono PCM buffer to a dedicated Vite module worker.
5. Every ~85 ms, analyze a 4096-sample window and return RMS, normalized 12-bin chroma, and an optional predominant MIDI note.
6. Join stable predominant pitches into conservative note spans. Silence, broadband noise, and frames where several pitches compete return `midi: null`.
7. Label the chords of the whole recording from the chroma (24 major/minor triads plus "N"), independent of any pasted sheet.

The worker keeps FFT and feature extraction off the UI thread. Abort during file reading stops the `FileReader`; abort during decode rejects immediately; abort during analysis terminates the worker. Progress covers reading, decoding/downmix preparation, and frame analysis. Browser decoding itself exposes no incremental progress, so that section necessarily advances in one step.

## Why YouTube analysis needs a server

An embedded YouTube player exposes playback control, state, current time, duration, volume, and metadata through its iframe API. It does not expose decoded PCM samples. This is visible in the official [YouTube IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference), whose API surface is for controlling and observing the player.

Even a regular cross-origin `<audio>` or `<video>` element cannot be routed into Web Audio for inspection unless its server opts into the origin. The Web Audio specification requires a `MediaElementAudioSourceNode` to output silence for a CORS-cross-origin resource, specifically to prevent a page from inspecting another origin's media. See [Web Audio API §1.22.4](https://www.w3.org/TR/webaudio-1.0/#MediaElementAudioSourceNode-security).

Together, these constraints mean the parent page cannot reliably inspect the sound inside a YouTube iframe. The implemented server retrieves the exact public video with yt-dlp and returns its audio to the browser. A streamed-audio fallback is necessary for videos whose direct audio URL returns 403; see [live verification](youtube-live-verification.md). Capturing a microphone pointed at speakers would add room noise, echo, and permission friction; screen/tab capture requires an explicit browser sharing flow and system-audio support varies by browser and operating system.

## Decoding and memory limits

`decodeAudioData()` accepts a complete encoded `ArrayBuffer` and returns decoded PCM. It does not decode fragments. See [MDN's `decodeAudioData()` reference](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) and the normative [Web Audio decoding algorithm](https://www.w3.org/TR/webaudio-1.0/#dom-baseaudiocontext-decodeaudiodata).

That makes the implementation broad and codec-aware, but it also means the browser temporarily holds the encoded file and the full decoded buffer before Fretbloom can downsample it. The 50 MB / 10 minute limits bound work, but a long high-rate stereo file can still need a few hundred megabytes while decoding and may fail on a memory-constrained phone. Codec support also comes from the browser; an extension or MIME type cannot guarantee decodability.

After decode, the analysis buffer is bounded to roughly 7.2 million mono float samples for ten minutes at 12 kHz (about 29 MB), then transferred rather than copied to the worker.

## What the detector can and cannot infer

The implementation uses a Hann-windowed FFT plus harmonic salience over MIDI 40–88 (roughly E2–E6). Chroma sums the evidence by pitch class and remains useful when several strings ring. A single MIDI pitch is emitted only when the frame is tonal, its fundamental rises well above the spectrum's average, and its harmonic score clearly beats competing pitches.

This is intentionally a lightweight synchronizer:

- Clear solo melodies and single-note guitar lines should produce useful note spans.
- Chords should produce chroma evidence while usually leaving the predominant note blank.
- Silence and noise should not turn into confident notes.
- Dense mixes, drums, distortion, reverb, bends, alternate tunings, and overlapping harmonics can weaken or mislead the evidence.
- The result does not identify string/fret choices and is not a generated tablature score.

True polyphonic transcription is a larger problem. Spotify's Basic Pitch, for example, uses a trained model with harmonic constant-Q inputs and separate onset, note, and pitch-bend outputs. Spotify also describes why overlapping harmonics and note boundaries are difficult. See the primary [Basic Pitch engineering write-up](https://engineering.atspotify.com/2022/6/meet-basic-pitch) and [ICASSP paper](https://ieeexplore.ieee.org/document/9740683). A future opt-in model could improve polyphonic notes, but it would add a model download, startup cost, and a much broader accuracy surface. The current no-model detector is small, deterministic, private, and honest about ambiguity.

## Verification

`src/audio/songAnalysis.test.ts` generates audio fixtures rather than relying on opaque recordings. It checks:

- silence returns zero chroma and no notes;
- a two-note sine melody yields both expected MIDI notes and bounded confidence;
- a decaying, overtone-rich guitar-like fixture stays on its fundamental;
- an equal-level C major triad keeps C/E/G as the strongest chroma classes while refusing a predominant note;
- deterministic broadband noise yields no notes;
- cancellation and progress behavior;
- a 30-second fixture stays below the expected frame count and a generous runtime ceiling;
- silence yields a single "N" chord segment, a C major triad yields a "C" segment, and a lone melody yields "N" rather than chords.

`src/audio/fixtures/ccr-rain.json` holds the analyzer's features (chroma, RMS, predominant MIDI; no audio) for CCR "Have You Ever Seen The Rain" (165 s, YouTube bO28lB1uwp4), a real full-band mix with vocals, together with a hand-verified timeline of its 60 chord runs. `src/audio/chordRecognition.test.ts` checks a synthetic held-triad/silence/blip case and that recognition on the real recording finds every real change within tolerance (0.6 s, 0.9 s at the softer slash-bass boundaries) and labels at least 85% of the plain-triad runs correctly. `src/audio/songAlignment.test.ts` keeps the synthetic intent tests (intro/outro, not bridging a different chord, rests between notes, octave-sensitive melody above and below the sheet, silence/noise/wrong order/too-short rejection, repeated chords split evenly, oversized input, a reduced 8,400-frame x 600-target analysis) and adds the real recording: the 68-step sheet aligns reliably at transpose 0 with every run start within tolerance and strictly increasing times, the same sheet written two semitones up still follows the video and reports `transpose: -2`, the first verse alone is placed on 0:04-0:46, a chorus-only paste is refused naming the F it would have to bridge, one inserted D is tolerated and named, and chords pasted past the end of the music are reported.

The production build additionally verifies that Vite resolves and bundles the module worker. These tests cover the detector's intended evidence, rejection behavior, and bounded work; other recordings still need human review because source separation and full polyphonic transcription are outside this implementation.

## Matching and playback

Chord recognition (`src/audio/chordRecognition.ts`) runs inside the analysis
and needs no pasted sheet. Each frame's chroma is compared by cosine
similarity with the 24 major/minor triad templates; a Viterbi pass over those
24 states plus "N" (silence or no clear chord) charges a fixed penalty per
change and commits to at least 0.3 s per segment, so a sung or bass note
cannot flip the label for a frame or two. On a frame where the analyzer
hears one predominant pitch, "N" outscores the best triad by a small margin:
a solo melody (every frame has a pitch) reads as no chord instead of a string
of triads, while a sung note over a held chord lasts a few frames and costs
less than two chord changes, so the chord holds (on the CCR recording 8.5% of
frames carry a pitch, in stretches of at most 0.6 s, and every change is still
found). Segments carry the mean similarity as confidence and use sharps
("F#m"). What it cannot do: sevenths, suspended
and slash chords resolve to the nearest triad (C/B usually reads as Em); a
loud vocal or bass note pulls the label toward a triad containing it (on the
CCR recording five of seventeen G runs read as Em while the singer holds an
E); a recording that is not at A=440 smears the chroma between bins and
weakens every label.

Sheet alignment (`src/audio/songAlignment.ts`) is a forced alignment.
Adjacent targets with the same pitch-class set (chords) or the same MIDI
notes (tab) collapse into runs; the runs must appear in order, each lasting at
least 0.25 s per chord step (0.07 s per note step), with a free intro before
the first run and a free outro after the last. The per-frame evidence for a
run is the cosine similarity between the chroma and the run's pitch-class
set, centered so flat chroma scores zero, minus a regret term: how far the
best free triad beats the run's chord on that frame. Without the regret a
run would happily swallow a different chord the paste omits; with it,
anything a chord's length long counts as a chord. Single tab notes keep the
octave-sensitive evidence from the detected MIDI. All 12 transpositions of
the paste (as signed semitones, -5..6, so a numbered tab follows a recording
below the sheet as well as above it) are ranked by order-free evidence on a
subsample of frames and the winner (0 on ties) is aligned; if that ordered
pass is not reliable and the winner was not 0, the sheet as written is aligned
too and the better result wins, since the order-free ranking can be fooled by
a sheet that uses the same chords in another key. The result reports the
chosen shift as `transpose`, the semitones the recording sounds above the
sheet, so a capo or another key still follows the video. Each run's span is
then split evenly across its steps: the boundary between two identical chords
is not audible, and for play-along it does not matter.

After the path is found, each chord run is scanned for a foreign stretch: at
least 1.25 s of consecutive audible frames where a triad outside the run's
chord beats it by more than 0.1 (triads contained in the chord do not count,
so C7 or C/B over plain C audio is a spelling, not a missing chord; on the
CCR sheet the longest such stretch in a correct run is 0.7 s, a held vocal E
over the final G). Inside the sheet such a stretch means the paste omits a
chord, and the result is refused naming the time and the triad heard ("At
0:46 the recording sounds like F while the sheet is still on Chord 3 (C)").
In the last run it means the recording carries on after the sheet ends, so
the run is cut there and a partial sheet gets its real span, reported as
"The sheet covers 0:04–0:46 of the song." The gates below are then judged on
that span.

An alignment is reliable when the recording is audible, the mean similarity
along the path reaches 0.62, the path explains at least 70% of what
unconstrained per-frame recognition scores on the same frames, and not too
many steps are weak. A run is weak when it scores below flat chroma (0.5), or
when the path held it at its minimum length while it scored below the
sheet's own average: the path kept it as short as it could, which is what a
chord that is not in the recording looks like, and a wrong sheet in the
right key shows up as many such runs. One weak step per 20 pasted steps (at
least one) is tolerated and named ("Chord 30 (D) was not heard clearly; check
it"); more refuses the match. Steps parked after the music ends get their
own wording ("Chord 69 (F) falls after the music ends", or, past the
allowance, "... and the rest of the sheet fall after the music ends"). A
reliable result's `reason` carries only these notes and is empty when there
is nothing to add; hard failures (no audio, too quiet, too short, too many
targets) return no times. The score is evidence strength, not a calibrated
probability.

Measured on the CCR recording (1,934 frames, 68 steps): alignment takes about
10-30 ms, recognition about 4 ms, and 58 of 60 run starts land within about a
quarter second of where the chroma flips (56 within 0.25 s, two more at
0.25-0.26 s; all within 0.75 s of the per-second ground truth). The two
exceptions are places where the recording departs from the sheet: the intro
G is played, then the bass walks on E for 0.8 s (which reads as C/E), then G
again; and the singer holds an E over the final G. In both the sheet's G is
heard from its second stretch, 1.2-1.4 s late. On the same recording the
first verse alone (8 steps) aligns at transpose 0 with its five changes
within 0.05 s and is reported as covering 0:04-0:46; a chorus-only paste,
`C F G C`, a 12-bar blues and a shuffled or reversed sheet are refused; one
bogus or substituted chord anywhere is named and the other 60 runs stay
within tolerance; the sheet written 2 or 5 semitones away follows with the
right `transpose`. Known limits: a sheet spelled with sevenths where the
record plays plain triads (C7 for C throughout) is refused, because the
four-note template scores lower than the triad on every frame and the path
falls apart; a verse pasted without its G's passes as covering 0:04-0:46,
because on this mix G beats C by less than the 0.1 margin. Worst case cost is
about 50 ms for 7,000 frames and 600 steps, on the main thread.

Saved video notes are tied to the video ID and parsed pitch sequence. Changed
notes, order, or capo trigger new matching; changed videos clear both notes and
timing. Only extracted features for the last two videos are cached in memory.
Saved note spans and timing remain in localStorage; raw audio is not persisted.

`e2e-youtube-sync.mjs` exercises the actual browser decoder, worker, and player
with controlled API and iframe responses. A generated phrase with known
pitches, harmonic overtones, decaying amplitudes, and known onsets checks note
estimates, timing within 350 ms, sheet-to-video seeking, playback-to-sheet
following, saved-result restoration, changed URLs, unavailable videos,
cancellation, and mobile layout. Actual public-video retrieval is verified
separately in [the live report](youtube-live-verification.md). The existing
`e2e-check.mjs` and `e2e-audio.mjs` cover tuner and microphone workflows. These
checks are not a transcription benchmark on commercial songs.
