# YouTube audio backend

FretBloom analyzes public YouTube audio through a small same-origin Node server. The existing Netlify site is static and cannot run `yt-dlp` or `ffmpeg`, so YouTube analysis needs the self-hosted server described below (or a future separate backend).

## Local setup

Requirements:

- Node.js 24.22.2 (see `.nvmrc`; npm accepts `^24.22.2`)
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
NODE_ENV=development npm start
```

This local mode listens on `127.0.0.1:4173` by default and serves both `dist/` and the API. Set `HOST` or `PORT` to change that. Any start with `DATABASE_URL` requires the owner password, and an unconfigured `npm start` refuses to run. Optional tool overrides are `YTDLP_PATH` and `FFMPEG_PATH`.

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

The backend checks metadata before downloading, rejects live or longer-than-10-minute videos, caps source downloads at 50 MiB, and retries a failed direct audio download with a dynamically selected audio-only HLS format when the video offers one. It limits concurrent work to two requests per endpoint, rate-limits each visitor to ten requests per minute per endpoint, times out work, cancels subprocesses when a client disconnects, and removes every temporary directory. Error responses never include downloader output, filesystem paths, or credentials.

On Railway, the limiter identifies visitors with the `X-Real-IP` header supplied by Railway's public edge. It accepts only a single valid IP address and falls back to the connection address when the header is missing or invalid. Outside Railway, it ignores proxy headers. Keep the service behind Railway's public edge when `RAILWAY_ENVIRONMENT_ID` is set. The limits are in process memory, so a second app replica would have separate counters; use a shared limiter or an edge rule before scaling beyond one replica.

## Container hosting

`Dockerfile` is a complete single-container build. For a local, loopback-only
trial without an owner account or database:

```sh
docker build -t fretbloom .
docker run --rm -p 127.0.0.1:4173:4173 -e NODE_ENV=development fretbloom
```

The container defaults to production mode. A hosted instance needs both
`FRETBLOOM_ACCESS_PASSWORD` (at least 20 characters) and `DATABASE_URL` for
Postgres or it refuses to start. See [Railway deployment](railway-deployment.md)
for the owner-only setup and private database connection. The loopback command
above is only for local testing; its Songbook is not password protected and
uses browser storage.

The container includes Python, the pinned project-local yt-dlp environment, ffmpeg, the built frontend, and the Node server. It runs the app as a non-root user and writes temporary media under the system temp directory. Local `.env` files, npm credentials, and private key files are excluded from the Docker build context. This is a hosting option only; building the image does not deploy or modify the live Netlify site.

The server needs outbound HTTPS access to YouTube. Installing or rebuilding also needs access to Python package hosting. Public YouTube extraction can break when YouTube changes its site or challenges a cloud IP. The current Railway deployment receives an HTTP 429 bot challenge for the audit song even with other supported yt-dlp client modes; changing the downloader version alone is not a verified fix. Update the pinned yt-dlp version in `scripts/setup-youtube.mjs` only after reviewing and testing a newer release.
