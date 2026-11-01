# Portable Opus closeout review

Independent final check of the root integration frozen in
`target/portable-root-integration/freeze.json`
(SHA256 `5a3afd6af016427f10252d2c6f0190ad984d069b551ec7d3a6303c1d912abb57`).
Scope: the four review fixes, nearby code paths, test selection, artifact
inheritance and the cold-cache proof. Musical acceptance is still FAILED and was
not re-examined.

## Result: FAIL (one open P1 blocker)

### Open finding (P1): reopening a song replays a stale upload

- `src/components/SongbookMode.tsx:168` holds `initialUpload`. It is set only
  on editor save (`:396`, `:406`). Back (`:743`), the list's open button
  (`:766`) and editor Cancel (`:720`) never clear it.
- `:741` hands it to every new player mount for that song.
- Fix 2 (`src/components/AudioAnalysisPanel.tsx:63-68`) now correctly
  analyzes any explicit file, so the stale file is analyzed again.
- Repro in a real browser through the real `SongbookMode` parent (harness:
  `validation/portable-opus-closeout/parent-reopen/`, output:
  `target/portable-opus-closeout/parent-reopen/results.json`):
  1. Create a song in the editor with recording A (440 Hz WAV). One job runs and
     A is saved.
  2. Choose recording B (880 Hz) inside the player. A second job runs and B is
     saved.
  3. Click Back, then reopen the song without choosing a file.
  - Expected: B stays and no job runs.
  - Actual: a third job runs and the saved song goes back to A (hash, file name
    and automatic timing). Through the normal result handler this also clears
    lyrics and replaces non-matching timing.
- Code reading shows Edit followed by Cancel takes the same path, because the
  editor view unmounts the player. This variant was not run.
- The older harness (`validation/songbook-regressions`) mounts the player
  directly, so it cannot see this. `docs/rust-root-product-closeout.md:93`
  ("ordinary reopening retain[s] their previous behavior") is only true for
  that direct mount and should be updated with the fix.
- Root already found this (`target/portable-root-integration/review-fixed.json`).
  A small fix in the parent is needed: clear the upload once it has been handed
  to the player.

### Verified

- Frozen inventory: all 209 files and both native binaries match at start and
  at release. The manifest source hash is `fd11c6c2…`. All ten generated
  artifacts match `fixed-artifact-inheritance.json`, including raw WASM
  `4e8d5b32…` (in `portable/generation.json`), reference `a2be0bfd…` and
  portable `0f247f41…`.
- Test selection: there is no root `vitest.config.*`. `vite.config.ts` only
  excludes `.tools`, `target` and `validation` copies. 40 app test files are on
  disk, matching the 40 in `check-fast-fixed.log`. The only removed tracked test
  (`src/audio/songAnalysis.test.ts`) was removed together with its deleted
  module, and nothing imports that module. Node fixture and control-entry tests
  run explicitly in `npm test`.
- Fix 1 (numbered-tab note evidence): source matches the description. Check B
  rerun passed (below).
- Fix 3 (RMS): the parser accepts finite values from 0 up to `Number.MAX_VALUE`.
  The unit test rejects -1, NaN and Infinity. Everything downstream that reads
  RMS (`chordRecognition.ts`, `songAlignment.ts`) compares against the peak, so
  values above 1 are safe.
- Fix 4 (bootstrap fetch): it only runs when `Cargo.toml` exists, so Docker's
  tools-only stage skips it and the wasm-builder stage fetches on its own. The
  cold-cache logs show the order: offline failure on `ctrlc`, then a locked
  fetch (118 crates, including `ctrlc-3.5.2`, in the owned cold cache), then an
  offline build that passed and verified. Small gap: the logs do not record the
  exact commands or environment variables.
- Check B (`validation/songbook-regressions/run.mjs`, output
  `target/portable-opus-closeout/songbook/`): 5 of 5 pass with no page errors.
  The real backend was used, with no mocks. The backend exited and the temp
  directory was removed.

### Not run

- Check C (fresh Docker build and packaged smoke test) was held on root's
  instruction, because the P1 needs a source fix first. No image, container or
  build was started.

Evidence inventory: `target/portable-opus-closeout/inventory.json`. Release
record: `target/portable-opus-closeout/release.json`.
