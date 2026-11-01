# Firefox explicit existing audio endpoint comparison

Independent Sol6.1 xhigh test executor; self only, no children, followups, owner waits, watchers or schedules. **Two browser cases, two trusted clicks: plain control PASS; actual Fretbloom paced capture/Stop/export PASS.** One additional command failed during filesystem setup before browser launch and is retained separately.

The sole semantic browser environment change was:

```text
PULSE_SERVER=unix:/run/user/1000/pulse/native
```

Under these retained isolated Firefox launch conditions, explicit discovery of the existing Pulse-compatible endpoint resolves both the plain WebAudio and Fretbloom resume/clock stall. Together with root's already-completed read-only libpulse comparison, this identifies a **test-environment audio-service discovery/configuration cause under these conditions**. There was no product fix. This is a sequential, single-case comparison, not a randomized repeatability study or proof about every Firefox/environment combination. Earlier stalled cases remain stalled/INCOMPLETE under their old environment; none was relabeled as passed.

## Authority and prospective bindings

The exclusive [root grant](../target/firefox-audio-service-root-grant.json) SHA256 is `d220bc7bd5a86235323a66def70f20a7e68020d2691b137dcd7eb5383a52df36`. Its four pinned artifacts were verified before preparation. The previous Firefox owner's release at `2026-11-01T00:00:02.692129+00:00` had zero owned processes, ports and profiles. The grant records root's read-only probe finished and contexts closed; no other owner was awaited.

The required three reports were read, along with the actual plain control/page/v2 wrapper, old launch/result, v2 paced/page/browser/observer/build sources, observation bindings, ownership preparation/execution helpers, frozen candidate identity/inventory, and root's libpulse probe/protocol/results. The diagnosing-bugs skill supplied one-variable observation discipline; the explicit case limit superseded its repeated-testing/minimization advice. The shared preview status was unavailable; the explicitly requested pinned standalone Firefox harness was used without opening another browser.

[Protocol](../target/firefox-explicit-audio/protocol.json) records the hypothesis, stop conditions, exact source bindings and restrictions. [Initial release](../target/firefox-explicit-audio/scope-release.json) SHA256 `1d85f69c9b1468cf794862e26cd5762c255e7728d82b77790c275af60bb179b7` froze A before execution. B was prepared only after A's actual PASS and clean closure. [Initial B release](../target/firefox-explicit-audio/scope-release-b.json) SHA256 `ddf593ca46261bc7bc6b5882ab1fb6906fe9a5839081e54fe03b5417de5f3fc5` and [prospective setup amendment](../target/firefox-explicit-audio/scope-release-b-v2.json) SHA256 `d8fb0c89b98b074d150096fb4795ff37454c1be326a813e4737db9b2661fb248` preserve both versions and the first command failure.

## Runtime, environment and product identity

Node **24.22.2**, Playwright/core **1.57.0**, Firefox **155.0**, revision **1543**, executable `/home/xtra/.cache/ms-playwright/firefox-1543/firefox/firefox`. Node executable SHA256 `904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52`; Firefox executable SHA256 `062272ac4d851eade5b75db2dc7c14569d96cb3ca38f949337cdc1b74367e35b`. The retained 754-file static runtime/library/tool map was verified before and after. Exhaustive dynamic dlopen/helper coverage is not claimed.

Both actual browser commands were:

```text
/home/xtra/.cache/ms-playwright/firefox-1543/firefox/firefox
-no-remote -headless -profile <owned profile> -juggler-pipe -silent
```

A's actual profile was `target/firefox-explicit-audio/supervisor-tmp/playwright_firefoxdev_profile-b5OhyD`; B's was `target/firefox-explicit-audio/tmp/playwright_firefoxdev_profile-yB7QSq`, both beneath the stated repository root. Extra args remained empty. Exactly the existing three Playwright preferences were passed: `javascript.options.wasm_js_promise_integration:false`, `media.autoplay.default:0`, `media.autoplay.blocking_policy:0`. No security, sandbox or autoplay policy was tried or changed.

[Environment comparison](../target/firefox-explicit-audio/environment-delta.json) mechanically compares each actual launch to its own prior launch. Every old key remains, every non-writable value matches, args/preferences match, and the only added key is `PULSE_SERVER`. Writable HOME/XDG cache/config/data, Cargo roots, GST registry and fd-backed TMPDIR were relocated inside this owner's paths. HOME remained isolated; neither `XDG_RUNTIME_DIR` nor `PULSE_RUNTIME_PATH` was added. No actual-user HOME or user cookies were loaded. The full exact argv/environment/PID/profile/origin are retained in each `launch.json` and `server.json`.

The unchanged frozen product in `target/cancel-control-repair/frozen` is:

```text
source association  646cbb9a09577a7362548c416959a2f5caf7dd4f13f94002f31ceb4955ef9f69
identity.json       dc7dc27eb63bf03c384ae7bf1a5466eaad946d9819a4c5b8fc8e4db4a7a64bed
inventory.json      56ba0c4169ee9c2180f07056403b0f83cec0dda0974b3d1b3b810442c26806dc
portable WASM      8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e
```

Engine `rust-dsp-3.1`, bridge2/schema1. All 220 frozen inventory entries were checked. B served an ordinary, byte-identical owned copy of the actual previously built v2 Firefox-click assets. Its built WASM has the exact portable hash above. All 217 candidate source files were also copied unchanged for review; numerical calls, timeout values, observers, PCM and transfer behavior were not altered. [Build reuse](../target/firefox-explicit-audio/build-reuse.json) joins all 229 copied build/source/input files to originals and hashes. Prior normal verifier/tsc/Vite and v2 build PASS were consumed, not rerun or newly claimed. No rebuild was needed and WASM was not regenerated. The copied `v2/build.mjs` is an unchanged reference, not an executed command.

Page/input SHA256:

```text
plain control.html       b68c7fade61c2e9322f2a6da32e71f2c1aedb7c66008d7a710b7f4480840cba1
product v2/page.js       f1c3c718ffc206d418b92b8fde83b873d1686102f664ad504599edce18d40d2a
product v2/paced.ts      27852d315126f183b3622f5dc13e8143c30c6780499f43e5f73174eda74e8c0c
served built blank.html  4ef2ebe8034b46a050afb14073e42c5e161d604b43ad164a439ef07c13f7b905
seed.f32le               5aefdbcce2ffec9913466f98dd171c5c209d2245e0d3a99cf7a0974034a6ee88
```

The server creates the same 2,880,000-byte 30s/24kHz input by repeating the unchanged seed. Source page and paced harness bytes match the old case exactly. The built page hash differs from source HTML because it is the original Vite-built page; the old and new built pages match each other exactly.

## Actual cases

**A: PASS.** [Result](../target/firefox-explicit-audio/runs/A-control/result.json), [marks](../target/firefox-explicit-audio/runs/A-control/marks.jsonl), [launch](../target/firefox-explicit-audio/runs/A-control/launch.json). Origin `http://127.0.0.1:38089/control?case=A`. The original plain page is preserved byte-for-byte. At `2026-11-01T00:02:33.275Z`, the one actual trusted click had active activation and no pre-existing context. The handler constructed the 24,000Hz context, called resume and scheduled the quiet 440Hz/gain0.001 oscillator start/stop synchronously, 9ms after click. Resume fulfilled at +85ms, running at clock0.016. `onended` arrived at +2069ms, clock2. The final snapshot was +2070ms, resume fulfilled, running, ended true, no errors. Both original 15000ms watchdogs remained unchanged and were canceled by successful completion. Actual elapsed was **3305.567404ms before cleanup**, **3922.717247ms including runner cleanup**. The console's later elapsed print is 3306.402789ms; the frozen result value is used here. Context cleanup returned `closed`. No physical output or PCM measurement is claimed for this oscillator.

**B: PASS for this built-product paced capture/Stop/export path.** [Result](../target/firefox-explicit-audio/runs/B-product/result.json), [marks](../target/firefox-explicit-audio/runs/B-product/marks.jsonl), [launch](../target/firefox-explicit-audio/runs/B-product/launch.json). Origin `http://127.0.0.1:39995/validation/cancel-audio-ownership-proof/blank.html?kind=click`. At `2026-11-01T00:03:37.421Z`, the one actual trusted click had active activation and synchronously called resume/source.start; resume settled 7ms later. The 30s AudioBuffer source ended at `00:04:07.422Z`, context clock30.288. The real ingestion-originated end barrier was acknowledged at `00:04:07.443Z`; runtime Stop and export completed. **354 observed worklet blocks / 723,968 observed samples = 723,968 stored samples = 2,895,872 exported PCM bytes.** Genuine note evidence before Stop was required and passed by the unchanged actual timeline-event check. No fabricated engine replies were used. Context closed at `00:04:07.560Z`; no capture/page/runtime errors or watchdog fired. Actual result elapsed was **31,459ms before browser/server cleanup**; command start/end were `00:03:35.889408` / `00:04:07.951501` UTC. The 75000ms diagnostic watchdog and all production timeouts were preserved.

The product context was already running at clock0.1546667 when click-ready was emitted. The first PCM and credit, clock0.2186667, preceded the click at clock0.2826667. This follows the retained creation/connection order and unchanged autoplay preferences; the click still genuinely started the source. It does **not** prove trusted activation was necessary for this environment. Exact transport counts include the actual graph setup/tail extent, rather than assuming precisely 720,000 captured samples from the 30s source.

These are graph/API tests against built product code, not complete React-control UI coverage, physical microphone/tab capture, physical sound-output measurement or Safari testing. There is no five-cycle, benchmark, CPU-stop, memory-bound, musical acceptance, adoption or general reliability claim. Those old limitations and failures remain unchanged.

## Commands and preserved setup failure

All commands ran from `/home/xtra/code/personal_projects/fretbloom-song-audit`. Static preparation/execution:

```sh
/usr/bin/python3 -B validation/firefox-explicit-audio/prepare.py
.tools/node-v24.22.2-linux-x64/bin/node --check validation/firefox-explicit-audio/run-v2.mjs
/usr/bin/python3 -B validation/firefox-explicit-audio/execute-v2.py A
/usr/bin/python3 -B validation/firefox-explicit-audio/prepare-b.py
.tools/node-v24.22.2-linux-x64/bin/node --check validation/firefox-explicit-audio/v2/browser.mjs
/usr/bin/python3 -B validation/firefox-explicit-audio/execute-b.py
# Preserve failure; prospectively freeze new browser-v2.mjs / execute-b-v2.py
# in scope-release-b-v2.json, before the following execution.
.tools/node-v24.22.2-linux-x64/bin/node --check validation/firefox-explicit-audio/v2/browser-v2.mjs
/usr/bin/python3 -B validation/firefox-explicit-audio/execute-b-v2.py
/usr/bin/python3 -B validation/firefox-explicit-audio/closeout.py
```

Python wrappers were AST-checked without bytecode. An additional read-only syntax check of the original prior v2 browser passed. Exact three child commands, UTC, cwd, explicit environment, PID, exit status and unmodified stdout/stderr are in [commands](../target/firefox-explicit-audio/commands):

```text
NODE validation/firefox-explicit-audio/run-v2.mjs A                        exit0
NODE validation/firefox-explicit-audio/v2/browser.mjs firefox155-click    exit1 BEFORE browser
NODE validation/firefox-explicit-audio/v2/browser-v2.mjs firefox155-click exit0
NODE=/home/xtra/code/personal_projects/fretbloom-song-audit/.tools/node-v24.22.2-linux-x64/bin/node
```

The first B wrapper created relocated XDG directories under `runs/firefox155-click`, which collided with the harness's atomic once-only run-directory creation. It failed `EEXIST` at `mkdir` **before browser launch, server start, page creation, context, trusted click or DSP**. The original command, failed script and release remain. The new version uses the fresh `runs/B-product` and `commands/B-product-v2` paths; no case or audio graph was repeated. The amendment additionally preserves the failure records. Small passive launch-identity fields were added for cleanup verification; they change no browser behavior. Script diffs are retained in `target/firefox-explicit-audio/source-diffs/`.

## Protected files and release

[Final verification](../target/firefox-explicit-audio/final-verification.json) confirms **1,905 protected files, 754 runtime/library/tool files, and 229 copied product/build/input files unchanged**, including active source, all frozen candidate entries, old harness/evidence/results, grants and releases. The [assessment](../target/firefox-explicit-audio/assessment.json) preserves actual outcomes and limits. The old failed control/result bytes were checked unchanged. Source-only parallel design paths were excluded from ownership.

Writes were confined to new `validation/firefox-explicit-audio/**`, `target/firefox-explicit-audio/**` and this report. Active/frozen product, default dist/preview, sibling checkout, prior evidence/harness, corpus/holdout and production/DB were not written. No installs, credentials, service/device/volume/policy/sandbox configuration, commits, pushes or deploys occurred. Only isolated browser/client state and the authorized test streams used the existing endpoint. No PipeWire/Pulse or daily-driver service was started, stopped or reconfigured. Newly generated owned browser HOME/config/cache/temp directories were removed after normal cleanup, without reading generated cookie contents.

Exclusive heavy ownership was released to root at **2026-11-01T00:05:03.932450+00:00 UTC**, after a fresh zero-owned-process/port/profile check. All four recorded ports **37869, 38089, 39225, 39995** were closed on IPv4 and IPv6; both actual profiles were gone. Both contexts closed normally, and no browser kill was needed. [Heavy release](../target/firefox-explicit-audio/heavy-release.json) records the exact grant and release lineage. No background work remains; the global audio service is untouched. Final artifact hashes are in [SHA256SUMS](../target/firefox-explicit-audio/SHA256SUMS).
