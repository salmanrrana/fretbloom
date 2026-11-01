# Package A independent validation

2026-10-31. Tested uncommitted `fix/song-playalong-audit`. No product fixes,
index changes, commits, deployments, database access, sibling checkout access,
or child agents. All test writes are in the assigned directories and this report.
**This is not musical-accuracy evidence.**

## Freeze and runtime

PASS: all **57** recorded product, audit and build-output hashes match before
and after testing; all three deleted paths are absent. Evidence:
`target/songbook-runtime-v1/freeze-{before,after}.json`.
WASM verification passes twice, source
`f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`
(`wasm-verify.log`, `wasm-verify-after.log`, same output directory).

Node **24.22.1**, npm from that installation; pinned **24.22.2 was unavailable**
in checked nvm/fnm/Volta/asdf/Corepack cache locations. No Node installation.
Rust **1.89.0**. Shared browser: T3CodeBeta 0.1.5 / Electron 44.10.0,
Chromium **152.0.7977.169**, Linux. Playwright and cached Chromium were also
present; the shared browser tools were used for the journeys.

Native backend was built from unchanged source with
`CARGO_TARGET_DIR=target/songbook-runtime-v1/cargo cargo build --locked --release -p fretbloom-backend`,
using the installed 1.89.0 toolchain directory first on PATH. The initial
default Cargo launcher failed with `unknown proxy name: T3-Code`; direct
toolchain selection resolved it. Backend capabilities and result both report
**rust-dsp-3.1**. Exact native executable, Node gateway source and generated
manifest SHA256s are in `target/songbook-runtime-v1/identities.json`.

The first real upload failed because ffprobe was unavailable. A local
container copy also lacked shared libraries. Downloaded the static FFmpeg
7.0.2 archive from `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz`
into the owned target directory and ran its ffmpeg/ffprobe via explicit paths;
hashes are in `identities.json`. No system tools were installed.

## Required commands

Ran exact npm scripts in `target/songbook-runtime-v1/workspace`, a disposable
copy with its own dependencies/caches/build outputs. `copy-check.json` verifies
all 18 frozen product files match the original. This preserves original dist.

| Command | Verdict | Evidence under target/songbook-runtime-v1 |
| --- | --- | --- |
| `npm run lint` | PASS | `lint.log`; existing warnings, no errors |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run test` | PASS | `test.log`; 3 Node tests, 260 Vitest passed, 7 skipped |
| `npm run build` | PASS | `build.log`, including WASM verification |

`checks.json` records exits. An initial lint attempt found no files because
the copy inherited the parent's ignored target path; a local `.git` boundary
in the copy resolved that. An accidentally overlapping earlier check runner
was terminated; only the completed rerun is reported above.

Exactly skipped: six existing `LiveListen.browser.test.ts` opt-in tests
(`LIVE_BROWSER_URL` unset), one existing `server/songStore.test.ts` database
opt-in (`SONG_STORE_TEST_DATABASE_URL` unset), and repetition on Node 24.22.2.
No database opt-in was enabled. No public YouTube audio acquisition was required.

## Browser journeys

Used loopback Vite **15321** and private Rust **15322**, both owned by this
tester. Input is generated five-second, 24 kHz WAV: silence, synthesized C
triad, E note, silence. Browser scripts are retained under
`validation/songbook-runtime-v1/`; their evidence is under
`target/songbook-runtime-v1/`. Scripts use browser evaluation, native React
input events and file inputs; they are staged journey snippets, not an
unattended test runner. No existing e2e harness was edited or executed.

| Item | Verdict | Observed evidence |
| --- | --- | --- |
| a. Real upload → Rust 3.1 → saved automatic timing | PASS | `upload-success.json`: times `[0.44]`, end 4.04, upload association and engine preserved. `upload.js`, `reattach.js` generate/attach PCM. |
| a. Reload → same PCM → automatic timing and playback | PASS | `reload-missing-audio.json`, `reattach-playback.json`: timing restored, audio playing at 1.255 s, sheet C lit, no earlier-engine warning. Reattachment performs fresh Rust analysis; this is not a claim of analysis-free restoration. |
| b. Missing audio | PASS | `reload-missing-audio.json`: no lit step, explicit reattachment request; saved automatic times cannot drive playback. |
| b. Changed PCM | PASS | `changed-pcm.js`, `changed-pcm-during.json`: same WAV metadata, sign-inverted samples; old timing inactive during replacement, no lit step. Independent changed-hash normalization in `saved-records.json` strips automatic timing. New-result completion/hash after that replacement was not separately captured. |
| b. Changed sheet / unsupported rust-dsp-2 | PASS | `changed-sheet-ui.json`, `unsupported-ui.json`: no automatic sync, warning, retained estimate history. `saved-records.json` independently checks normalization strips times for each mismatch. UI cases also have no reattached audio; rejection with verified PCM and an unchanged unsupported result was not isolated in a rendered player. |
| b. Manual timing survives | PASS | `manual-reattach.json`: injected manual `[0.7]` survives real same-PCM Rust reattachment. `saved-records.json` checks manual preservation through changed sheet/hash association/unsupported engine normalization. This does not mean manual timing survives replacement with a genuinely different recording. |
| c. No Node playback acquisition after Rust success | PASS | `reattach-playback.json`: complete fetch log has zero `/api/youtube-audio` requests; real audio plays. Upload evidence is supplemented by `youtube-fixture-success.json`: YouTube-shaped Rust success also plays with zero fallback audio requests. |
| c. Unanalyzed Node fallback transport | PASS (mocked media) | `fallback.js`, `fallback.json`: actual loader requests `/api/youtube-audio/abcdefghijk`, receives locally generated WAV via mocked fetch, browser audio plays at 0.646 s. iframe src forced to about:blank; Rust routes return mock 503. Does not prove Node extraction tooling/network. |
| d. Songbook high–silence/gap–high; consecutive highs | PASS | `songbook-mic.json`, `songbook-cancel.json`: interrupted evidence stays at step 0; consecutive highs schedule a hit and advance once to step 1. |
| d. Songbook stop / target change cancels pending advance | PASS | `mic-cancel.js`, `songbook-cancel.json`: hit confirmed before each cancellation; stop stays at 0; target selection stays at 2 after >650 ms. |
| d. Practice interrupted/consecutive evidence and reset | PASS | `practice.js`, `practice-mic.json`: gap/silence breaks streak, consecutive highs light G, changing target and stopping clear hit. Practice has no automatic step-advance timer; that part is inapplicable. |
| e. No legacy worker build asset | PASS | `legacy-assets.json`: complete isolated dist asset listing, zero songAnalysis assets. |
| YouTube-shaped successful Rust analysis/save/playback | PASS (local acquisition fixture) | `youtube-fixture.js`, `yt-dlp-fixture.py`, `youtube-fixture-success.json`: fixture downloader supplies generated WAV, real Rust 3.1 result saves automatic `[0.44]`, C lights at 0.956 s, zero `/api/youtube-audio` requests. No public media download is needed. Reload/reattachment was covered for upload above, not repeated for YouTube. |

Microphone injection replaces only the runtime mic start/stop/frame methods
with generated waveform/null observations, and controls RAF/performance time.
The real rendered components, pitch scoring, state helper and 650 ms browser
timer run. This tests control flow, not microphone hardware or recognition.
Some initial cancellation attempts lacked a confirmed pending hit; the later
`songbook-cancel.json` is the decisive cancellation evidence. A lingering hit
style after target selection was observed, but the pending advance was canceled.

PCM identity for successful upload/reattachment:
`d5b3a0cbd8b3a1f6e191cafd76ae07348f03c3ce5adc84ee7d51849eaf3b8274`.
Initial failed/time-out evidence (`upload-analysis.json`, `playback.json`) is
retained and superseded by successful artifacts, not counted as passing runs.

## Verdict and limits

**Observed Package A fixes pass; full acceptance remains incomplete.** No
confirmed product defect was found and no product code was patched. Pinned Node 24.22.2, explicit Blob revocation
instrumentation, and fully isolated negative-engine-with-verified-audio UI
coverage remain unproved. Mocked fallback proves browser loading/playback,
not the live Node extractor. No real-song accuracy, long-file, device/memory,
acoustic reattack or rich-chord quality conclusion follows from this input.

Stopped the owned Vite and Rust processes and closed the browser tab.
`cleanup.json` records signaled PIDs; `ports-after.json` confirms both owned
ports are free. Final freeze and WASM checks still pass. Builder B's exclusive
paths were not modified.

Additional YouTube-shaped run: backend restarted with the owned local downloader
fixture as YTDLP_PATH. The browser iframe was forced to about:blank. Optional
`/api/youtube-captions` and `/api/youtube-lyrics` requests occurred automatically;
they were not assertions or dependencies of the audio/timing result. Public
caption/lyric retrieval was not validated. `cleanup-youtube.json` records
shutdown of this second owned service run and its remaining descendants.
