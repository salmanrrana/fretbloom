# YouTube audio backend

FretBloom analyzes public YouTube audio through a small same-origin Node server. The existing Netlify site is static and cannot run `yt-dlp` or `ffmpeg`, so YouTube analysis needs the self-hosted server described below (or a future separate backend).

## Local setup

Requirements:

- Node.js 24 or newer
- Python 3 with `venv`
- `ffmpeg` on `PATH`

Install the project-local downloader once:

```sh
npm run setup:youtube
```

The setup script creates `.tools/youtube` and installs the pinned `yt-dlp[default]` release. It prefers a Python virtual environment and falls back to a project-local pip target on systems where Python was packaged without `venv` support. Requests explicitly give yt-dlp the current Node executable as its JavaScript challenge runtime. The default install includes the official `yt-dlp-ejs` challenge solver, so requests do not fetch executable components at runtime. No browser cookies or credentials are read.

`npm run dev` and `npm run preview` mount the same middleware. For a built, self-hosted app, run:

```sh
npm run build
npm start
```

The standalone server listens on `0.0.0.0:4173` by default and serves both `dist/` and the API. Set `HOST` or `PORT` to change that. Optional tool overrides are `YTDLP_PATH` and `FFMPEG_PATH`.

## API contract

`GET /api/youtube-audio/:videoId` accepts an exact 11-character YouTube video ID. The server constructs the YouTube watch URL itself; it never accepts an arbitrary URL.

On success it returns `audio/wav`: signed 16-bit PCM, mono, 12 kHz. `X-Video-Title` contains the URI-encoded title. Responses are not cached.

Errors are JSON:

```json
{
  "error": {
    "code": "VIDEO_TOO_LONG",
    "message": "Videos must be 600 seconds or shorter."
  }
}
```

The backend checks metadata before downloading, rejects live or longer-than-10-minute videos, caps source downloads at 50 MiB, and retries a failed direct audio download with a dynamically selected audio-only HLS format when the video offers one. It limits concurrent work to two requests, rate-limits each directly connected address, times out work, cancels subprocesses when a client disconnects, and removes every temporary directory. Error responses never include downloader output, filesystem paths, or credentials.

## Container hosting

`Dockerfile` is a complete single-container build for a small self-hosted service:

```sh
docker build -t fretbloom .
docker run --rm -p 4173:4173 fretbloom
```

The container includes Python, the pinned project-local yt-dlp environment, ffmpeg, the built frontend, and the Node server. This is a hosting option only; building the image does not deploy or modify the live Netlify site.

The server needs outbound HTTPS access to YouTube. Installing or rebuilding also needs access to Python package hosting. Public YouTube extraction can break when YouTube changes its site; update the pinned yt-dlp version in `scripts/setup-youtube.mjs` after reviewing a newer release.
