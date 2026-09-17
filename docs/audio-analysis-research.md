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
- a 30-second fixture stays below the expected frame count and a generous runtime ceiling.

The production build additionally verifies that Vite resolves and bundles the module worker. These tests cover the detector's intended evidence, rejection behavior, and bounded work; real recordings still need human review because source separation and full polyphonic transcription are outside this implementation.

## Matching and playback

The matcher follows the pasted sequence with variable note/chord lengths and
allows the recording to have an intro and outro. It uses octave-sensitive pitch
for single notes and pitch-class evidence for chords or simultaneous tab frets.
It limits skipped audio and rejects weak targets, silence, broadband noise,
wrong-octave melodies, and adjacent identical targets whose boundary cannot be
inferred. The score is evidence strength, not a calibrated probability.

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
