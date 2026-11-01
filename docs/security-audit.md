# Production security check (2026-09-26)

Scope: the FretBloom frontend, Node API, Docker image, JavaScript dependencies, single-owner access gate, Postgres song storage, and the new Railway Free deployment. The older Netlify production site was not changed.

## Findings and changes

| Finding                                                                                | Result                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rate limits grouped all users behind a hosting proxy under its connection address      | Fixed for Railway's public edge using its documented `X-Real-IP` header. Only a single valid IP is accepted; other environments ignore the header. An HTTP test imports as two visitors behind one proxy and verifies separate limits, repeat blocking, and invalid-header fallback. |
| Docker server ran as root                                                              | Changed the runtime to the image's unprivileged `node` user. Temporary processing uses the writable system temp directory.                                                                                                                                                           |
| Docker's `COPY . .` could include local `.env` files, npm credentials, or private keys | Excluded those files in `.dockerignore`. Supply future database credentials through Railway service variables.                                                                                                                                                                       |
| `npm audit` found one moderate advisory affecting Vitest and its mocker dependency     | Updated Vitest to patched 4.1.11. The affected packages were development-only; the production image prunes them. The complete JavaScript audit now reports zero known advisories.                                                                                                    |
| Songbook and API had no owner access control                                           | Added a password gate before `/songbook` and all APIs. Tuner and Listen remain public. Production startup requires a strong configured password and database URL. Failed sign-ins are rate limited.                                                                                  |
| Songs existed only in browser storage                                                  | Added a Postgres-backed song API. The server fixes the owner ID and uses parameterized queries. The browser loads remote songs before displaying the songbook, remaps legacy IDs while importing, and clears the local copy.                                                         |
| Security headers were missing                                                          | Added frame denial, referrer and permission policies, content-type protection, and HSTS on HTTPS requests.                                                                                                                                                                           |
| Another site could make an authenticated browser trigger expensive API work            | Browser requests marked `Sec-Fetch-Site: cross-site` are rejected before the APIs run.                                                                                                                                                                                               |

Code review also found strict 11-character YouTube IDs, fixed upstream destinations, subprocess arguments passed without a shell, no browser cookies, bounded downloads/responses, temporary-file cleanup, and generic public errors. No tracked credential or environment file was found. This review does not prove the API is resistant to every attack.

## Still needed for a public launch

- Keep the API on one app replica while limits live in process memory. With multiple replicas, use a shared counter or Railway edge rule. The two concurrent audio-processing slots are also per replica.
- Keep the owner password private and use HTTPS only. Basic authentication has no explicit logout or device management; rotate the password to revoke it. A future multi-user product needs separate accounts and sessions.
- Watch traffic and errors after launch. The audio API remains costly even though the owner password protects it.
- Test YouTube extraction from the actual hosting network. Local success does not establish that a cloud IP can reach every public video.
- Keep Railway Postgres on its private network and retire or restrict the older static Netlify URL separately. Railway refused a native backup schedule on this Free workspace, so export irreplaceable songs from the authenticated API until backups are available.
- YouTube sent Railway's IP an HTTP 429 bot challenge for the audit recording. The hosted API returned 422; local extraction works. Keep YouTube import local for now. Do not store personal YouTube session cookies on the server.

## Verification

- `npm run check:fast`: 123 tests passed, one opt-in real-Postgres test was skipped without its disposable database, and lint and strict typecheck passed. The opt-in test passed separately against disposable Postgres.
- `npm audit --registry=https://registry.npmjs.org --json`: zero known JavaScript advisories after the Vitest update.
- Docker image built successfully. In the running container, the server used UID 1000; the homepage returned 200, an invalid video ID returned 400, and importing the audit song returned 200 with a 5,718,094-byte WAV response.
- Owner-only HTTP save/reload/delete passed against a real local Postgres container; unauthenticated frontend and API requests returned 401. A headless browser saved a song, reloaded it from Postgres, deleted it, and verified the deletion after reload. The updated production Docker image built and pruned to zero known production npm advisories.
- A browser retained local songs on the static preview, a built local server worked without Postgres, and remote-plus-local songs both survived migration and reload against Postgres.
- A failed Postgres save and deletion both survived a browser reload and completed on retry. A saved manual timing map did not light a chord before its start after stale analysis was removed.
- Routed desktop and phone browser checks verified public `/` and `/listen`, denied Songbook access without credentials, and owner save/reload with Postgres. Local Vite preview exposed a local-only session so its Songbook remains usable.
- Railway's live `/health`, `/`, and `/listen` returned 200; `/songbook` and `/api/songs` returned 401 without a password. Owner sign-in, an empty songbook, and browser create/reload/edit/reload/delete/reload passed against live Postgres. The temporary song was deleted.

References: [Railway public proxy headers](https://docs.railway.com/networking/public-networking/specs-and-limits), [Railway Postgres private connections](https://docs.railway.com/databases/postgresql), and the [Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).
