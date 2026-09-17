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

Open **Greenhouse → Songbook**, paste a YouTube link, and select **Open YouTube
song**. The video opens and note analysis starts automatically. No audio files
or manual downloads are needed. Add a chord sheet or six-string numbered tab
if you want the highlights to follow the video. Clicking a highlighted step or
a detected-note timestamp seeks the video.

The importer supports public videos up to 10 minutes. It uses yt-dlp with a
streamed-audio fallback, converts to mono WAV on the server, and analyzes that
exact video in a browser worker. Temporary server files are cleaned up after
each request. Notes and timing are saved in your browser; changing the video or
pasted notes invalidates the relevant saved results.

Once notes are ready, **Lyrics & notes** looks for video captions, then tries
LRCLIB when exact track, artist, and duration metadata match. It places
notes beneath each timed line. Playback highlights the current line and note;
click either to seek. Notes in introductions and breaks stay visible too.
Video captions may include speech or imperfect automatic words, so the source
is labeled. If captions are missing or blocked, **Paste lyrics** accepts plain
text or LRC timestamps. Plain text stays untimed until you mark each line
against the video; it is never assigned guessed timing. Same-line text edits
preserve timing, while changing the line count requires retiming. Lyrics and
notes are saved together; changing the video clears both. **Original tab**
keeps your pasted tab accessible. **Focus lyrics** enlarges the reading area and
keeps playback controls above it. Use **Follow song** to toggle automatic scrolling.

Some YouTube uploads block embedded video (errors 101/150). The player detects
this and offers the same song audio directly in the page, using the recording
already retrieved for analysis. Audio stays in memory only; reopening after a
reload retrieves it again. Play/pause, a seek bar, back 10 seconds, and playback
speed control use the same clock for lyrics and notes. Unrestricted videos keep
their normal embedded player. **Watch on YouTube** remains available.

See [caption retrieval](docs/youtube-captions.md) and [matched lyrics lookup](docs/lyrics-lookup.md).

Note detection is experimental and works best with a clear solo instrument.
Dense mixes can be ambiguous; weak matches and indistinguishable repeated
steps stay unsynced. Manual video timing remains available when automatic
matching cannot place every step. The mic can also follow you playing a chord
or single note. The separate **Listen** mode checks a target chord.

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
cancellation, and the no-tab flow. Actual public YouTube retrieval was checked
separately; see [live verification](docs/youtube-live-verification.md).
[Analysis research](docs/audio-analysis-research.md) explains the detector and
its limits. YouTube can reject private, restricted, removed, or blocked videos;
these return an error instead of pretending analysis succeeded.

`npm install` configures the repository's pre-commit hook. It checks a temporary
snapshot of staged source/configuration, runs relevant typechecks and tests,
and leaves unstaged edits alone.
