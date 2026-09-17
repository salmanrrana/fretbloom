# YouTube public-audio live verification

Verified on `2026-09-16T22:20:00-05:00` from the current development host. This was a real public YouTube media fetch, not a fixture or mocked response.

## Result

Public-link audio extraction **works on this host**, but the ordinary `bestaudio` path is not reliable enough by itself:

- Metadata for a current public yt-dlp test video succeeded without cookies, authentication, a proxy, or browser-profile access.
- The direct HTTPS M4A selected by `bestaudio` failed with `HTTP Error 403: Forbidden`.
- An audio-only HLS variant advertised in the same metadata downloaded successfully. FFmpeg decoded the complete output without an error.

The product can support paste-link-to-analysis with a server process, provided it selects an HLS audio fallback dynamically. One successful public video does not establish universal coverage; YouTube delivery formats and access behavior vary by video and can change independently of Fretbloom.

## Environment

- Python `3.12.3`
- Node `v24.16.0`
- yt-dlp `2026.08.19`
- `yt-dlp-ejs` `0.8.0`, installed by the `default` extra
- FFmpeg `7.0.2-static` at `/home/xtra/.local/bin/ffmpeg`
- No `ffprobe` binary was present on this host

Python's `venv` module could not bootstrap because Debian's `ensurepip` component is absent. The probe therefore followed the planned fallback and installed into an isolated target directory:

```sh
python3 -m pip install --upgrade \
  --target /tmp/fretbloom-youtube-probe-python \
  'yt-dlp[default]'
```

This is the install form recommended by yt-dlp's [official installation guide](https://github.com/yt-dlp/yt-dlp/wiki/Installation#with-pip). The project lists FFmpeg, FFprobe, `yt-dlp-ejs`, and a supported JavaScript runtime as strongly recommended dependencies in its [official README](https://github.com/yt-dlp/yt-dlp#dependencies). The [official EJS guide](https://github.com/yt-dlp/yt-dlp/wiki/EJS) supports Node 22 or newer and the `node:/path/to/node` syntax used below.

## Live commands and evidence

The historical yt-dlp test ID suggested for the probe is no longer usable:

```sh
PYTHONPATH=/tmp/fretbloom-youtube-probe-python \
python3 -m yt_dlp \
  --ignore-config \
  --no-playlist \
  --skip-download \
  --js-runtimes node:/home/xtra/.nvm/versions/node/v24.16.0/bin/node \
  --dump-single-json \
  'https://www.youtube.com/watch?v=BaW_jenozKc'
```

It exited `1` with:

```text
ERROR: [youtube] BaW_jenozKc: This video is unavailable
```

The replacement was `YE7VzlLtp-4`, "Big Buck Bunny" from the verified Blender channel. It is the leading YouTube extractor case in the installed yt-dlp release and in yt-dlp's [current YouTube extractor source](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).

Metadata command:

```sh
PYTHONPATH=/tmp/fretbloom-youtube-probe-python \
python3 -m yt_dlp \
  --ignore-config \
  --no-playlist \
  --skip-download \
  --js-runtimes node:/home/xtra/.nvm/versions/node/v24.16.0/bin/node \
  --dump-single-json \
  'https://www.youtube.com/watch?v=YE7VzlLtp-4' \
  > /tmp/fretbloom-youtube-probe-metadata.json \
  2> /tmp/fretbloom-youtube-probe-metadata.stderr
```

It exited `0` with an empty stderr. Relevant metadata:

```text
id: YE7VzlLtp-4
title: Big Buck Bunny
uploader: Blender
duration: 597 seconds
availability: public
live_status: not_live
formats: 43
direct audio-only formats: 10
```

The first real audio attempt used the normal direct-audio preference:

```sh
PYTHONPATH=/tmp/fretbloom-youtube-probe-python \
python3 -m yt_dlp \
  --ignore-config \
  --no-playlist \
  --js-runtimes node:/home/xtra/.nvm/versions/node/v24.16.0/bin/node \
  --ffmpeg-location /home/xtra/.local/bin/ffmpeg \
  -f 'bestaudio[ext=m4a]/bestaudio' \
  --extract-audio \
  --audio-format m4a \
  --output '/tmp/fretbloom-youtube-probe-audio.%(ext)s' \
  'https://www.youtube.com/watch?v=YE7VzlLtp-4'
```

yt-dlp selected format `140`, then exited `1` with the exact media error:

```text
ERROR: unable to download video data: HTTP Error 403: Forbidden
```

The metadata also advertised format `233` as audio-only (`vcodec: none`) over `m3u8_native`. The bounded HLS retry was:

```sh
PYTHONPATH=/tmp/fretbloom-youtube-probe-python \
python3 -m yt_dlp \
  --ignore-config \
  --no-playlist \
  --js-runtimes node:/home/xtra/.nvm/versions/node/v24.16.0/bin/node \
  --ffmpeg-location /home/xtra/.local/bin/ffmpeg \
  -f 233 \
  --extract-audio \
  --audio-format m4a \
  --output '/tmp/fretbloom-youtube-probe-audio.%(ext)s' \
  'https://www.youtube.com/watch?v=YE7VzlLtp-4'
```

It downloaded all 117 HLS fragments and exited `0`. This explicit `233` is evidence for the probe, not a value to hardcode in the app.

Artifact:

```text
path: /tmp/fretbloom-youtube-probe-audio.m4a
size: 3,631,526 bytes
sha256: 23a95fb4baee20d76305eb7c087b1477b631a9b47f2599fc94990f764f73a983
```

Because this host has FFmpeg but not FFprobe, validation decoded the whole file to a null output:

```sh
/home/xtra/.local/bin/ffmpeg \
  -hide_banner \
  -v info \
  -i /tmp/fretbloom-youtube-probe-audio.m4a \
  -f null -
```

It exited `0` and reported one audio stream:

```text
Duration: 00:09:56.47
Audio: aac (HE-AAC), 44100 Hz, stereo, 48 kb/s
final decoded time: 00:09:56.47
```

yt-dlp warned that it could not run its own metadata inspection because `ffprobe` was missing. A deployed image should install the paired `ffmpeg` and `ffprobe` binaries and point `--ffmpeg-location` at their containing directory.

## Backend implications

1. Fetch metadata first, reject live/private/restricted content, and enforce the 10-minute limit before downloading.
2. Run yt-dlp as a subprocess with an argument array, `--ignore-config`, `--no-playlist`, the exact video URL built from a validated 11-character ID, a deadline, limited concurrency, and an isolated temporary directory.
3. Do not treat metadata success as media success. This probe proved that metadata can work while the selected direct audio URL returns 403.
4. Try the normal audio selection, then select an audio-only HLS candidate from the returned format metadata if the direct fetch fails. Choose by fields such as `vcodec === "none"` and `protocol` beginning with `m3u8`; do not hardcode format `233`. In this response the HLS entries reported `acodec: null`, so a selector that requires a known audio codec may omit them.
5. Enforce the byte limit again on the completed source. HLS metadata may not report a useful size, so `--max-filesize` alone is insufficient.
6. Convert the result to the existing browser analysis shape, such as 12 kHz mono PCM WAV, stream it with `Cache-Control: private, no-store`, and delete the temporary directory after response completion or cancellation.
7. Keep yt-dlp current. The project's own README notes that site changes can break a stable release between releases.

The `default` pip extra already supplied `yt-dlp-ejs` for this run. The [official option definition](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/options.py) says remote EJS components are unnecessary when the requisite `yt-dlp-ejs` package is installed, so the service does not need `--remote-components ejs:github` in its normal path.

If YouTube removes or blocks all advertised public audio variants for a video, reasonable link-only fallbacks are to keep Fretbloom's manual video tap-through sync or accept a creator-controlled direct audio URL. The official YouTube iframe API exposes playback control and timing, not decoded audio samples, so an embed alone cannot replace the server fetch.

## Integration review findings

A bounded read-only review after the first implementation found three lifecycle issues to resolve before shipping:

1. A successful automatic alignment must not overwrite a valid user-recorded `syncTimes` map. Cancellation also needs to survive the analysis panel being unmounted for manual recording; otherwise finishing manual timing remounts the panel, restarts automatic analysis, and can replace the map the user just made.
2. A matching saved `videoAnalysis` does not prove timing is present. Edits can remove `syncTimes` while retaining analysis with the same sound-based sequence key, after which the saved-result shortcut skips the work needed to recreate automatic timing. Persist and restore alignment times with the saved analysis, or make the shortcut aware of valid timing and prior unreliable results.
3. Aborting the direct yt-dlp child does not terminate subprocesses it may start. The verified HLS path invoked FFmpeg fixup, and EJS can invoke Node. Timeout or disconnect handling must terminate the subprocess tree, or explicitly configure the yt-dlp path so it cannot leave those children running.

## Final integration results

All three review findings were addressed. Automatic analysis preserves an
existing valid manual map; automatic times are saved with `VideoAnalysis` and
restored after canceled edits; the panel stays mounted during manual timing so
cancellation persists. Browser tests cover these cases. Backend cancellation
now terminates the complete process group (and uses Windows tree termination),
with a real parent/descendant test.

The actual application endpoint, `GET /api/youtube-audio/YE7VzlLtp-4`, returned
HTTP 200 with 14,315,460 bytes of mono 12 kHz PCM WAV in approximately six
seconds. The standalone built application then completed a no-tab YouTube
import with no mocked API: title “Big Buck Bunny”, 596.47425 seconds, 272
estimated note events, and no page errors. This verifies the live retrieval and
analysis pipeline, not the accuracy of every estimate in the mixed soundtrack.

Live embedded-video playback and timestamp seeking were also checked. Clicking
the actual YouTube player started playback; selecting the 10-second note
position moved the native video clock to 10.00563 seconds. Controlled browser
fixtures separately verify exact known pitches, automatic tab timing, stored
results, edits, manual-map preservation, cancellation, and failures.

Final local checks passed: 48 unit/integration tests, lint, strict types,
production build, the YouTube browser suite, the existing UI/audio suites, and
container image construction. The local preview runs the standalone server;
the public Netlify deployment was not changed.
