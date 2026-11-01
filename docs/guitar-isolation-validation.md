# Guitar isolation validation

Implementation on `feat/guitar-isolation`, based on `a696d54809ee27b75679255a7f7a927e47de55c2`.
All work is local to `fretbloom-song-audit`. No commits, pushes, deployments,
credentials, databases, Railway operations or sibling-worktree edits.

## Behavior and scope

Uploads and YouTube song jobs accept explicit guitar/full-mix focus. The legacy
omitted-focus default remains full mix. Guitar jobs decode the original playback
first, then separate with offline CPU Demucs, align the guitar to exactly that
original timeline, and run the unchanged `rust-dsp-3.1` recognizer. Original PCM
identity remains the envelope identity and the timing/lyrics identity. Analyzed
PCM identity and model provenance are separate. Guitar playback is a session-only
preview; changing the preview keeps time, speed and play state. Saved provenance
survives reload; legacy analyses are labeled as earlier full-mix analyses.

Availability requires the pinned weights SHA256 plus a bounded Python import and
model load. Guitar requests never silently substitute a full-mix result. The
helper uses isolated Python, a cleared environment, local weights, blocked Python
socket operations, capped CPU threads, fixed windows, process-group cleanup,
file/disk limits, an RSS watchdog and explicit timeouts. The startup check also
runs under those limits. The existing single worker remains in use.

The recognizer, live engine, portable WASM and all existing corpus labels remain
unchanged. No model or recognizer settings were tuned on these results.

## Sources and predeclaration

[Predeclaration](../validation/guitar-isolation/predeclared.json) was written
before the first inference. Its hash and the helper/lock/WASM identities are in
[identities.json](../validation/guitar-isolation/identities.json).

Two **DEV**, complete MIC recordings from the existing GuitarSet 1.1.0 selection
were used: `00_SS3-84-Bb_comp` and `01_Jazz3-150-C_comp`. They were selected from
`validation/real-audio/manifest.json` after checking that corpus's lock and split
rules. No holdout inference was performed; no existing validation files were
rewritten. Original WAV and JAMS hashes were verified before copying into this
feature's ignored source directory. [Fixture identities and original truth](../validation/guitar-isolation/fixtures.json)
retain the unmodified independent performed-chord and string-note annotations.

GuitarSet credit: Qingyang Xi, Rachel M. Bittner, Johan Pauwels, Xuzhou Ye and
Juan P. Bello, _GuitarSet: A Dataset for Guitar Transcription_, ISMIR 2018.
Dataset [DOI 10.5281/zenodo.3371780](https://doi.org/10.5281/zenodo.3371780),
CC BY 4.0 for recordings and annotations. The original Zenodo API was fetched
again into ignored `source/zenodo-record.json`; `metadata.license.id` is
`cc-by-4.0`. The original recordings were rescaled and mixed with independently
synthesized bass, keys, noise percussion and a vibrato lead, at equal guitar and
accompaniment RMS before common peak scaling. All accompaniment is newly
self-authored mathematical synthesis, dedicated here under CC0-1.0; no samples,
soundfonts or recordings from other instrument sources were used. Scripts and
identities preserve the exact seed, construction and transformations. This is
not a representative music benchmark and does not imply author endorsement.

The model code is `demucs 4.1.0` (MIT); the verified wheel hash is
`4916a804702033ce934a6cdfa7e38dde03f7a7a6e85f41d0120eefe9e2966758`.
Runtime: `torch 2.8.0+cpu`, Linux x86_64, Python 3.12 locally and 3.11 in Docker.
The explicit lock includes both CPython wheel variants and CPU-only torch hashes.
Official weights:
`https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th`,
54,996,327 bytes, SHA256
`34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd`.
Settings: shifts 0, overlap 0.25, split true, model-default 7.8-second segment,
2 CPU threads. Outer cores are four internal strides with two strides of context
on either side; only the central guitar samples are written. No full-song tensor
is held by Python. Mean/std normalization uses bounded streaming passes.

**Weights permission is unresolved for app deployment.** The
[Demucs 4.1.0 code](https://pypi.org/project/demucs/4.1.0/) is MIT; the
[author's separate statement](https://github.com/facebookresearch/demucs/issues/327)
says weights are provided only for scientific purposes. That statement predates
the six-stem release and does not establish an explicit license grant for this
exact checkpoint. The [current maintained README](https://github.com/adefossez/demucs#license)
explicitly calls the weight licensing unclear and speculates about a non-commercial
license for the six-source variant; it supplies no definite checkpoint license. Owner-only,
personal or non-commercial use is not automatic permission. These local tests
are scientific evaluation; deployment or redistribution of the image needs
clarified permission or replacement weights with a suitable license. The earlier
plan's assertion that personal use suffices was corrected during takeover review.

## Reproduction

Use the pinned Node 24.22.2 and Rust 1.89 toolchains. This machine additionally
needed a project-local FFmpeg/ffprobe pair; their path must be present for tests.
Run each heavy command to completion before starting the next:

```sh
npm run setup:separator
.tools/separator/bin/python validation/guitar-isolation/prepare.py
python3 validation/guitar-isolation/checks.py
.tools/separator/bin/python validation/guitar-isolation/window-check.py
.tools/separator/bin/python validation/guitar-isolation/failure-controls.py
node e2e-guitar-focus.mjs
.tools/separator/bin/python validation/guitar-isolation/run.py
.tools/separator/bin/python validation/guitar-isolation/run.py --long
```

The evaluation runner starts and stops its own loopback backend on an OS-assigned
free port, uploads each actual WAV, polls the real stages, and fetches result and
original/guitar WAV artifacts. Raw results, progress traces, audio hashes, stderr
and process resource logs are retained in ignored `validation/guitar-isolation/runs/`.
The six-minute input repeats and trims the first declared real-guitar mixture to
exactly 360 seconds; its complete input hash is in `fixtures.json`.

Resource RSS is sampled for the backend's entire descendant tree at 200 ms.
Per-job CPU is sampled from retained per-PID `/proc` counters (small processes can
exit between samples); GNU time additionally records exact aggregate child CPU
and maximum individual process RSS. Disk is sampled job-directory file bytes.
Container cgroup counters include the backend, exec driver, helper and page cache;
container memory peak therefore differs from local summed process RSS.

## Checks, controls and limits

[Checks](../validation/guitar-isolation/checks.json) retain commands and exit codes.
The old queue-timeout assertion was updated from `PROCESSING_TIMEOUT` to the
contract's truthful `QUEUE_FULL`. The initial check run using direct Cargo on PATH
could not interpret the existing live test's `cargo +1.89.0`; using rustup on PATH
resolved that tool invocation. The known debug core integer-overflow test was not
changed; backend verification uses release mode as requested.

[Window check](../validation/guitar-isolation/window-check.json): real short-clip
windowed output is byte-identical to the independent unwindowed Demucs call:
The final comparison uses 30 seconds, crossing an outer-window boundary, and checks exact PCM equality and zero lag. A separate initial 2-second control is retained in ignored runs. This remains a short-clip proof, not a universal quality guarantee for every long recording.

[Failure controls](../validation/guitar-isolation/failure-controls.json) exercise
the real backend with a disposable helper: wrong weights, explicit failure,
invalid WAV, excessive alignment error, RSS limit, disk limit and cancellation
with a grandchild, plus unexpected helper SIGKILL. The cancellation and SIGKILL controls check process reaping and an empty
job directory. Focused Rust and TS tests also cover old create defaults, invalid
focus/fields, unavailable separation, alignment, client provenance mismatch,
proxy GET/HEAD allowlisting, legacy/new saved parsing and preserved manual timing.

[Browser evidence](../validation/guitar-isolation/runs/browser.json) uses isolated
loopback Node/Rust servers, actual separation, upload/save/reload, paused and
playing preview switches, explicit full-mix reanalysis, unchanged original
identity, manual timing/lyrics survival and a saved legacy analysis. Desktop and
mobile captures are in the same ignored directory. No existing listener is used
or stopped. The mechanical UI detector returned no findings.

## Hosting

A roughly 0.5 GB service cannot run this model. Budget a dedicated worker with
at least 4 GiB RAM, 2 CPU cores and 1.5 GiB writable temporary storage, plus image
storage. Keep one active separation per worker. The helper's process-tree RSS
ceiling is 3 GiB; disk reservation includes the original, stereo separator input,
stem and both playback files. Maximum separation time is 2,400 seconds and maximum
guitar job active time is 2,700 seconds; the browser deadline is 3,000 seconds
(above the server worst case of upload 120 s + queue 60 s + active 2,700 s).
These allow headroom over the measured six-minute job and scale to the existing
ten-minute input maximum. Full-mix deadlines retain their old values.

For a small web host, run the same jobs service on a separate private worker
with these resources. The owner-gated web server remains the only public entry;
forward its fixed jobs API over a private authenticated network, retain original
and preview artifacts with job expiry, and keep the single-worker admission limit.
The current proxy intentionally accepts loopback only. A concrete split-host
setup can keep that contract: an authenticated tunnel sidecar on the web host
binds only `127.0.0.1:5210` and forwards to the worker’s loopback jobs listener.
The worker holds the expiring artifacts; the web server keeps its existing owner
gate and route allowlist. Direct remote proxying would instead need a deliberate
private transport change. Tunnel provisioning and authentication are future
deployment work, not changes made here. No worker or
infrastructure was deployed in this task.

## Deviations and interpretation

- The runtime trial used a stricter 2.5 GiB container cap (and a 2 GiB helper RSS
  ceiling), instead of the predeclared 4 GiB trial ceiling, after measuring the
  native peak. The recommended worker still has 4 GiB for operating headroom.

- The frozen predeclaration describes the accompaniment's A section as minor,
  but the generator uses the same major-third interval for every root, making it
  A major. This construction mismatch was found by reading the generator after
  inference. The original predeclaration and all input bytes are retained rather
  than changing a fixture after seeing results. Guitar truth is unaffected;
  accompaniment is explicitly nuisance audio, not the scoring reference.

- Existing DEV GuitarSet recordings were reused after lock/split verification,
  rather than downloading a different corpus. They are expressly DEV, not unseen
  acceptance material; their labels and prior results were preserved.
- The short-window equality proof uses 30 seconds and crosses one outer-window
  boundary. It does not establish equivalence for every longer recording.
- Linux `/proc` supplies the working process-tree RSS bound and resource sampler.
  Setup explicitly supports Linux x86_64 Python 3.11/3.12; other platforms are not
  claimed supported by the separator packaging.
- The local Python lacked ensurepip. Setup supports a venv without pip using the
  system pip's `--python` option to install into the venv, still with the same hash
  lock and no global installation.

## Lead review fixes

The lead review and an independent static review found no truthfulness bug, but
these issues were fixed before the final evidence run. Every measured result
below comes from the fixed code.

- **Stereo level and phase.** The separator path used FFmpeg's default `-ac 2`
  and `-ac 1` conversions. A stereo source came back 1.41x (+3 dB) louder than
  the original mix, so `guitarLevelDb` read 3 dB high. For an opposite-phase
  source, the guitar averaged out even though the original used its strongest
  channel. `decode_media` now passes the separator the original's own channel
  choice (true stereo for an ordinary 2-channel source, otherwise the original
  mono mix in both channels), and the stem is averaged explicitly. With a
  copy-through stub separator, 48 kHz WAV, 48 kHz Opus, 44.1 kHz MP3, mono and
  opposite-phase sources all give gain 1.000, zero lag (to a fraction of a
  sample) and 61 dB or better agreement with the original. The two evaluation
  fixtures are mono, which the old path already handled correctly.
- **Memory watchdog cost.** It scanned all of `/proc` every 20 ms, inline on
  the async runtime. It now runs every 250 ms on the blocking pool and skips
  missed ticks. A `/proc` error stops the job through the normal cleanup path.
  RSS uses the real page size.
- **Out-of-memory priority.** The helper sets its own `oom_score_adj` to 1000,
  so on a host that runs out of memory the kernel stops the helper rather than
  Node or Rust.
- **Queue code.** Only real queue expiry reports `QUEUE_FULL`. A queued job
  whose client stopped polling reports `PROCESSING_TIMEOUT`, as before.
- **UI.** If the capability check fails, the panel says so and keeps guitar as
  the default; `analyze()` checks again. Auto-analysis on open is restored when
  separation is unavailable: it runs full mix and is labeled full mix. A retry
  while previewing guitar no longer leaves playback stuck. Switching twice
  quickly keeps the first saved position. A rejected `play()` clears the
  playing state.
- **Client.** The guitar deadline now has margin (3,000 s). The guitar and
  original previews must be the same byte size (same 24 kHz mono timeline).
- **Test.** `guitar_job_keeps_original_identity_level_and_timeline_and_fails_closed`
  (in `crates/fretbloom-backend/tests/guitar.rs`) runs a real guitar job through
  the router with a copy-through stub. It checks provenance, a level within
  0.1 dB on a stereo source, an equal-length preview with SNR above 40 dB,
  `SEPARATION_FAILED` on helper failure, and an empty job directory afterwards.
  It fails with the old downmix. It needs the pinned weights from
  `npm run setup:separator` and skips with a message when they are absent.

Measured tables, final checks, container identity and cleanup follow below.

<!-- MEASURED RESULTS -->

## Measured musical agreement

20 ms frames; no boundary exclusions. Root uses every nonempty performed-chord reference frame; major/minor requires both correct root and exact maj/min and excludes extended reference qualities. Note F1 uses exact MIDI frame sets (union of streams). `TP / predicted / reference` preserves note denominators. No-chord and unknown are disjoint frame rates, not accuracy.

| Fixture / condition                  | Root correct / frames | Root + maj/min correct / frames | No-chord / frames | Unknown / frames | Note TP / predicted / reference; F1 |       SI-SDR dB |
| ------------------------------------ | --------------------: | ------------------------------: | ----------------: | ---------------: | ----------------------------------- | --------------: |
| 00_SS3-84-Bb_comp-full_mix           |              331/2286 |                        117/2000 |          306/2286 |        1509/2286 | 2681/6328/6063; 43.27%              |            0.02 |
| 00_SS3-84-Bb_comp-separated_guitar   |              386/2286 |                        126/2000 |           63/2286 |        1435/2286 | 3823/8355/6063; 53.03%              |            9.44 |
| 00_SS3-84-Bb_comp-clean_guitar       |              578/2286 |                        292/2000 |          587/2286 |         999/2286 | 3919/5836/6063; 65.87%              | reference / n/a |
| 01_Jazz3-150-C_comp-full_mix         |              103/1280 |                         64/1280 |          427/1280 |         738/1280 | 669/2693/1557; 31.48%               |           -0.04 |
| 01_Jazz3-150-C_comp-separated_guitar |              173/1280 |                         67/1280 |          277/1280 |         703/1280 | 1094/3418/1557; 43.98%              |           10.96 |
| 01_Jazz3-150-C_comp-clean_guitar     |              105/1280 |                         17/1280 |          508/1280 |         645/1280 | 1170/2554/1557; 56.92%              | reference / n/a |
| Pooled full_mix                      |              434/3566 |                        181/3280 |          733/3566 |        2247/3566 | 3350/9021/7620; 40.26%              |           -0.01 |
| Pooled separated_guitar              |              559/3566 |                        193/3280 |          340/3566 |        2138/3566 | 4917/11773/7620; 50.71%             |           10.20 |
| Pooled clean_guitar                  |              683/3566 |                        309/3280 |         1095/3566 |        1644/3566 | 5089/8390/7620; 63.57%              | reference / n/a |

Pooled SI-SDR is an arithmetic mean of the two file-level values, not a concatenated-waveform score. On this declared DEV pair, pooled root agreement is 12.17% full mix, 15.68% separated and 19.15% clean; exact root+maj/min is 5.52%, 5.88% and 9.42%. The small chord gain does not establish dependable transcription. Clean guitar is a reference condition, not a guaranteed numerical upper bound: the jazz chord results remain weak.

### Controls and loss/leakage observations

| No-guitar fixture            | Guitar level dB | No-chord / frames | Unknown / frames | False chord frames | False note frames |
| ---------------------------- | --------------: | ----------------: | ---------------: | -----------------: | ----------------: |
| 00_SS3-84-Bb_comp-negative   |          -42.73 |          276/2286 |        1433/2286 |                577 |              5674 |
| 01_Jazz3-150-C_comp-negative |          -48.91 |          184/1280 |         724/1280 |                372 |              3073 |

Both negative controls trigger the predeclared −30 dB warning. Despite tiny extracted energy, the amplitude-insensitive recognizer still emits false notes/chords; the warning is essential and does not eliminate those errors. Negative controls have zero guitar truth and zero correct notes; their F1 is zero.

The repeat analyzed-PCM hash is identical. Raw whole-result hashes differ because job identifiers differ. The window comparison is byte-identical (zero lag). Failure controls: 8/8 passed. Browser integration: passed, no page errors. No subjective human listening test was performed; the following are reproducible signal/recognizer observations, not claims of acoustic note adjudication:

- `00_SS3-84-Bb_comp`: linear projection on clean guitar 0.983, accompaniment 0.131; 353/3918 truth-note frames recognized on clean guitar are missing after separation; 4530 false note frames remain after separation.
- `01_Jazz3-150-C_comp`: linear projection on clean guitar 0.974, accompaniment 0.088; 150/1170 truth-note frames recognized on clean guitar are missing after separation; 2324 false note frames remain after separation.

### Per-job resources

CPU is sampled process-tree CPU; RSS is summed process-tree RSS.

| Job                                  | Wall s | CPU s | Peak RSS MiB | Peak temp disk MiB |
| ------------------------------------ | -----: | ----: | -----------: | -----------------: |
| 00_SS3-84-Bb_comp-full_mix           |   1.03 |  0.81 |         16.9 |                2.1 |
| 00_SS3-84-Bb_comp-separated_guitar   |  39.60 | 76.88 |       1442.7 |               17.5 |
| 00_SS3-84-Bb_comp-clean_guitar       |   1.54 |  1.17 |         37.6 |                2.1 |
| 00_SS3-84-Bb_comp-negative           |  40.61 | 78.90 |       1384.5 |               17.5 |
| 01_Jazz3-150-C_comp-full_mix         |   1.02 |  0.61 |         54.3 |                2.2 |
| 01_Jazz3-150-C_comp-separated_guitar |  27.07 | 52.03 |       1342.4 |                9.8 |
| 01_Jazz3-150-C_comp-clean_guitar     |   1.02 |  0.79 |         60.1 |                1.2 |
| 01_Jazz3-150-C_comp-negative         |  28.09 | 54.46 |       1392.3 |                9.8 |
| determinism-repeat                   |  37.61 | 74.01 |       1451.8 |               17.5 |

Identity-stub control: the complete backend preserves 96,000 samples and zero lag, with separating before analyzing. It is explicitly a functional stub control, not musical inference. See alignment-control.json.

### long-local.json

```json
[
  {
    "name": "six-minute-local",
    "inputSha256": "e3c1857a33c423130d91df6d6e950594e73c4c0406d2162f1ea5019e00e176ed",
    "focus": "guitar",
    "wallSeconds": 429.43229836499995,
    "cpuSeconds": 858.5699999999999,
    "peakTreeRssBytes": 1646145536,
    "peakJobDiskBytes": 144288189,
    "resultSha256": "039d8220d5c8bd53ad3e43398f5d474a3cc39ec84cb83a0c909916d002dca16d",
    "analyzedAudio": {
      "guitarLevelDb": -2.711534222658214,
      "kind": "guitar_stem",
      "pcmSha256": "ee57df6cf71e6fd2ab916f7fee4c457a8f9fdd245aff4066de186d4131b8b176",
      "separator": {
        "model": "htdemucs_6s",
        "overlap": 0.25,
        "package": "demucs 4.1.0",
        "runtime": "torch 2.8.0+cpu cpu",
        "shifts": 0,
        "weightsSha256": "34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd"
      }
    },
    "pcmSha256": "f1d33bb30eda6bed30e2d77db7bfcbe66a3192e25e30ffa204c64df4a7e15ccb"
  }
]
```

### container-summary.json

```json
{
  "passed": true,
  "command": [
    "docker",
    "run",
    "-d",
    "--name",
    "fretbloom-guitar-offline",
    "--network",
    "none",
    "--cpus",
    "2",
    "--memory",
    "2560m",
    "--mount",
    "type=bind,source=/home/xtra/code/personal_projects/fretbloom-song-audit/validation/guitar-isolation/source,target=/input,readonly",
    "--mount",
    "type=bind,source=/home/xtra/code/personal_projects/fretbloom-song-audit/validation/guitar-isolation/container-job.mjs,target=/container-job.mjs,readonly",
    "-e",
    "FRETBLOOM_ANALYSIS_PORT=53147",
    "-e",
    "FRETBLOOM_ANALYSIS_TEMP_ROOT=/tmp/guitar-jobs",
    "-e",
    "FRETBLOOM_SEPARATOR_MAX_RSS=2147483648",
    "fretbloom-guitar-runtime:local",
    "/app/target/release/fretbloom-backend"
  ],
  "containerId": "485e06318e641f338b4b66a9e3fd802cb44ed3d221a8a67fa8015197303139ad",
  "imageId": "sha256:a67f90d50184a9826454c2f47c3c447ef1650197c64840e7b0e4d85e891ffcbd",
  "imageSizeBytes": 2665040459,
  "user": "node",
  "uid": 1000,
  "network": "none",
  "cpus": 2,
  "memoryLimitBytes": 2684354560,
  "helperRssLimitBytes": 2147483648,
  "wallSeconds": 383.91222011,
  "execWallSeconds": 384.05172917100026,
  "cpuSeconds": 756.455766,
  "peakCgroupMemoryBytes": 1862696960,
  "peakJobDiskBytes": 142700588,
  "inputSha256": "e3c1857a33c423130d91df6d6e950594e73c4c0406d2162f1ea5019e00e176ed",
  "pcmSha256": "f1d33bb30eda6bed30e2d77db7bfcbe66a3192e25e30ffa204c64df4a7e15ccb",
  "analyzedAudio": {
    "guitarLevelDb": -2.711534222658214,
    "kind": "guitar_stem",
    "pcmSha256": "ee57df6cf71e6fd2ab916f7fee4c457a8f9fdd245aff4066de186d4131b8b176",
    "separator": {
      "model": "htdemucs_6s",
      "overlap": 0.25,
      "package": "demucs 4.1.0",
      "runtime": "torch 2.8.0+cpu cpu",
      "shifts": 0,
      "weightsSha256": "34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd"
    }
  },
  "previewSha256": "2d7e6581f14b7593c118fab162a50c77e793d9f0045d11ca895d46d03a8f28c9"
}
```

## Final identities and cleanup

See `identities.json`, `fixtures.json`, `checks.json`, `failure-controls.json`, `window-check.json` and ignored `runs/browser.json` for exact identities, denominators and evidence. The portable WASM SHA256 remains `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b`.

Exact aggregate evaluation CPU (GNU time, including startup): 300.34 s user + 42.69 s system = 343.03 s.

## File inventory

| File                                                        | Change                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Dockerfile`                                                | Install the same pinned CPU separator in the non-root runtime image.                            |
| `README.md`                                                 | Document setup, behavior, resource requirements and weights restrictions.                       |
| `crates/fretbloom-backend/src/api.rs`                       | Expose focus, verified capability and ranged guitar preview artifacts.                          |
| `crates/fretbloom-backend/src/config.rs`                    | Bound separator paths, threads, RSS, deadlines and disk reservations.                           |
| `crates/fretbloom-backend/src/error.rs`                     | Map unavailable, failed and limited separation errors.                                          |
| `crates/fretbloom-backend/src/jobs.rs`                      | Run separation before unchanged analysis; preserve original identity and truthful queue expiry. |
| `crates/fretbloom-backend/src/lib.rs`                       | Register the separator module.                                                                  |
| `crates/fretbloom-backend/src/media.rs`                     | Share existing decode arguments and canonical WAV writer.                                       |
| `crates/fretbloom-backend/src/process.rs`                   | Cap separator process-tree RSS and immediately reap descendants on parent exit.                 |
| `crates/fretbloom-backend/src/separator.rs`                 | Verify identity, extract bounded guitar PCM, align and record provenance.                       |
| `crates/fretbloom-backend/tests/guitar.rs`                  | Test focus defaults, unavailability, alignment, RSS and process-tree cancellation/death.        |
| `crates/fretbloom-backend/tests/service.rs`                 | Expect truthful busy code for queued expiry.                                                    |
| `docs/guitar-isolation-plan.md`                             | Original feature contract, corrected to leave weights permission unresolved.                    |
| `docs/guitar-isolation-review.md`                           | Completed self-review, source freeze, limitations, exact identities and integration decision.   |
| `docs/guitar-isolation-validation.md`                       | Record reproducible evidence, measured results, deviations and hosting design.                  |
| `docs/railway-deployment.md`                                | Document CPU/RAM needs and personal-use model restrictions without infrastructure changes.      |
| `e2e-guitar-focus.mjs`                                      | Verify real separation, transport, save/reload, manual timing, lyrics and legacy songs.         |
| `package.json`                                              | Add setup:separator script.                                                                     |
| `scripts/separate-guitar.py`                                | Run pinned offline CPU Demucs with bounded streaming windows.                                   |
| `scripts/separator-requirements.lock`                       | Hash-lock explicit CPU dependencies for Linux CPython 3.11/3.12.                                |
| `scripts/setup-separator.mjs`                               | Provision local venv and fetch/verify the official weights.                                     |
| `scripts/start-production.mjs`                              | Forward separator paths/limits and allow the bounded model startup check.                       |
| `server/analysisApi.test.ts`                                | Check guitar preview methods and forwarding.                                                    |
| `server/analysisApi.ts`                                     | Allow GET/HEAD guitar preview with the existing 30 MiB audio cap.                               |
| `src/audio/analysisClient.test.ts`                          | Update mocked full-mix responses to the additive contract.                                      |
| `src/audio/analysisClient.ts`                               | Send focus, validate actual provenance, fetch both previews and use a guitar deadline.          |
| `src/audio/songJob.test.ts`                                 | Reject focus/hash/model mismatches and validate separating progress.                            |
| `src/audio/songJob.ts`                                      | Parse additive job/provenance shapes without changing pinned WASM types.                        |
| `src/components/AudioAnalysisPanel.tsx`                     | Offer explicit focus, truthful progress/source labels and recovery/warnings.                    |
| `src/components/SongPlayback.tsx`                           | Expose the original/guitar preview choice.                                                      |
| `src/components/SongbookPlayer.tsx`                         | Keep original recording identity and preserve manual timing/lyrics across focus.                |
| `src/components/useSongPlayback.ts`                         | Switch session previews on the same clock, retaining time, speed and play state.                |
| `src/data/songbook.test.ts`                                 | Check legacy/new parsing and preserved manual timing.                                           |
| `src/data/songbook.ts`                                      | Read legacy saved analyses and validate optional new provenance.                                |
| `validation/guitar-isolation/alignment-control.json`        | Measured acceptance evidence or its reproducible control/cleanup runner.                        |
| `validation/guitar-isolation/alignment-control.py`          | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/alignment-formats.py`          | Copy-through gain/timeline assertions for stereo, Opus, MP3, mono and opposite phase.           |
| `validation/guitar-isolation/buildkit.toml`                 | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/capability.json`               | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/changes.json`                  | One-line inventory of every changed/new task file.                                              |
| `validation/guitar-isolation/checks.json`                   | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/checks.py`                     | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/cleanup-fix-audio-parity.json` | Measured acceptance evidence or its reproducible control/cleanup runner.                        |
| `validation/guitar-isolation/cleanup.json`                  | Measured acceptance evidence or its reproducible control/cleanup runner.                        |
| `validation/guitar-isolation/cleanup.py`                    | Measured acceptance evidence or its reproducible control/cleanup runner.                        |
| `validation/guitar-isolation/container-job.mjs`             | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/container-proof.py`            | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/container-summary.json`        | Measured acceptance evidence or its reproducible control/cleanup runner.                        |
| `validation/guitar-isolation/evaluation.json`               | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/failure-controls.json`         | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/failure-controls.py`           | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/final-closeout.json`           | Final lint, diff, cleanup and inherited-process/builder exit checks.                            |
| `validation/guitar-isolation/final-proof.json`              | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/final-proof.py`                | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/fixtures.json`                 | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/identities.json`               | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/lead-review-evidence.json`     | Historical lead command output preserving intentional regression and toolchain failures.        |
| `validation/guitar-isolation/long-local.json`               | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/observations.json`             | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/observations.py`               | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/package-proof.py`              | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/packaged-artifacts.json`       | Non-root image artifact hashes and packaged/local parity checks.                                |
| `validation/guitar-isolation/packaging-checks.json`         | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/predeclared.json`              | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/prepare.py`                    | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/report.py`                     | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/run.py`                        | Acceptance runner or fixture preparation.                                                       |
| `validation/guitar-isolation/source-inventory.json`         | Task-only file inventory, byte counts and SHA256 values (excluding its own hash).               |
| `validation/guitar-isolation/takeover-checks.json`          | Exact commands, exits and timing for takeover acceptance.                                       |
| `validation/guitar-isolation/takeover-checks.py`            | Run final browser, seam, stub alignment and rustfmt checks serially.                            |
| `validation/guitar-isolation/takeover-source.json`          | Initial and final source snapshots, identifying the e2e-only change.                            |
| `validation/guitar-isolation/ui-detector.json`              | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/window-check.json`             | Measured acceptance evidence or frozen fixture/config identity.                                 |
| `validation/guitar-isolation/window-check.py`               | Acceptance runner or fixture preparation.                                                       |

## Cleanup

```json
{
  "passed": true,
  "remainingOwnedProcessIds": [],
  "remainingTaskContainers": [],
  "browserPorts": {
    "rustPort": 40427,
    "port": 41115
  },
  "browserPortsFree": {
    "rustPort": true,
    "port": true
  },
  "remainingJobDirectories": [],
  "branch": "feat/guitar-isolation",
  "head": "a696d54809ee27b75679255a7f7a927e47de55c2",
  "forbiddenTrackedChanges": [],
  "portableWasmSha256": "0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b",
  "retainedImage": "fretbloom-guitar-runtime:local",
  "noCommitsPushesDeploymentCredentialsOrLiveDatabases": true
}
```

## Verification summary

| Command / control                                                | Final result                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run check:fast`                                             | 19 Node + 267 Vitest passed; 7 skipped, 0 failed                       |
| `npm run build`                                                  | Passed, including strict WASM verification                             |
| `cargo test --release -p fretbloom-backend`                      | 21 passed, 0 failed (includes the stub guitar pipeline test)           |
| `cargo build --release --workspace`                              | Passed                                                                 |
| `cargo clippy -p fretbloom-backend --all-targets -- -D warnings` | Passed                                                                 |
| `node e2e-guitar-focus.mjs`                                      | 1 complete real browser scenario passed                                |
| `failure-controls.py`                                            | 8/8 passed                                                             |
| `alignment-control.py`                                           | Zero lag, equal 96,000 samples, correct stages                         |
| `window-check.py`                                                | 30 seconds crossing outer seam; byte-identical 1,323,000 stereo frames |
| `run.py`                                                         | 9/9 real backend jobs; repeat PCM identical                            |
| `run.py --long`                                                  | Native six-minute real job passed                                      |
| `docker buildx build --no-cache --load ...`                      | Fresh serial build passed in 440.47 s                                  |
| `container-proof.py`                                             | Non-root offline six-minute job passed at 2 CPUs / 2.5 GiB             |
| `cleanup.py`; `git diff --check`                                 | Passed                                                                 |

Normal checks were rerun sequentially after takeover. The inherited final-proof run completed the real inference, browser, failure controls and fresh container proof after the lead fixes. The seam and multi-format alignment controls were also rerun at takeover; see the review for their scope and source identities. No heavy builds or inference overlapped.

Root coverage improved on this DEV pair, but conditional root precision among emitted chord frames fell from 434/586 (74.1%) to 559/1088 (51.4%). This is a coverage/error tradeoff, not a blanket accuracy improvement. No acceptance holdout or human listening study is claimed.

## Exact fixture identities

The dataset is CC BY 4.0; generated accompaniment is CC0-1.0. Full original, annotation, clean, mixed and negative-control hashes:

```text
00_SS3-84-Bb_comp
wav_sha256: ece4c3e67d8ab31ca6665ef8cd143a61aedeeb6145e45fa4b74120630024039b
annotation_sha256: b410e8d7d6ed3040f3674b709c5144267f540a84fab47edc28365891832dcdb5
cleanSha256: 43c92356e8104f470f2ce7b70e4dc2a58c71b551f8e3436c0e7b693b0e38dd7e
mixSha256: dc4a1743ee11efa8347165e563385e2e437966b4f5332f8914d1deb43569be5e
negativeSha256: a9545c243e0605d4f845a5c62e0c13ceb756cd401e134bad43f370b73517a283
```

```text
01_Jazz3-150-C_comp
wav_sha256: 052c25a49deb385d8a2cbc5a1834aad079eed0fd3686c6e83ceea561674286d9
annotation_sha256: 37686bb3ec0495f1a1b488472c087f9580b9c376e02ff8b312b3338e022d19cc
cleanSha256: c48d26506e07847963b9cc12c46a707821757f02ff8e4d3b2efe79383b48f602
mixSha256: ac6c5caf44670894b420715c0131dbdab5e320419ce3af041ed97686f4a079e1
negativeSha256: 78b60e78d4cce15eff723b588931fdc55a79216dbe3c97a9f69f819d8218bc29
```

Native and container original/analyzed PCM identities match exactly. The final image is retained locally; no container is retained. Local implementation verification is complete; deployment remains gated on weights permission and resource provisioning. Musical errors, the small DEV sample, the declared accompaniment construction discrepancy, Linux-only packaging, and the weights restrictions remain limitations.
