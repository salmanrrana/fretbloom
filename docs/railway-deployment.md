# Railway deployment

Current Free project: [fretbloom on Railway](https://railway.com/project/418c3e25-d718-4e8f-8d2f-f20e030117b1). The app URL is
[fretbloom-production.up.railway.app](https://fretbloom-production.up.railway.app).
The Postgres service has no public endpoint. The owner username is
`salmanrrana`; the password is stored as a sealed Railway app variable and in
`/home/xtra/.config/fretbloom/railway-owner-password` on the owner's machine
(directory mode 700, file mode 600). It is not in this repository.

The Railway app serves the React pages and APIs from one Docker service. The
tuner at `/` and Listen at `/listen` are public. The Songbook at `/songbook`,
its songs, and its YouTube APIs require the single owner password. Songs live
in Postgres, not in the browser. A database-backed server always requires a
password of at least 20 characters; the production entrypoint also requires
`DATABASE_URL`.

The Dockerfile pins Node to `24.22.2-bookworm-slim` for both build and runtime,
matching the local `.nvmrc`. The server runs TypeScript directly with
`node server/index.ts`; no extra loader or TypeScript compilation step is
needed at startup. Keep `.nvmrc`, the Docker image, and the Node engine range
in `package.json` and `package-lock.json` aligned when updating Node. Railway
must build this Dockerfile so that Python, FFmpeg, and yt-dlp are included too.

The login prompt uses username `salmanrrana` and the configured
`FRETBLOOM_ACCESS_PASSWORD`. Use a unique random password, keep it in a password
manager, and share it with nobody. Basic authentication has no separate logout
button: close the browser's private window to discard its cached credential, or
rotate the Railway variable to revoke it. Railway's public domain provides
HTTPS; do not send this password over plain HTTP.

## Services

1. Create a private Railway project and add an empty service named `fretbloom`.
2. Add Railway Postgres with `railway add --database postgres`. Keep its network
   private; the app needs no public database endpoint.
3. Set these variables on the **app service**:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}` (use the actual Postgres service
     name if different).
   - `FRETBLOOM_ACCESS_PASSWORD`: a unique 32-byte or longer random value,
     stored as a sealed Railway service variable.
   - `NODE_ENV=production` (also set by the Dockerfile).
4. Configure the app service healthcheck path as `/health`. Keep it at one
   replica while its per-visitor and sign-in limiters are in memory. On the
   Free plan, enable Railway Serverless for both the app and Postgres; Free
   requires sleeping services. The first request after idle can be slow.
5. From this checkout, run `railway up --service fretbloom`. Railway uses the
   root Dockerfile. The container runs as the non-root `node` user. The server
   binds Railway's `PORT` on `0.0.0.0`.
6. After the deployment is healthy, add a Railway public domain to the app
   service. Verify `/` and `/listen` work without credentials while `/songbook`
   and `/api/songs` return 401. Then sign in and save/reload/delete a song.
   Only then share or bookmark the URL.

Railway's [CLI guide](https://docs.railway.com/cli), [Postgres setup](https://docs.railway.com/databases/postgresql), and [service variable references](https://docs.railway.com/variables) describe the current commands and reference syntax. Railway's older `railway.json` config is being retired, so the service healthcheck should be set in Railway service settings rather than a new config file.

## Data and operations

- The first time the owner opens the Postgres songbook on the **same browser
  origin** as an old local songbook, the app imports any missing songs and
  removes the old browser copy. Older song IDs are remapped when the database
  requires a different format. Browser storage from a different domain, such
  as the old Netlify site, cannot migrate automatically; export or re-enter
  those songs separately before retiring that site.
- The server creates the `songs` table on startup and stores each song under
  the server-defined owner ID. Browser requests cannot choose an owner ID.
- Pending song edits and deletions stay in this browser until Postgres confirms
  them. If a save fails, leave the tab open or reload when connectivity returns;
  the app retries those pending changes.
- Audio is processed temporarily by the app service and never stored in
  Postgres. A live request for `MDTgKVF-IZM` returned 422 because YouTube sent
  Railway's IP an HTTP 429 bot challenge. Local extraction of the same public
  recording succeeds. Keep YouTube audio import and analysis on local development
  for now; the hosted importer cannot analyze that song. Do not put personal
  YouTube cookies on the server.
- Railway rejected a native backup schedule on this Free workspace with `Not
Authorized`. Keep a separate copy of irreplaceable songs; the authenticated
  `GET /api/songs` response contains the complete songbook as JSON. Check
  backup availability again if you upgrade the plan. Rotate the owner password
  in Railway variables if it is exposed.
- Free provides $1 of monthly usage credit. Watch the project usage after a few
  days of normal play; Railway can stop services when the credit is exhausted.
  The workspace can be upgraded to Hobby later without recreating the project.
- The existing Netlify deployment is a separate static site. This Railway
  setup does not make that older URL private. The new build deliberately
  refuses to open Songbook on a static host without `/api/session`; publish it
  through Railway, and retire or restrict the older Netlify URL after moving
  any browser-only songs you want to keep.

## Optional CPU guitar focus

The runtime image installs the pinned offline Demucs guitar separator with
`npm run setup:separator`. It runs as the existing non-root user and uses one
worker. This feature needs gigabytes of RAM; a roughly 0.5 GB free service cannot
run it. Provision at least 4 GiB RAM, two CPU cores and 1.5 GiB writable temporary
space, with job deadlines measured in minutes. See
[guitar isolation validation](guitar-isolation-validation.md) for exact local and
container measurements and the separate-worker design. No deployment or hosted
configuration changes are part of this implementation.

The Demucs code license does not cover the model weights. The author's
scientific-purpose statement does not establish permission for personal-app,
public or paid deployment of this exact checkpoint. Clarify permission or replace
the weights before deploying/distributing the packaged image. See the validation
report's upstream sources. Missing or failed separation is shown explicitly;
the owner can choose full-mix analysis instead.
