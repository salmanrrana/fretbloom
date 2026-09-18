# fretbloom

tune it and the wall blooms

A guitar tuner whose flower-wall background comes back into color as you tune.
Microphone audio stays on your device. Songbook can retrieve public YouTube
audio through a small server, then estimate notes and timing in your browser.

## The tuner

- Mobile-tuned pitch detection with harmonic and octave-error guards
- Auto nearest-string detection, or tap a string to lock it
- Selectable microphones after permission
- 12 guitar and ukulele tunings
- Direction advice, cents needle, strobe ribbon, and per-string tracking
- A4 calibration 432–446 Hz

## Songbook

Open **Greenhouse → Songbook**, paste a YouTube link and the song's chord sheet
(chords written above the lyrics, the way tab sites print them) or a six-string
numbered tab, then select **Open YouTube song**. The video opens and analysis
starts on its own: the server fetches the audio, a browser worker extracts
chroma and recognizes the chords, and the pasted sheet is aligned to the
recording. No audio files or manual downloads are needed.

**Chord sheet** is the play-along view. It shows your paste exactly as written,
sections included. Press play and the sounding chord lights up, the next chord
change is hinted, the sheet scrolls to keep the lit chord in view, and clicking
any chord seeks the video. The arrow keys and space step through by hand.
**Chords from this video** beside the player shows the chord sounding now, a
timeline of the chords recognized in the recording (tap one to seek), and the
sync status. When the recording sits in a different key from your sheet, it
says by how many semitones and suggests a capo fret or a transposition; the
sheet still follows. A sheet that covers only part of the song (a verse to
practice) is placed on that part and the panel says which stretch it covers;
a chord that was not heard clearly is named so you can check it. When the
automatic alignment is not reliable it says why (a chord the sheet skips, more
chords than the recording plays, or a sheet that does not match), and **Set
timing manually** lets you tap each chord as it arrives while the video plays.
A manual timing map survives later automatic analysis.

**Lyrics & notes** is the secondary view. It looks for video captions, then
tries LRCLIB when exact track, artist, and duration metadata match, and places
the chords sounding during each line beneath it (single-note estimates appear
only when no chords were recognized). Playback highlights the current line;
click a line or a chord to seek. Video captions may include speech or
imperfect automatic words, so the source is labeled. If captions are missing
or blocked, **Paste lyrics** accepts plain text or LRC timestamps. Plain text
stays untimed until you mark each line against the video; it is never
assigned guessed timing. **Focus lyrics** enlarges the reading area and keeps
playback controls above it; **Follow song** toggles automatic scrolling.

The importer supports public videos up to 10 minutes. It uses yt-dlp with a
streamed-audio fallback, converts to mono WAV on the server, and analyzes that
exact video in a browser worker. Temporary server files are cleaned up after
each request. Chords, notes, timing, and lyrics are saved in your browser;
changing the video or the pasted chords invalidates the relevant saved results,
and songs saved before chord recognition existed are analyzed once more (their
old automatic timing is redone; manual timing is kept).

Some YouTube uploads block embedded video (errors 101/150), and some never
report anything at all. The player detects both (the silent case after a few
seconds) and offers the same song audio directly in the page, using the
recording already retrieved for analysis; if a slow player reports in later, a
button brings the video back. Audio stays in memory only; reopening after a
reload retrieves it again. Play/pause, a seek bar, back 10 seconds, and playback
speed control use the same clock for the sheet, lyrics, and chords. Unrestricted
videos keep their normal embedded player. **Watch on YouTube** remains available.

See [caption retrieval](docs/youtube-captions.md) and [matched lyrics lookup](docs/lyrics-lookup.md).

Chord recognition and alignment are estimates from the recording's harmony.
They work best on clear recordings with steady chord changes; dense mixes,
fast changes, and unusual voicings can be misread, and a weak match is reported
rather than guessed. The mic can also follow you playing a chord or single
note. The separate **Listen** mode checks a target chord.

Numbered tabs currently assume six strings in standard tuning (high e first).
A written `Capo: 2` shifts the sounding pitches. Paste repeats in full; bends,
slides, harmonics, and alternate tunings are not interpreted. Chord names
directly above a numbered staff are annotations; separate chord-only sections
remain playable.

## Run locally

Requires Node 24+, Python 3 with pip, and FFmpeg on PATH (or `FFMPEG_PATH`).

```bash
npm install
npm run setup:youtube # installs pinned yt-dlp in ignored .tools/, not globally
npm run dev          # frontend + YouTube API together
```

For the built app with its backend:

```bash
npm run build
npm start            # default port 4173; use PORT/HOST to configure
```

`npm run preview` also includes the YouTube API. See
[backend setup and hosting](docs/youtube-backend.md) for Docker and settings.
The existing Netlify deployment is static: automatic YouTube analysis needs
the accompanying server. Building `dist/` alone does not add a backend to it.
No production deployment is performed by these commands.

## Verify

```bash
npm run check:fast    # lint, strict types, and focused tests
npm run build
BASE_URL=http://127.0.0.1:5201 node e2e-check.mjs
BASE_URL=http://127.0.0.1:5201 node e2e-audio.mjs
BASE_URL=http://127.0.0.1:5201 npm run test:youtube
BASE_URL=http://127.0.0.1:5201 npm run test:lyrics
BASE_URL=http://127.0.0.1:5201 node e2e-playback.mjs
```

The YouTube browser test uses controlled audio/iframe responses to verify
known notes, automatic timing, playback/seek, persistence, URL changes,
cancellation, the no-tab flow, and a strummed chord progression whose pasted
sheet must light up in time with the recording. Actual public YouTube retrieval was checked
separately; see [live verification](docs/youtube-live-verification.md).
[Analysis research](docs/audio-analysis-research.md) explains the detector and
its limits. YouTube can reject private, restricted, removed, or blocked videos;
these return an error instead of pretending analysis succeeded.

`npm install` configures the repository's pre-commit hook. It checks a temporary
snapshot of staged source/configuration, runs relevant typechecks and tests,
and leaves unstaged edits alone.
