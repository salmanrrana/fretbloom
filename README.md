# fretbloom

tune it and the wall blooms

A guitar tuner whose flower-wall background comes back into color as you tune.
Microphone audio stays on your device. Songbook can retrieve public YouTube
audio and analyze recordings through the Rust server. Local Listen capture uses
the checked-in Rust WASM engine in your browser.

## The tuner

- Mobile-tuned pitch detection with harmonic and octave-error guards
- Auto nearest-string detection, or tap a string to lock it
- Selectable microphones after permission
- 12 guitar and ukulele tunings
- Direction advice, cents needle, strobe ribbon, and per-string tracking
- A4 calibration 432–446 Hz

## Songbook

Open **Songbook** in the navigation, paste a YouTube link and the song's chord sheet
(chords written above the lyrics, the way tab sites print them) or a six-string
numbered tab, then select **Open YouTube song**. The video opens and analysis
starts on its own when the full backend is available: Rust analyzes the
server-decoded audio, and the browser aligns the pasted sheet using the returned
features and harmony evidence. Playback uses the same canonical recording.
YouTube must permit server-side retrieval.

**Chord sheet** is the play-along view. It shows your paste exactly as written,
sections included. Press play and the sounding chord lights up, the next chord
change is hinted, the sheet scrolls to keep the lit chord in view, and clicking
any chord seeks the video. The arrow keys and space step through by hand.
**Chords from this video** beside the player shows the sync status and, folded
one tap away, a timeline of the chords recognized in the recording (tap one to
seek). With a YouTube link and no sheet, the chord card follows the chords
heard in the recording instead, with a diagram and the chord coming up next.
When the recording sits in a different key from your sheet, it
says by how many semitones and suggests a capo fret or a transposition; the
sheet still follows. A sheet that covers only part of the song (a verse to
practice) is placed on that part and the panel says which stretch it covers;
a chord that was not heard clearly is named so you can check it. When the
automatic alignment is not reliable it says why (a chord the sheet skips, more
chords than the recording plays, or a sheet that does not match), and **Set
timing manually** lets you tap each chord as it arrives while the video plays.
A manual timing map survives later automatic analysis.

Repeated chord placements with weak audio support do not receive automatic
timing. Basic major/minor sheet chords use frame evidence. Rich chords need
matching harmony evidence for added tones, and inversions also need bass
evidence; unresolved targets require manual timing. The pasted sheet keeps its
full chord names. Real-song sheet alignment quality is currently unmeasured;
see the [version 1 contract](docs/sheet-alignment-contract-v1.md).

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

A chord held across lyric lines is labeled **held**, with only the current
line's occurrence highlighted. Tapping it seeks to that line, not back to the
original strum. **Use lyrics from your sheet** restores the pasted words for
review even after captions load; plain words still need manual timing.

The full backend supports bounded public-video import through yt-dlp and
FFmpeg. Rust estimates notes and harmony and returns features for sheet timing;
temporary job files are released after analysis. Local development without a
database saves songs in your browser. Server-backed persistence uses Postgres
and an owner password when configured. Changing the video or pasted sheet
invalidates the relevant timing. Unsupported engine/alignment versions require
reanalysis for automatic timing; readable estimates and manual timing remain.
Supported `rust-dsp-1` and `rust-dsp-3.1` results keep their original engine label.
YouTube may block retrieval, so link import is not guaranteed. Earlier hosted
checks are recorded in [deployment notes](docs/railway-deployment.md); this README
does not establish current hosted availability.

Some YouTube uploads block embedded video (errors 101/150), and some never
report anything at all. The player detects both (the silent case after a few
seconds) and offers the same song audio directly in the page, using the
recording already retrieved for analysis; if a slow player reports in later, a
button brings the video back. Audio stays in memory only; saved Rust results
require reanalysis to verify the recording after a reload. Unanalyzed songs and
failed first analyses can use the separate Node playback fallback. Play/pause, a
seek bar, back 10 seconds, and playback speed control use the same clock for the
sheet, lyrics, and chords. Unrestricted
videos keep their normal embedded player. **Watch on YouTube** remains available.

See [caption retrieval](docs/youtube-captions.md) and [matched lyrics lookup](docs/lyrics-lookup.md).

Chord recognition and alignment are estimates from the recording's harmony.
Dense mixes, fast changes, and unusual voicings can be misread. A weak match
refuses automatic timing rather than supplying an exact placement. The mic can
also follow you playing a chord or single note. The separate **Listen** mode
checks a target chord.

Numbered tabs currently assume six strings in standard tuning (high e first).
A written `Capo: 2` shifts the sounding pitches. Paste repeats in full; bends,
slides, harmonics, and alternate tunings are not interpreted. Chord names
directly above a numbered staff are annotations; separate chord-only sections
remain playable.

## Run locally

Use Node 24.22.2, matching `.nvmrc` and the Docker image. Python 3 with pip
and FFmpeg on PATH (or `FFMPEG_PATH`) are also required. npm rejects Node
versions outside the supported `^24.22.2` range.

```bash
nvm install          # if you use nvm; reads .nvmrc
nvm use
npm install
npm run setup:youtube # installs pinned yt-dlp in ignored .tools/, not globally
npm run dev          # Vite + Node media routes; no Rust server started
```

For the built app with the Node-only playback backend:

```bash
npm run build
NODE_ENV=development npm start # local browser-only Songbook on 127.0.0.1:4173
```

`npm run preview` also includes the Node YouTube API; it does not start Rust. See
[backend setup and hosting](docs/youtube-backend.md) for Docker and settings.
See [Railway deployment](docs/railway-deployment.md) for the owner password,
Postgres, and production setup.
Any database-backed start requires the owner password; an unconfigured
`npm start` refuses to run.

Repository configuration defines three capabilities:

- **Static Netlify:** builds and publishes `dist/` with an SPA rewrite. Tuner and
  local Listen work on-device. No Node acquisition or Rust job service is
  provided; Songbook stays behind its existing owner gate.
- **Node-only `npm start`:** serves the built app and Node media/API routes.
  YouTube playback fallback needs its media tools and network access. This
  command does not start Rust; full analysis is unavailable unless a separate
  compatible Rust service is reachable. Local Vite dev/preview have the same
  media routes and can proxy a separately started Rust service.
- **Supervised `npm run dev:full` / `npm run start:full`:** starts Rust plus
  Vite/Node, checks readiness and stops both when either exits. The checked-in
  Docker runtime uses `start:full`. This provides recording analysis and
  canonical playback in addition to the Node routes, subject to required tools
  and source availability.

These are repository configuration facts, not checks of hosted settings. No
production deployment is performed by these commands.

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

The older YouTube browser harness uses controlled audio/iframe responses and
the legacy acquisition route; it is not current Rust-path or musical-accuracy
evidence. Use the full Rust runtime harness below for current integration
checks. Earlier public retrieval checks are recorded in
[live verification](docs/youtube-live-verification.md).
[Analysis research](docs/audio-analysis-research.md) records earlier detector
work and its limits. YouTube can reject private, restricted, removed, or blocked
videos; these return an error instead of pretending analysis succeeded.

`npm install` configures the repository's pre-commit hook. It checks a temporary
snapshot of staged source/configuration, runs relevant typechecks and tests,
and leaves unstaged edits alone.

## Full Rust audio analysis (local)

The tuner and Listen stay on-device and work in a static build. Songbook full
analysis sends a chosen recording or a public YouTube ID to the server. Rust
analyzes decoded audio, then the player uses the canonical WAV on exactly that
timeline. Chords, bass and separate note streams are estimates; fit scores are
not probabilities, and no result identifies an exact guitar fingering.

Use Node **24.22.2**, FFmpeg/ffprobe, and the Rust **1.89.0** toolchain pinned in
`rust-toolchain.toml`. From this checkout, without database/hosted credentials:

```sh
npm ci
npm run setup:youtube
cargo build --locked --release --workspace
npm run dev:full
```

This reserves local ports **5202** (Vite/Node) and **5210** (private Rust), refuses
occupied ports, builds Rust and starts both services. Ctrl-C stops both. `npm run
dev` still starts only Vite. For the built app:

```sh
npm run build
NODE_ENV=development HOST=127.0.0.1 PORT=5202 npm run start:full
BASE_URL=http://127.0.0.1:5202 npm run test:rust-analysis
```

`npm start` keeps the Node-only compatibility path. Full analysis reports
unavailable if Rust is absent. The static Netlify build remains `npm run build`;
Songbook's existing owner gate stays in place, and the public tuner needs no Rust.

Two-terminal alternative (no supervisor):

```sh
FRETBLOOM_ANALYSIS_HOST=127.0.0.1 FRETBLOOM_ANALYSIS_PORT=5210 \
  YTDLP_PATH="$PWD/.tools/youtube/bin/yt-dlp" \
  NODE_PATH_FOR_YTDLP="$(command -v node)" target/release/fretbloom-backend
# In the second terminal:
FRETBLOOM_ANALYSIS_ORIGIN=http://127.0.0.1:5210 \
  npm run dev -- --host 127.0.0.1 --port 5202 --strictPort
```

The supervisor accepts `FFMPEG_PATH`, `FFPROBE_PATH`, `YTDLP_PATH`,
`FRETBLOOM_ANALYSIS_TEMP_ROOT`, and the private host/port above. Rust gets an
allowlisted environment with no database URL or owner password. Hosted Node
startup still requires the existing database and 20-character owner password;
no production setup or database migration is performed by these local commands.
Either child exiting stops the other, and shutdown escalates within seven seconds.

In Songbook, choose a recording instead of a YouTube link, optionally paste a
sheet or lyrics, and save/open the song. Cancel stops the current job. Replacing
a source aborts its requests. The analysis pane includes silence, unresolved
harmony and alternatives, bass, monophonic melody and tentative polyphonic notes.
Manual timing is preserved across engine/options changes. Automatic timing is
versioned against the sheet and engine; extensions and slash bass require matching
rich evidence before automatic placement is accepted. Diagrams are suggested
fingerings; unsupported shapes do not define alignment targets.

Saved songs contain analysis and timing, never audio, feature frames, job IDs or
blob URLs. On reopening an upload, reattach it. Decoded PCM hash **and duration**
are verified before reusing timing; matching filename and length do not suffice.
YouTube results also need reanalysis to verify audio before reopening playback.
Temporary jobs/audio can expire or disappear on restart. Detailed results that
would exceed the existing 2 MiB song limit remain in-session with a JSON download;
lyrics/manual timing are never silently trimmed to fit. Older clients may drop
new optional analysis fields when editing the same song, so mixed-version editing
is not lossless. YouTube acquisition can be blocked by its provider and is
independent of captions/lyrics availability.

Local container verification (no database):

```sh
docker build -t fretbloom-rust-audit:local .
docker run --rm --name fretbloom-rust-audit-local \
  -e NODE_ENV=development -e HOST=0.0.0.0 \
  -p 127.0.0.1:5203:4173 fretbloom-rust-audit:local
BASE_URL=http://127.0.0.1:5203 npm run test:rust-analysis
```

The multi-stage image includes only built Node assets/dependencies, the backend
binary and media tools. It runs as `node`, exposes one public port, and excludes
validation media, compiler caches and local secrets. The E2E command synthesizes
its own small development WAV and exercises actual decoding/analysis/playback,
persistence, verified reattachment and replacement. It does not establish music
accuracy on real recordings or use the independent evaluation corpus.

## Local capture and the checked-in Rust WASM engine

Public Listen captures an explicitly shared tab or microphone/interface locally.
It buffers context and emits provisional notes/harmony during capture, then can
refine each uninterrupted segment after stopping. Captured PCM does not use the
server analysis client. Five-minute audio, thirty-minute wall-time and bounded
worker/memory limits preserve an exportable partial session on engine failures.
Scores describe evidence, not a probability that the notes/chords are correct.

The worker uses the portable Asyncify build, so cancellation does not require
browser JSPI support. Canceling refinement retains the recording for another
attempt; a new analysis waits for the previous input to be released. If that
release cannot be confirmed, reload is required before further analysis.
These runtime improvements preserve the `rust-dsp-3.1` detector's output.
Complex voicings, wide vibrato and some long recordings still fail the musical
acceptance checks; Listen is an estimation tool, not verified transcription.

Normal `npm run dev`, `npm run build`, and Netlify use the tracked distributable
under `src/generated/analysis-wasm/`; **Rust is not required** for those commands.
They first verify artifact hashes and their exact source/tool association. A
missing/stale artifact is an error, with rebuild instructions, rather than an
automatic download or a different detector. Node is pinned to **24.22.2**.

To rebuild after changing Rust engine inputs, using that Node version:

```sh
npm run wasm:bootstrap
npm run wasm:build
npm run wasm:verify
node scripts/wasm-build.mjs --check
```

Bootstrap explicitly installs Rust **1.89.0**, `wasm32-unknown-unknown`, and
wasm-bindgen CLI **0.2.100** under `.tools/wasm-bindgen-0.2.100`; it does not install
a global wasm-bindgen command. Bootstrap also fetches checksum-pinned Binaryen
**125** for the guarded Asyncify transformation. The wrapper pins the same crate version. The
portable target has no mandatory SIMD, threads, SharedArrayBuffer, COOP or COEP.
The target-only linker flag caps WASM linear memory at 128 MiB. Build outputs
include generated JavaScript, types, WASM and a canonical SHA256 manifest. Build
checks source stability before/after compilation and replaces the set only after
successful generation; `--check` rebuilds into a disposable directory and compares
bytes. Do not edit the manifest to cover source drift. Docker verifies a fresh
WASM build and retains the existing native backend/non-root supervised runtime.
The portable safety checks are tied to the reviewed raw module. A numerical
engine change requires renewed module validation and reviewed pins before the
normal build can publish it; replacing expected hashes alone is not sufficient.

Stored listening sessions use their own browser database. Retained audio is
canonical mono float32 little-endian PCM with SHA256 verification before restore;
WAV export is separate. Old results remain readable with their recorded engine
version. Reanalysis with a newer engine requires an explicit user choice, then
replaces results only after every eligible segment succeeds. Short segments
abstain; silence/gaps and separate mono/polyphonic streams remain distinct.

Reproducible builds also remap project and Cargo cache paths to canonical
`/workspace` and `/cargo` prefixes in WASM compiler diagnostics. These mappings
are recorded in the manifest's tool flags; they keep native machine cache paths
out of generated WASM and make the Docker byte comparison meaningful.
The builder also pins wasm-bindgen's opaque metadata suffix and prevents it
from discovering an enclosing repository's Git HEAD. The suffix preserves the
reviewed bytes; it is not an upstream wasm-bindgen revision.
In a full checkout, bootstrap also fetches the locked workspace dependencies so
the subsequent offline build works with a fresh Cargo cache.
