# Minimal Firefox WebAudio control

Independent Sol6.1 xhigh executor, no children. **One actual audio control / one trusted click: plain WebAudio stalled under the retained Firefox launch conditions.** Case B was omitted because A already reproduces the suspended, stationary-clock symptom without Fretbloom. This establishes a common browser/environment prerequisite failure for this launch, not an app defect, an autoplay-only explanation, or a specific backend cause.

Only new `validation/firefox-audio-control/**`, `target/firefox-audio-control/**` and this report were written. No product edit, dependency installation, preference/sandbox/device/backend adjustment, global service, default preview, sibling checkout, production/DB/corpus access, secret read, commit, push or deploy occurred. No WASM/DSP, performance/music matrix, physical microphone/tab capture or product acceptance ran.

## Authority and prospective freeze

The genuine [root grant](../target/firefox-audio-control-root-grant.json) SHA256 is `3188116b6f8fced45212276653fa37fc8808d83f315f273e00e755b7ba58a298`. Its referenced prior release SHA256 `267aeacbc426bdca6fca939dd75f4bb208e8ca105742831f7e62ac386906d538` was verified, including its 2026-10-31T23:52:56.988311+00:00 release and empty process/port/profile lists. The [new scope release](../target/firefox-audio-control/scope-release.json), SHA256 `5c841bc9d4f235c111668be7543f5da47257954e245214f8e42c1eafb9fe86c8`, derives directly from that grant.

[Protocol](../target/firefox-audio-control/protocol.json), [pins](../target/firefox-audio-control/pins.json), source hashes and protected identities were frozen before any browser launch. The diagnosing-bugs skill supplied the bounded observation method; the explicit once-per-control limit superseded its repeat-testing advice. No delegate or followup was used, and no finished agent was awaited.

Read-only inputs included the preceding ownership report, retained v2 browser/page/paced launch and observation source, preparation/execution/freeze/cleanup helpers, prior Firefox click plan/results/marks/launch, runtime maps, and active plus frozen candidate `src/audio/live/capture.ts`. Both capture files have SHA256 `cacf24b8d81bd54a6aa73475c151961f5418dec44a139f29808e4e684eadad30`. In `start()`, context creation and `resume()` precede the first await. The retained harness instead creates a 24kHz context before runtime/worklet/init/PCM preparation and the eventual trusted click. This control isolates plain browser behavior before attributing that difference to product code.

## Exact control and launch

The [plain page](../validation/firefox-audio-control/control.html) contains inline JavaScript only: no imports, app modules, worklets or WASM. A real Playwright locator click constructs `AudioContext({sampleRate:24000})`, immediately calls `resume()`, then starts a 440Hz sine through gain `0.001` into `context.destination`, scheduling oscillator stop at context clock +2 seconds. No await separates those operations. Rejections, page errors, state changes, clock samples, `onended`, body/visibility/focus/secure-context and activation are recorded. There is no detector or fabricated PCM/output measurement.

Actual command, from `/home/xtra/code/personal_projects/fretbloom-song-audit`:

```sh
/usr/bin/python3 -B validation/firefox-audio-control/execute-v2.py A
# Recorded child argv:
/home/xtra/code/personal_projects/fretbloom-song-audit/.tools/node-v24.22.2-linux-x64/bin/node validation/firefox-audio-control/run-v2.mjs A
```

Actual browser argv:

```text
/home/xtra/.cache/ms-playwright/firefox-1543/firefox/firefox
-no-remote -headless -profile
/home/xtra/code/personal_projects/fretbloom-song-audit/target/firefox-audio-control/supervisor-tmp/playwright_firefoxdev_profile-4FsaXm
-juggler-pipe -silent
```

This exactly matches the retained Firefox155 revision1543 command except the owned temporary profile path. Extra args remain empty. The same three launch preferences are passed through the existing Playwright API: `javascript.options.wasm_js_promise_integration:false`, `media.autoplay.default:0`, `media.autoplay.blocking_policy:0`. Playwright sends these through `Browser.enable`; it need not write `user.js`. No preferences were added or tried until passing.

The [actual launch record](../target/firefox-audio-control/runs/A-control/launch.json) contains complete explicit environment and process identity. Every old environment key/value is preserved except owned writable-root/PID relocation. There is no `PULSE_SERVER`, `PULSE_RUNTIME_PATH` or `XDG_RUNTIME_DIR`, matching the old launch. HTTP loopback origin `http://127.0.0.1:34473` uses the same secure-localhost conditions. Parent-only Playwright logging was enabled; it was not added to the browser environment. Passive browser stdout/stderr listeners attach after `launchServer` returns and before any page/context; earlier startup stderr is unavailable.

Pinned Node is **24.22.2**, Playwright/core **1.57.0**, Firefox reports **155.0**. SHA256 identities:

```text
Node executable  904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52
Firefox          062272ac4d851eade5b75db2dc7c14569d96cb3ca38f949337cdc1b74367e35b
control.html     b68c7fade61c2e9322f2a6da32e71f2c1aedb7c66008d7a710b7f4480840cba1
run-v2.mjs       f42db992be8589fead1ee23c0b225d40231887791e7c9e2cb41bb5e84b9930a2
execute-v2.py    72baf67dae584cce0af6121f8bec2079b2adf7dd6c157ee55746bfd5b2236a51
pins.json        c3412d9f6b621cbeec6958c7f614008392ae25f7c4536653ef52a5acdf0cc465
protocol.json    db37e79c2b690d0e6e6ab2194cfed8a0f03d452c9a1153f0d4d14ba6652e0923
```

## Actual A outcome and timing

Click at **2026-10-31T23:58:10.850Z**: `isTrusted:true`, `isActive:true`, `hasBeenActive:true`. Context was absent before the handler. `resume()` and oscillator start/stop scheduling were recorded approximately **5ms into that same handler**, with activation still true. Requested and actual sample rate were **24,000Hz**, destination channel count **2**. Body existed; document was visible, not hidden, focused, and a secure context.

The actual context stayed **suspended**, `currentTime:0`; resume remained **pending**, not fulfilled or rejected. No `statechange`, `onended`, synchronous error, page error or unhandled rejection was observed. The gain/destination graph was connected and source start was called, but physical output and PCM were not measured.

Both page and host timers were scheduled for **15,000ms** without awaiting resume. The host won the result race and reported **14,999.817376ms** against its timestamp stored immediately after timer registration; its last already-persisted clock sample was **14,069ms** after click. The page's actual timer-final mark arrived immediately afterward, reporting **15,001ms** since click with the same pending/suspended/clock0 state. That is a **1ms timer scheduling overrun**, not an exact 15,000ms snapshot. Observation then froze; there was no extended diagnostic wait. Total elapsed was **16,234.996967ms before cleanup**, **16,850.516076ms including cleanup**.

The [original result](../target/firefox-audio-control/runs/A-control/result.json) remains unchanged. [Marks](../target/firefox-audio-control/runs/A-control/marks.jsonl) preserve both the watchdog's preceding snapshots and the page-final callback. [Assessment](../target/firefox-audio-control/assessment.json) joins these without silently replacing the watchdog result. Exit0 records successful bounded execution/cleanup, not an audio pass. [B omission](../target/firefox-audio-control/case-B-omitted.json) is explicit; no B clock/resume outcome is claimed.

## Output availability and limits

The original launcher did not explicitly configure or start an owned Pulse server; neither did this control. Passive [availability evidence](../target/firefox-audio-control/runs/A-control/audio-after-observation.json) found `/usr/bin/pulseaudio`, `/bin/pulseaudio` and `/usr/bin/pactl` absent. `/usr/bin/pipewire`, `/dev/snd` and the **existing** `/run/user/1000/pulse/native` socket were present. The owned `pulse-XR0ukjyInXeu` temporary directory had no entries, and no owned Pulse process was observed. Nothing was repaired or started. These facts do **not** prove the host socket is usable by this isolated browser, or that a usable output sink exists.

Captured [browser stderr](../target/firefox-audio-control/runs/A-control/browser-stderr.log) contains JSON.parse, BackupService empty-path and juggler progress-listener messages, with no specific audio-backend failure or initialization-success message. No unrecorded backend availability is inferred. Dynamic native-library/helper coverage is not exhaustive; the retained static runtime/library maps matched.

The minimal failure rules out treating the retained symptom as app-only evidence. It does not determine whether Firefox itself, its isolated launch context, or inaccessible/unavailable output service causes it. It does not establish an autoplay-only cause. It does not pass the Fretbloom path, physical output, microphone/tab capture, performance, musical acceptance or adoption. The 24kHz context matches the retained harness setting; the UI's default-rate constructor was not separately tested.

Small next action: **verify whether this isolated launch can reach the already-existing Pulse-compatible output service before further app debugging.** This report authorizes no service/device/policy repair or additional control.

## Retained preparation failures and closeout

Two setup command failures preceded the sole trusted click and graph construction. Neither was an audio control repeat:

1. `python3 -B validation/firefox-audio-control/execute.py A` failed creating `runs/A` because its parent was missing, before browser launch. [Original command/error](../target/firefox-audio-control/commands/A/stderr.log) and original frozen source remain. A new wrapper creates the owned parent and uses a separate command record; [prospective amendment](../target/firefox-audio-control/execution-amendment.json) records this.
2. `python3 -B validation/firefox-audio-control/execute-control.py A` launched Firefox but failed an observer-only read of nonexistent `user.js`, **before page creation**, then closed cleanly. [Failure](../target/firefox-audio-control/runs/A/failure.json) and [cleanup](../target/firefox-audio-control/runs/A/cleanup.json) remain. The [second prospective amendment](../target/firefox-audio-control/execution-amendment-v2.json), SHA256 `dbe968eb6c9314e325100f07dbc6b15b185d9c7d8383bd8ba87fc9c4df444d7c`, freezes the new observer/wrapper. It makes that existence observation optional, adds postlaunch stderr capture, and uses fresh paths; the original plain page, launch policy and budget are unchanged.

Thus there were **three command invocations, two Firefox launches, one page/control/AudioContext/trusted click**, no B, no graph retry. All prior/frozen records and failed preparation sources are retained. No failure was rewritten into a pass.

Static preparation was `python3 -B validation/firefox-audio-control/prepare.py`; syntax checks used the pinned Node `--check` and Python AST parser without bytecode. Static closeout was `python3 -B validation/firefox-audio-control/closeout.py`. [Before identity](../target/firefox-audio-control/identity-before.json), [after identity](../target/firefox-audio-control/identity-after.json) and [final verification](../target/firefox-audio-control/final-verification.json) confirm **1,832 protected files and 754 runtime/library/tool files unchanged**, including active/frozen capture source and retained ownership evidence.

Final verification found **zero owned execution/browser processes, zero profiles, and all four recorded HTTP/WebSocket ports closed**: 34473, 41179, 44329, 45465, checked on IPv4 and IPv6. Context cleanup returned `closed`; no cleanup kill was needed. Owned Pulse temp/profile directories were removed. No background work remains. Timestamped exclusive heavy-window release and final artifact hashes are recorded in [heavy-release.json](../target/firefox-audio-control/heavy-release.json) and [SHA256SUMS](../target/firefox-audio-control/SHA256SUMS).
