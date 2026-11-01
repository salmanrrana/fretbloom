# Portable Opus parent acceptance

Independent recheck of root's parent upload fix, plus the fresh Docker build and
packaged journey that was held during the last Opus review. Frozen input:
`target/portable-root-integration/freeze-parent-fixed.json`
(SHA256 `6a7f9573bca29806875749cb2a48766fdc5f733fe7f18c5cbc2298649edf605f`).
Opus 5.5 xhigh, no children, no product edits. Musical acceptance is still
FAILED and was not re-examined.

## Result: PASS (scoped). No blocking finding.

The P1 from `docs/rust-portable-opus-closeout.md` is fixed. Back/reopen and
Edit/Cancel no longer replay the old upload, in the real parent and in the
freshly built image. Deliberate retries in the open player still work.

## A. Inventory and diff

- All 212 files and both native binaries match the freeze, at start and at
  release (`target/portable-opus-parent-acceptance/freeze-verify-{start,end}.json`).
  The native hashes are the same as the previous freeze, which makes sense for a
  UI-only change.
- Compared with the previous freeze (`5a3afd6a…`): one existing file changed
  (`src/components/SongbookMode.tsx`), and three were added under
  `validation/songbook-regressions/parent/`. Nothing else.
- The SongbookMode change is 7 added lines
  (`target/portable-opus-parent-acceptance/songbookmode-parent-fix.diff`, taken
  against an identical copy of the old file):
  - `:303` opening the editor clears `initialUpload`.
  - `:411` save clears the editor's `uploadFile` after handing it off
    (`:398`, `:408` read it first, in the same render).
  - `:421` a completed `audioAnalysis` update clears `initialUpload`.
  - `:441` remote discard/reset clears it.
  - `:749` Back clears it.
- No callbacks, worker, core, numerical or manifest edits. Not a broad rewrite.

### Lifecycle check (code reading)

- Every way out of the player clears the handoff: Back (`:749`), Edit
  (`openBench`, `:303`) and remote discard (`:441`). The list can only be reached
  through those paths (or `remove`, which deletes the song), so a later mount
  never receives the old file.
- The analysis panel copies the file into its own state once
  (`src/components/AudioAnalysisPanel.tsx:56`). When the parent later clears the
  prop, the panel keeps its file, so "Analyze recording again" stays enabled
  (`:280`) and uses it.
- Playback (`src/components/SongbookPlayer.tsx:139`, `rich || initialFile`)
  keeps its source, because the result (`rich`) is set in the same handler
  that triggers the clear.
- If a result is too large to save, the player returns before `onUpdate`
  (`SongbookPlayer.tsx:786`), so the handoff stays until Back or Edit clears it.
  That's harmless.
- Behavior change, by design: leaving the player while the first analysis is
  still running now means reattaching the file after reopening, instead of the
  analysis restarting on its own. This matches the on-screen "Audio is temporary.
  Reattach…" text.

## B. Real parent regression (root harness, my output)

`validation/songbook-regressions/parent/run.mjs`. I read it first: it checks
WASM `fd11…`, mounts the real `SongbookMode`, and uses the real FFmpeg, Rust
backend, Node and Chromium. It counts actual job POSTs, uses private free ports,
its own temp and profile, and `watch: null`, and cleans up at the end. No
detector mocks. Root's red run shows the 1-second wait does catch a replay.

Output: `target/portable-opus-parent-acceptance/parent/results.json` (exit 0,
no page errors).

| Path | New job on reopen | B hash kept | Manual timing kept | Lyrics kept |
| --- | --- | --- | --- | --- |
| Back/reopen | no (2 → 2) | yes `d88ccfd7…` | yes (`manual`, `[0.159353]`) | yes |
| Edit/Cancel | no (4 → 4) | yes `d88ccfd7…` | yes (`manual`, `[0.139315]`) | yes |

The backend exited, and its temp and profile folders were removed.

### One extra check: retry and edit handoff

The root test doesn't cover whether the open player can still retry on purpose
after the parent drops its copy, or whether an edit with a new file still hands
the file off. I wrote my own harness for that:
`validation/portable-opus-parent-acceptance/retry/run.mjs`, real parent,
same stack. Output: `target/portable-opus-parent-acceptance/retry/results.json`.
All checks passed, with no page errors:

- Retry A in the same session: 1 new job, same hash `94883c9e…`.
- Retry B after manual timing + lyrics: 1 new job, same hash, manual timing and
  lyrics unchanged.
- Edit, choose C in the editor, then save: 1 new job, C saved (`ea03a13c…`).
- Back/reopen after that: no job, C kept. Retry is correctly disabled without a
  file.

## C. Fresh Docker build and packaged journey

- Ordinary copy of exactly the 212 frozen files (not a Git checkout):
  `target/portable-opus-parent-acceptance/docker-context/`.
- The actual Dockerfile, unchanged, was built with
  `--no-cache-filter wasm-builder,rust-builder,node-builder` and exited 0
  (`full-image/`). All compile steps ran fresh: native `cargo build` (101.7 s);
  WASM `cargo fetch` + strict `wasm-build.mjs --check` (fresh compile, "Fresh
  build matches checked-in WASM artifacts", `WASM verified fd11…`); and Node
  `npm ci` + `npm run build` (runs `wasm:verify`). The tools stage rebuilt
  because the bootstrap script changed. Only base WORKDIR/node-copy and the
  runtime apt/yt-dlp setup layers came from cache.
- Image `sha256:c8b469ccf66d5b30389ceef06b2782c7c9e85b5e3792f55752341bc31e4c6c4c`.
- A cached export of the just-built stages (`extract-built-bytes/`, explicitly
  not a second fresh build) matches the frozen set: raw `4e8d5b32…`, all ten
  artifacts, and the manifest byte-for-byte. Source `fd11…`, rust-dsp-3.1,
  bridge 2 / schema 1 (`build-inheritance.json`). The container's native backend
  is `5e3430c5…`. It depends on build paths, so I don't require it to match the
  host binary.

Packaged run (`packaged-2/`, `container-runtime-2/`):

- Runs as `node` (UID 1000), Node 24.22.2, no mounts, no `DATABASE_URL`. One
  port, published on loopback only (`127.0.0.1:32773 → 4173`). Rust 5210
  listens only on the container's loopback, with no IPv6 listener. The only
  shipped WASM is portable `0f247f41…`.
- Storage: `NODE_ENV=development`, browser-only localStorage. No production
  credentials, database, sibling repo or default preview.
- API probe (owns its own job): POST and PUT 202, native success, real result
  plus features. The decoded PCM hash is `d5b3a0cb…`, the same as the prior
  independent run. Full GET returns all 240,044 expected WAV bytes. HEAD returns
  an empty body with the exact length. Range 0–43 returns 206 with the exact
  bytes. DELETE returns 202 and leaves result/features/audio at 409. A separate
  upload-then-cancel job ends canceled.
- Browser (Chromium 143.0.7499.4): upload, Save, playback, seek, manual timing,
  lyrics, reload, verified reattachment, and the same-name changed recording
  that invalidates timing and lyrics. Also mobile overflow and the tuner. All
  original assertions are kept. The UI's own final DELETEs (202) are expected.
  No page errors.
- Added packaged parent check (before the reload, so the handoff is live):
  Back/reopen and Edit/Cancel each started **0** new browser jobs, and hash,
  manual timing, lyrics and revision were unchanged (`docker-parent-check.json`).
  On the old code each would have started a job.
- Incidental upload journey time was 2576 ms. That's not a performance gate.
  No YouTube or network media.

### Failures kept (harness only, not product)

`target/portable-opus-parent-acceptance/failure-ledger.json`:

1. Packaged attempt 1 (`container-runtime/`, `packaged/`, exit 1): Chromium
   aborted at launch with SIGTRAP. When adapting the harness I dropped the prior
   harness's short TMPDIR alias. Chrome's lock socket path under my temp folder
   was 143 bytes, over the 108-byte Unix socket limit. The container checks
   before the browser step had passed, and the container was removed. Fix:
   restore the same `/proc/<pid>/fd/<n>` alias, then rerun once into new
   folders. No assertion changed.
2. My background wait loop matched its own command line and spun until its
   1-hour limit after the build had already finished at 02:38:52Z. This cost
   wall time only.

Script adaptations: `docker-run.mjs.adaptation.diff`,
`docker-e2e.mjs.adaptation.diff`. The e2e diff only redirects output paths and
adds the parent check.

## D. Inheritance and scope

All ten artifacts are byte-identical to the prior independent container run and
to root's `fixed-artifact-inheritance.json`. So the earlier independent module
safety, controls and parity results carry forward, along with Node/WPE cost,
busy cancellation/retry, CPU, scoped audio and persistence evidence. I did not
rerun them. Musical acceptance remains FAILED. The three native event-cap
failures and earlier failures stay recorded. No Safari, physical microphone,
universal RSS or GC claims.

## Non-blocking notes for root

- P3 hygiene: `crates/fretbloom-analysis/tests/__pycache__/resource_probe.cpython-312.pyc`
  is in the 212-file freeze and so enters the Docker context. It is untracked
  and not git-ignored. It doesn't affect the WASM source association (that only
  hashes `crates/*/src`), but it would be committed as-is. Suggest ignoring
  `__pycache__/` and leaving it out.
- P3, existing behavior: a file picked in the editor and then canceled
  (`SongbookMode.tsx:725`) stays in `uploadFile`. Every normal editor opening
  clears it (`:304`). The one exception is remote discard with an empty remote
  (`:443`), which opens the editor without clearing, so the old file name (and
  the old title/tab) would show there. The name is visible before saving, so
  this isn't a silent replay. Not caused by this fix.

## Release

329 protected inputs and the frozen inventory are unchanged
(`verification.json`). I stopped only my own backend, Chromium and container.
Ports 45301, 36581, 32772 and 32773 refuse connections. I removed my own temp
folders (the Chromium lock folder and an empty Pulse folder). My image and build
cache are kept. Commands: `commands.json`. Evidence hashes:
`evidence-inventory.json`. Release record: `heavy-release.json`. Root owns
fixes, integration and commit decisions. No commit, push, deploy or adoption.
