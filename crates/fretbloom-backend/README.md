# Private analysis service

This crate builds `fretbloom-backend`. Node is the public/authenticated gateway;
Rust has no database connection or owner credentials. Run only on loopback.
The routes are `/v1/capabilities`, `/v1/jobs`, `/v1/jobs/:uuid`, and the
`media`, `result`, `features`, and `audio` job suffixes from the architecture contract.
The public gateway prefix remains `/api/analysis/v1`.

## Configuration

`FRETBLOOM_ANALYSIS_LISTEN` defaults to `127.0.0.1:5210`.
The supervisor's `FRETBLOOM_ANALYSIS_HOST` and `FRETBLOOM_ANALYSIS_PORT` are also
accepted (override the corresponding LISTEN component). Non-loopback addresses
are rejected. `FRETBLOOM_ANALYSIS_TEMP_ROOT` defaults to a dedicated
`fretbloom-analysis` directory under the system temporary directory.

Tool paths: `FFMPEG_PATH`, `FFPROBE_PATH`, `YTDLP_PATH`, and `NODE_PATH`.
`NODE_PATH_FOR_YTDLP` is a supervisor-compatible alias; `NODE_PATH` takes precedence.
The yt-dlp default is `.tools/youtube/bin/yt-dlp` relative to startup cwd.
FFmpeg, ffprobe and Node default to PATH lookups. Relative tool paths containing
slashes are made absolute before changing to a job directory.

`FRETBLOOM_ANALYSIS_MAX_SOURCE_BYTES` and
`FRETBLOOM_ANALYSIS_MAX_DURATION_SECONDS` may lower the 50 MiB / 600 second limits.
Invalid, zero, or larger limits fail startup. Remaining budgets are validated
`Config` fields with the contract defaults/hard maxima, not arbitrary environment
settings. The gateway uses `FRETBLOOM_ANALYSIS_ORIGIN=http://127.0.0.1:5210`.

The process environment is cleared for every tool. Only PATH, fixed locale,
and job-owned HOME/TMPDIR are provided. yt-dlp configuration, cookies, cache,
playlists and concurrent fragment downloads are disabled. It receives only a
server-constructed watch URL and metadata-validated HLS fallback format ID.

## Bounds and cancellation

One pipeline runs with two pending/upload reservations. Admission reserves worst
case source + PCM + playback space against the service disk budget and evicts
only terminal jobs. Uploads stream with exact declared length, source-byte,
idle and total deadlines. Output JSON and event counts are checked before success.
Actual decoded sample count is authoritative; the extra sample rejects an
oversized recording. Playback is quantized directly from the analyzed PCM;
its SHA256 identifies the pre-quantization little-endian f32 samples.

Media protocols and demuxers are allowlisted. FFmpeg uses strict error handling,
one codec/filter thread, bounded stdout, and the first audio stream. Stereo/multi-
channel audio uses the arithmetic mean; bounded initial channel windows detect
strong phase cancellation and select one consistent channel with a warning.
This detection does not inspect every possible interval of a long recording.

Tool output and directory bytes are monitored, including download partials;
regular-file limits also apply at the OS level. Aggregate download/disk accounting
runs every 20 ms: a tool write can transiently cross the aggregate threshold before
termination. Completed files over a limit are never accepted. This is not a
filesystem quota or complete codec memory sandbox; container memory/disk limits
remain the final containment layer.

Cancellation terminates the process group, allows up to two seconds for exit,
then kills and reaps. Linux enables child subreaping and waits for adopted group
descendants; tools cannot leave background processes after a completed operation.
The DSP runs in one cooperative blocking worker. Cancellation/deadline must join
it within two seconds; if the core violates that contract, the private service
exits with failure rather than starting a second worker or hanging shutdown.
The supervisor must treat that exit as unavailable. Normal cancellation and
analysis deadline behavior are exercised with real PCM; the fail-stop watchdog
branch is defensive and has not been deliberately triggered.

Only service-owned run directories with a recorded dead PID are removed after
restart. Unrelated files/directories are preserved. Job records/audio are temporary;
restart and retention return 404 rather than a fabricated result.

## Verification

Requires the pinned Rust toolchain, FFmpeg with the supported encoders, and ffprobe:

```sh
cargo test --locked -p fretbloom-backend
cargo clippy --locked -p fretbloom-backend --all-targets -- -D warnings
cargo fmt -p fretbloom-backend -- --check
npm run check:fast
```

Focused tests create their own WAVs and controlled executable scripts. They cover
WAV at 12/24/32/44.1/48 kHz, antiphase stereo, genuine MP3/FLAC/Ogg/M4A/WebM
encode/decode, PCM hash/playback identity, leading silence, authoritative duration,
corrupt/playlist inputs, API upload/results/features, Range/HEAD, admission,
leases/expiry/eviction, queue and upload deadlines, disconnects, fetching/decoding/
DSP cancellation, process output overflow, missing tools, secret-free environments,
and descendant reaping. No holdout predictions or validation-owned files are used.

This host lacked ffprobe on PATH. Tests used a disposable FFmpeg 7.0.2 static
ffprobe at `/tmp/fretbloom-builder-b-tools/ffmpeg-7.0.2-amd64-static/ffprobe` via
`FFPROBE_PATH`; that path is not a packaging dependency. In the T3 AppImage shell,
Rust commands required explicit RUSTC/RUSTDOC paths to the installed pinned 1.89.0
toolchain to avoid ambient rustup proxy behavior. Container packaging installs the
tools separately.

## Measured development evidence (2026-10-31)

These observations identify specific local binaries, not a final source freeze
or a musical accuracy evaluation. Concurrent workspace builds/tests were running.
Machine: `xtra-computer`, Linux `7.0.0-42-generic`, x86_64, glibc 2.39.

Release backend SHA256:
`b13be1956f15b02a1ed55ba2b45857211309a2d2849491d51a4f662232e2bd6c`.
Generated mono PCM16 24 kHz 440 Hz sine, first 100 ms silent:

- 30 seconds: succeeded; 2.820 s upload-to-success wall time, 0.660 s Rust CPU,
  11,616 KiB Rust process VmHWM, 1,440,049 sampled peak temporary bytes.
- 600 seconds: succeeded; exact 600 s decoded duration; 43.952 s wall time,
  12.280 s Rust CPU, 126,232 KiB Rust VmHWM, 57,160,797 sampled peak temporary bytes.
- Both jobs were deleted and the isolated service shut down with exit 0.

VmHWM covers Rust, not FFmpeg/ffprobe children or Node. CPU excludes child CPU.
Disk was sampled at 100 ms, so this is an observed lower bound on instantaneous
peak disk, not proof of a quota. Pure-tone input is an easy DSP workload, not
representative polyphonic throughput. Later process-limit/watchdog/strict-decode
changes require a new frozen binary measurement during root integration.

Actual public YouTube acquisition using the policy above (separate debug binary):
`jNQXAC9IVRw` reached acquisition, decode, analysis and result retrieval in
108.963 s, decoded duration 19.005541666666666 s, PCM SHA256
`6779c5996b2592fac007cf959372d4fc20d6c70e418e4e2afb86a74dd713510d`.
No cookies, proxy rotation or credentials were supplied; the isolated service
exited 0. Its audio route was not fetched before cleanup, so that particular
source is acquisition/result evidence only. Real-upload audio routes are tested
separately. An earlier `BaW_jenozKc` attempt returned `YOUTUBE_UNAVAILABLE` in
4.033 s. Local accessibility does not establish cloud accessibility.

The frontend save/reload journey, container-wide peak memory under legacy/new
traffic, final binary freeze, and musical acceptance belong to root/C/evaluators.

## Builder B file handoff

Exact owned files added/updated:

- `crates/fretbloom-backend/Cargo.toml`
- `crates/fretbloom-backend/README.md`
- `crates/fretbloom-backend/src/main.rs`
- `crates/fretbloom-backend/src/lib.rs`
- `crates/fretbloom-backend/src/config.rs`
- `crates/fretbloom-backend/src/error.rs`
- `crates/fretbloom-backend/src/process.rs`
- `crates/fretbloom-backend/src/media.rs`
- `crates/fretbloom-backend/src/youtube.rs`
- `crates/fretbloom-backend/src/jobs.rs`
- `crates/fretbloom-backend/src/api.rs`
- `crates/fretbloom-backend/tests/service.rs`
- `Cargo.lock`
- `server/analysisApi.ts`
- `server/analysisApi.test.ts`
- `server/index.ts`
- `server/index.test.ts`
- `vite.config.ts`

Final focused backend run: 15 integration tests passed, no failures or skips.
Backend clippy passed with warnings denied; backend rustfmt check passed.
Final complete `npm run check:fast`: lint/typecheck passed; 155 tests passed,
one database test skipped. No database was used for any Builder B check.
`npx vitest run server/analysisApi.test.ts server/index.test.ts`: 14 tests passed,
including a real HTTP disconnect propagated to the upstream upload.
Cargo.lock SHA256: `70fcfec16fe2b282a640b46db01cafa66c414b2a41531f0b095a10bdab4390dd`.

A separate real Node -> real Rust local HTTP journey used disposable loopback
ports and a generated 250 ms WAV: create/upload/status/result/features/full audio/
HEAD/Range/DELETE all passed in 0.615 s total; result 1,213 bytes, features 489
bytes, audio 12,044 bytes, Range 206, post-cancel result 409. Rust shut down with
exit 0; Node was terminated by the test supervisor's SIGTERM. This did not exercise
React, persisted Songbook, production, or a live database.
