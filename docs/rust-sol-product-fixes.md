# Package A — Sol product fixes

2026-10-31. Implemented in `fretbloom-song-audit`, branch
`fix/song-playalong-audit`, over the existing uncommitted work. No commits,
index changes, pushes, deployments, hosted settings, databases, secrets, sibling
checkout changes or child agents. Builder B's paths and frozen source/config
were not edited. The required checks generated their ordinary local build and
cache outputs; product edits stayed in Package A's write set.

## Changes

| Task                | Change and source evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Compatibility    | `src/audio/analysisCompatibility.ts:6` reads the current engine identity from the generated manifest; `:12` is the explicit typed engine/alignment allowlist; `:20` checks it. All three obsolete checks now use it: `src/components/SongbookPlayer.tsx:194`, `src/components/AudioAnalysisPanel.tsx:141`, `src/data/songbook.ts:138`. Source, PCM and exact sheet-sequence association checks remain separate and unchanged.                                                                                                                                                                                                                                                                                                               |
| 2. Mic follow       | `src/audio/micMatchState.ts:12` shares the existing smoothing and threshold rules while resetting the consecutive counter on silence or missing frames. Both consumers use it: `src/components/SongbookPlayer.tsx:443`, `:464`, `:474`; `src/components/PracticeChordMode.tsx:51`, `:59`, `:64`. Songbook retains timer cancellation in effect cleanup (`SongbookPlayer.tsx:481`); its dependencies explicitly include listening and step index (`:485`), so a stop/target change cancels a pending advance. Practice clears accumulated match/glow hold state on cleanup (`PracticeChordMode.tsx:72`) and target selection (`:160`). Thresholds, 100 ms sampling interval, 700 ms arming, 650 ms advance and 900 ms glow remain unchanged. |
| 3. Legacy deletion  | Removed the unreachable analyzer files listed below, `analyzeYouTube`, its cache/types/import, and decoder-only helpers/tests. `src/audio/youtubeAnalysis.ts:4` retains Node playback loading. `src/audio/chordRecognition.ts:34` and `:49` retain the live frame helpers, with triad templates and similarity scoring unchanged. `src/audio/fixtures/alignmentFrames.ts:31` and `:41` supply explicit melody/triad frames. `src/audio/songAlignment.test.ts:205` and `:224` replace the two old-analyzer inputs, preserve the original timing-window assertions and add exact times, transpose and section-end assertions. Existing CCR alignment assertions remain.                                                                       |
| 4. Bounded fallback | `src/audio/youtubeAnalysis.ts:1` imports the already-exported `boundedBody` from `analysisClient.ts:38`; no local duplicate or frozen-file edit was needed. `youtubeAnalysis.ts:36` enforces 16 MiB while reading, before creating the Blob. Its reader cancels on overflow/read failure, including missing or false Content-Length. Pre-abort and post-read checks remain; unexpected nonaudio bodies are cancelled.                                                                                                                                                                                                                                                                                                                       |
| 5. Docs             | `README.md:7`, `:24` and `:70` describe Rust server analysis and same-recording playback. `README.md:135` distinguishes static Netlify, Node-only startup and supervised full server capabilities using repository config only; `:166` qualifies the older browser harness. `docs/sheet-alignment-contract-v1.md:3` defines Tier A placement/refusal, `:10` separates triads/tab notes/rich chords, `:25` explicitly marks Tier A quality unmeasured, `:31` defines provisional Tier B, and `:36` gates Tier C on causal evidence.                                                                                                                                                                                                          |

## Compatibility decision

Alignment **v1** accepts exactly **`rust-dsp-1` and `rust-dsp-3.1`**. Original v1
results use the same readable result schema and alignment contract, so their
estimates and associated timing remain readable under their recorded identity.
They are never relabeled as 3.1. Unknown engines, other `rust-dsp-*` versions and
unsupported alignment versions are refused for automatic reuse. Readable
estimates remain history; manual timing is retained under the existing rules.

The current identity comes from the generated manifest, while the compatibility
pairs are explicitly reviewed literals. A future manifest/algorithm change does
not silently expand the allowlist. Exact sequence keys still carry the alignment
version, and all existing recording verification remains required. Accepting an
engine does not establish PCM association, rich-chord evidence or musical quality.

`src/audio/analysisCompatibility.test.ts:8` covers the current engine and original
v1 engine, rejected engines and rejected alignment versions.
`src/data/songbook.test.ts:346` proves upload and YouTube-shaped local/remote
normalization retain automatic timing without relabeling. `:374` covers changed
sheet/version/PCM/source, missing upload association, unapproved engine, retained
history and preserved manual timing. Remote tests use mocked HTTP, not a database.
`src/audio/micMatchState.test.ts:4` covers high–silence/gap–high versus consecutive
high observations; `:17` locks the existing smoothing, threshold and arming rules.
`src/audio/youtubeAnalysis.test.ts:61` tests body abort; `:89` tests oversized
chunked bodies with absent and falsely small Content-Length, cancellation and
stopping before stream exhaustion.

Deleted product files:

- `src/audio/songAnalysis.ts`
- `src/audio/songAnalysis.worker.ts`
- `src/audio/songAnalysis.test.ts`

`songAnalysisTypes.ts`, `pitch.ts`, Rust sources, generated WASM, playback-hook
logic, Node extraction/server tests and existing e2e harnesses remain untouched.
Pre-edit copies under `target/sol-product-fixes/before/` are audit artifacts only.

## Commands and results

Commands ran from the audit checkout. Full captured output is under
`target/sol-product-fixes/`. The four required checks all exited **0**:

| Exact command       | Result                                                                                             | Log             |
| ------------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| `npm run lint`      | PASS; 52 warnings in existing files outside the edits; no errors.                                  | `lint.log`      |
| `npm run typecheck` | PASS.                                                                                              | `typecheck.log` |
| `npm test`          | PASS: 3 Node fixture tests; 260 Vitest tests passed, 7 skipped; 37 Vitest files passed, 2 skipped. | `test.log`      |
| `npm run build`     | PASS, including its unmodified `wasm:verify`, TypeScript and Vite steps.                           | `build.log`     |

WASM verification passed against source hash
`f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`.
No WASM rebuild, manifest edit or verification bypass was used.

Additional focused commands:

- `npx vitest run src/data/songbook.test.ts`: before the fix, 1 failed / 9 passed;
  3.1 automatic timing became undefined (`compatibility-before.log`).
- `npx vitest run src/data/songbook.test.ts src/audio/analysisCompatibility.test.ts src/audio/micMatchState.test.ts`:
  after the repair, 24 passed (`compatibility-after.log`); the additional
  association cases were subsequently included in the passing full suite.
- `npx vitest run src/audio/youtubeAnalysis.test.ts`: before the bounded-reader
  repair, both new overflow/cancel assertions failed, 2 passed
  (`bounded-before.log`).
- `npx vitest run src/audio/youtubeAnalysis.test.ts src/audio/chordRecognition.test.ts src/audio/songAlignment.test.ts`:
  after the repair/deletion, 27 passed (`cleanup-focused.log`).
- `git diff --check`: PASS.
- A text/asset scan of `src` and `dist` found zero legacy-chain symbols or
  `songAnalysis` worker assets (`legacy-reference-check.log`). The live Rust
  analysis/ingestion and PCM-verification workers remain in the build.

Seven opt-ins were skipped: six tests in
`src/components/LiveListen.browser.test.ts` (`LIVE_BROWSER_URL` unset) and one
in `server/songStore.test.ts` (`SONG_STORE_TEST_DATABASE_URL` unset). No browser
or database opt-in was enabled. No current Songbook browser journey or public
YouTube retrieval was run by this builder; the assigned independent tester
still owns that end-to-end evidence.

## Open issues and freeze

- The available runtime was **Node v24.22.1**. `.nvmrc`, package engines and the
  documented runtime pin are **24.22.2**; that patch was not installed. All four
  checks passed on 24.22.1, but the independent tester should repeat under the
  pinned runtime. No runtime or package installation was made.
- Browser confirmation of save/reload/reattach, playback and injected mic timer
  cancellation remains for the independent tester. Pure state tests and source
  cleanup review do not replace that journey.
- Tier A real-song quality, broader recognition accuracy, long-file completion,
  whole-browser memory and device coverage remain unproved. **None of this is
  musical-accuracy evidence.**

**SOURCE FREEZE:** the final write is
`target/sol-product-fixes/freeze.json`. It lists SHA256 for every edited/created
product source/doc and all Package A audit artifacts, plus pre-edit hashes for
the three deleted paths. Built `dist` files are recorded separately; ordinary
compiler/dependency caches are not product source. The manifest excludes its
own hash to avoid self-reference. No writes follow the freeze.
