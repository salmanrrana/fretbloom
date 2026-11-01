# Older Chromium / Linux WebKit cancellation matrix preparation

2026-10-31. Sol 6.1 xhigh test owner. Writes are limited to new `target/cancel-browser-matrix/**`, `validation/cancel-browser-matrix/**`, and this report. No implementation, previous fixture/evidence, production, live database, default preview, sibling checkout, original holdout, global installation, commit, push, or deployment was touched. No subagents were used.

**Preparation complete; actual-browser gates are NOT RUN.** The independent JSPI tester owns the exclusive heavy/timing window beginning 21:06:26.598Z. Exactly one coordination message was sent, identifying this owner and requesting explicit release before browser/build/DSP/cost work. Its message ID is recorded in `target/cancel-browser-matrix/environment/preparation-state.json`. No release arrived before preparation completed, so this owner returns now as instructed, without polling or blocking for release. No build, browser launch, DSP call, or benchmark was executed. No uncontrollable timing contention was observed because no timed work was attempted. Preparation did download/extract runtime files and inspect libraries while that tester held its window; these are preparation, not timing measurements.

## Pinned older Chromium

Official Chrome-for-Testing **136.0.7103.113**, revision **1440670**, Linux x64, downloaded from:

`https://storage.googleapis.com/chrome-for-testing-public/136.0.7103.113/linux64/chrome-linux64.zip`

The official [milestone metadata](https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone-with-downloads.json) response and exact selected record are retained as `downloads/chrome-milestones.json` and `environment/chrome-pin.json`. [V8 documents JSPI availability beginning in Chrome 137](https://v8.dev/blog/jspi). That is the reason for selecting 136; it is **not** a substitute for measuring feature state. The app's actual module/worker APIs still need to load in this version before compatibility can be asserted. It is a recent pre-JSPI runtime, rather than an ancient browser chosen to make APIs absent.

- ZIP SHA-256: `a9ec3b5f654745360095f4e066b6b78442e56fe4124831051449813e5c4e0f95`.
- Extracted `runtime/chrome-linux64/chrome` SHA-256: `b961b7f244d5f8c0ff27283ed505f5f0c87aa910b13fe12b708b5b4c92cdd1f8`.
- Exact HTTP response headers retained in `downloads/chrome.headers`; archive and extracted executable remain inside ownership. This is an official HTTPS download with a locally recorded SHA-256, not a claim of a separately signed Google SHA-256 publication.
- `environment/chrome-ldd.txt`: no unresolved linked libraries. No `chrome --version` or launch was run during preparation. Actual version is recorded by the execution harness after clearance.
- Re-extraction recipe: `PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-browser-matrix/prepare-chromium.py`. It checks the pinned archive digest and never launches the executable.
- The prepared direct route has no inspector/CDP/debugger flag. Its exact browser argv will be recorded. It uses a local profile/cache/temp directory, matching the prior isolated harness's per-child `--no-sandbox` choice without changing host policy. It opens only the owned loopback fixture. No JSPI-related flags, deleted globals, or replacement APIs are used.

## Isolated WebKit2359 loader recovery

Read the installed bundle's README, launcher, dependency script and ELF dependency inventory. The installed bundle identifies WPE Release, builder OS Ubuntu 24.04.4 LTS, builder date 2026-09-01T11:01:45.959771. Host is Ubuntu 24.04.5 LTS. The old missing-library launch is retained by its original owner and was not rerun here.

`environment/webkit-ldd-before.json` identifies all initial unresolved libraries across the actual MiniBrowser/process executables and WPE shared libraries: codec parsers, Flite and AVIF. Reading those packages' dependencies identified the transitive libraries. `environment/webkit-ldd-after.json` preserves the intermediate three-package dependency inventory, including its unresolved transitive dependencies; it is not a successful launch. The complete bounded preparation uses **12 pinned Ubuntu Noble base-release packages**:

| Package | Version |
|---|---|
| libgstreamer-plugins-bad1.0-0 | 1.24.2-1ubuntu4 |
| libflite1 | 2.2-6build3 |
| libavif16 | 1.0.4-1ubuntu3 |
| libnice10 | 0.1.21-2build3 |
| libva2 | 2.20.0-2build1 |
| libva-drm2 | 2.20.0-2build1 |
| libdav1d7 | 1.4.1-1build1 |
| libgav1-1 | 0.18.0-1build3 |
| librav1e0 | 0.7.1-2 |
| libsvtav1enc1d1 | 1.7.0+dfsg-2build1 |
| libyuv0 | 0.0~git202401110.af6ac82-1 |
| libgupnp-igd-1.6-0 | 1.6.0-3build3 |

Every exact official `https://archive.ubuntu.com/ubuntu/pool/...` URL, package SHA-256, byte length, version and dependency declaration is retained in `environment/ubuntu-packages.json` and the individual `.metadata` records. The host Noble InRelease signature was verified with `gpgv` and `/usr/share/keyrings/ubuntu-archive-keyring.gpg`; the uncompressed universe Packages index digest/length matched its signed SHA-256 entry before extracting records. Signed InRelease, signature output, index hash and package metadata are retained. No ESM credentials or packages were used. Every downloaded `.deb` was size/hash verified before `dpkg-deb --extract` into `webkit-root`. No package installation or maintainer script ran.

`environment/webkit-ldd-prepared.json` inventories **50 ELF objects**, with object hashes, actual resolved paths and complete ldd output: **zero unresolved libraries**. This closes the statically linked loader dependencies; it does **not** establish successful launch, dynamic module loading, WASM support, or a browser test pass.

The owned `runtime/webkit-local.sh` reproduces the bundle's `WEBKIT_EXEC_PATH`, injected bundle, inspector resources and complex-text environment, then adds only owned extracted libraries to the per-child loader path and execs the installed read-only MiniBrowser. The installed inner MiniBrowser wrapper overwrites `LD_LIBRARY_PATH`, so merely setting the variable outside `pw_run.sh` would not apply the local repair. Browser cache/bundle files and system configuration remain unchanged. Actual execution is prepared as **Playwright-connected Linux WPE WebKit2359**, not Safari; no direct/no-debugger WebKit result is claimed.

One package download stalled. The owned preparation process was terminated, the final 16,540-byte package fetched with bounded `curl --max-time 30`, then verified against signed metadata. The initial empty log is retained as `prepare-webkit-interrupted-download.log`; `prepare-webkit.py` now bounds network socket operations to 30 seconds. The completed log records 12 packages, 50 ELF objects and zero missing libraries. There were no repeated missing-library browser launches.

Reproduction on this host:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-browser-matrix/prepare-webkit.py
```

The script checks the retained signed InRelease and the current host's Noble base Packages index against its exact signed hash, then the pinned packages. If that host index is replaced, reacquire the identical official Noble index rather than bypassing verification. The already extracted launcher can be used independently without rerunning package preparation. This is local loader isolation, not a self-contained container or proof against all future host library changes; actual resolved host paths are in the inventory.

## Frozen module and real DEV inputs

Copied only inventory-verified immutable fixture files; no builds or generated implementation changes:

- Asyncify WASM: `504ff85abb81037ff0bc67945afc0f0d62feca25813dc190b7b0f6a07ea7a597`.
- Frozen generated candidate adapter: `2f2110a5ed2200ace3bae45ebf8638aee92fb0438dcbbfe4c768f29b9d0f26cb`.
- Frozen scheduling helper: `571a82045015e553e30ec8b99d03cedc0f56df920f4bec6cc2d556864d1c54fd`.
- Frozen reference WASM: `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1`.
- Reference glue: `605173100548e3b3737e1ec7f32ef083329d76bc19a9eeafda3d557be8741fe2`.

The corresponding JSPI builder canonical source remains `3b248453e4f5d5d5702c6718f7fbdd9113bba4043132288df1574c0255084d1b`; active product is still the separate baseline rust-dsp-3.1. This fixture does not adopt or exercise the new integrated builder. No integration artifacts were consumed or product acceptance scope expanded.

`environment/frozen-inputs.json` records exact original/copy paths and hashes for all five runtime inputs and three already allowed DEV windows (dense, real-solo, real-comp; each 61,440 samples). Their PCM hashes are verified against the previous cost evidence before copying. No original holdout was read. The complete pre-existing 55-file compatibility delivery inventory was rehashed unchanged in `environment/readonly-verification.json`.

## Ready execution and remaining gates

`validation/cancel-browser-matrix/run.mjs`, `worker.mjs`, and `page.html` are new independent orchestration/observer files around the unchanged frozen Asyncify implementation. The execution harness refuses to start without pinned Node v24.22.2 and an explicit `FRETBLOOM_MATRIX_TIMING_CLEARANCE` record. It rechecks originals and copies against their immutable hashes.

Root must first obtain the tester's explicit release, assign the exclusive timing window to the follow-up browser tester, then set the variable to the actual release/assignment message and UTC. Do not fabricate a clearance string. Run serially from repository root:

```sh
: "${FRETBLOOM_MATRIX_TIMING_CLEARANCE:?Record the actual explicit release and assignment first}"
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-browser-matrix/run.mjs direct:chromium:parity direct:chromium:cancel playwright:webkit:parity playwright:webkit:cancel
```

No existing evidence is overwritten; each spec gets a new timestamped run directory. The harness saves full raw result/error strings from both modules, not normalized fragments. It requires naturally absent native APIs in **both page and worker**, records worker-selected and actually used backend separately, and fails the fixture if JSPI is exposed. Actual browser version, commands/process cmdlines, runtime errors and cleanup are recorded. Browser/tool/timeout failures exit nonzero rather than becoming passes.

The prepared parity suite is 18 comparisons: three small modes, all three modes for each dense/real-solo/real-comp DEV window, empty/nonfinite/wrong-rate/invalid-JSON errors, successful reuse after errors, and a valid 300-second two-tone polyphonic call. Complete output strings include both result and alignment features. `valid300` requires successful `result.duration === 300` and candidate duration ≤120 seconds; a cap error cannot satisfy it. This sustained two-tone case does not establish dense/high-output/real-recording 300-second coverage.

The cancel suite uses a fresh actual worker and valid 7.2-million-sample request, marks entry, then terminates after a 450 ms timer. Neither entry nor termination/API completion earns a pass. The independent `/proc` observer walks only this browser process tree (including retained descendants/orphans), records exact PID/TID/start-time identities and completed census start/end times, requires ≥3 CPU ticks of growth across censuses wholly before the handler, and conservatively uses the **end** of a post-handler census missing that worker to measure ≤250 ms. It requires continued absence and no late reply over >2 seconds. Every busy thread is retained; automatic worker candidates require recognizable worker names. An unfamiliar WebKit name is an identification blocker for review, never an automatic pass. Sampling is every 15 ms plus actual census overhead; all durations, CLK_TCK and whole-Node-harness CPU usage are retained. No sampling overhead or stop number is claimed until execution. The Node CPU counter includes HTTP/orchestration, so it is labeled accordingly.

The direct Chromium path is prepared without a debugger. WebKit is prepared for Playwright only. If WebKit still fails after loader resolution, retain the exact error and executable/library inventory; do not relabel it Safari coverage or a pass. If a worker name cannot be independently identified, improve identification under the assigned window before declaring stop coverage. The first actual execution may expose harness compatibility errors; syntax checks are not an execution claim.

## Validation and cleanup at handoff

Completed checks: pinned Node `--check` for `run.mjs` and `worker.mjs`; Python `ast.parse` for both preparation scripts; official archive extraction/hash check; signed package index verification and every package hash/size check; complete linked-library census; immutable compatibility inventory comparison. No runtime correctness or performance test has run.

No owned browser, server, profile, or timed workload was started. The stalled download process was stopped; remaining preparation commands completed. Retain downloaded/extracted files for the follow-up tester. Only the three owned paths contain new files. `target/cancel-browser-matrix/delivery-inventory.json` lists every exact owned file, size and SHA-256 (excluding itself); `environment/cleanup.json` records the final owned-process check. No source/performance lock is retained by this owner. The existing JSPI tester's timing ownership remains in force until it explicitly releases it.
