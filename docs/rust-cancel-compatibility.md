# Portable cancellation compatibility and bounded release audit

2026-10-31. Owner writes: `target/cancel-compat/**`, `validation/cancel-compat/**`, this report only. Active sources/config/generated assets and both other owners' freezes are read-only. No production, database, default preview, holdout, commits, pushes, global installs, or deployment touched.

## Architecture decision

**GO for a whole-call Asyncify compatibility candidate; BLOCKED for adoption today.** Keep the reviewed JSPI implementation for browsers providing both native APIs. For the missing-JSPI branch, use a separately generated numeric-handle wasm-bindgen module transformed by pinned Binaryen Asyncify at the existing `fretbloom_host.poll` import. Feature selection must happen in the worker using capability detection, with the same busy/initialization guard for either backend. The synchronous backend remains useful for tooling; it must not be presented as a passing portable browser cancellation repair.

The bounded experiment supplies a real alternative to a recognition state-machine rewrite: unchanged whole-call recognition, numeric arithmetic/order retained, task yielding, no independent analysis windows, dropped results, shared memory, COOP/COEP, synchronous network cancellation, or browser sniffing. It does **not** yet supply a safe production integration patch: the dual-artifact build/verification contract and complete product lifecycle tests are still missing. Root can authorize that concrete next integration without reducing browser scope. WebKit/Safari evidence remains blocked by installed dependencies, not by an approved support exception.

### Why a different bindgen backend is necessary

Pinned Binaryen 125, directly applied to the real bridge-v2 multivalue/externref artifact, fails with:

```
Fatal: Asyncify does not yet support non-number types, like references
```

The retained `input.wat` identifies the externref local in the generated `__wbindgen_string_new externref shim`; `tools/src-passes-Asyncify.cpp:1707` explicitly rejects saving nonnumeric locals. `transform-verbose.log` retains the actual attempt. Do not work around this by ignoring indirect calls: the real core invokes cancellation through a Rust callback, so that assumption would be unsound. No instrumentation removelist or unsafe call-graph claim was used.

Pinned wasm-bindgen 0.2.100 has an existing numeric JS-value heap backend. Its installed `src/lib.rs:323–327` selects externref conversion from the raw module's `target_features` metadata. The fixture removes **only** the `reference-types` metadata entry before bindgen, keeping `multivalue` and every code/data section byte-identical. It does not patch recognition instructions. The resulting bridge uses the same five numeric parameters and four-number return tuple, with `takeObject`/JS-heap ownership instead of an externref table. Asyncify then transforms successfully with conservative indirect-call instrumentation and `asyncify-asserts` enabled.

The raw input was frozen from the builder's coalesced bridge. Normal bindgen regeneration of that exact raw input produces WASM SHA-256 `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1`, exactly matching the completed JSPI builder freeze. Thus this is associated with the selected speedup and cancellation bridge, not an unrelated raw compilation. The original optimized numerical baseline remains engine `rust-dsp-3.1`.

The candidate host calls Asyncify's start/stop unwind/rewind exports, unwinds the same raw analysis call, yields through one reusable MessageChannel task, and re-enters that same raw export with its original arguments. The poll returns numeric zero. There is one 1 MiB heap allocation for the saved stack plus eight bytes of metadata. Returned success JSON and numeric-handle errors use the pinned generated glue's ownership; partial unwind tuples are never decoded/freed as completed results. No other WASM export may run while suspended. The fixture worker rejects concurrent messages before glue allocations. A trap requires discarding the owning worker/instance.

References: [Binaryen 125 Asyncify source](https://github.com/WebAssembly/binaryen/blob/version_125/src/passes/Asyncify.cpp), [wasm-bindgen 0.2.100 generator](https://github.com/rustwasm/wasm-bindgen/blob/0.2.100/crates/cli-support/src/lib.rs). The local pinned copies/tool identities are recorded below.

## Frozen candidate and measurements

`target/cancel-compat/identity.json` hashes the candidate source, glue, baseline, transformed module, raw input and tool pin. `environment.json` records artifact sizes/tool binaries, Node v24.22.2, Linux 7.0.0-42-generic, Intel i7-1165G7. `input.json` records the first preparation command and raw-input hashes. Binaryen archive SHA-256 `7c3bc16599c8274a04d34a504fe4be2047884f900e0e2da2f6fb9cd667183be4` matches its separately downloaded [official checksum](https://github.com/WebAssembly/binaryen/releases/download/version_125/binaryen-version_125-x86_64-linux.tar.gz.sha256). The official version_125 archive, checksum, Apache-2.0 license and source excerpt are retained only under the owned tools directory. There were no system changes.

Artifact size tradeoff: JSPI WASM 587,478 bytes; numeric-handle untransformed WASM 585,791 bytes; Asyncify WASM 1,472,920 bytes. These are uncompressed bytes. Root would need a reproducibly built and hashed second artifact set, glue/declarations and helper/tool identity; copying this experimental WASM into active generated assets would bypass the required guarded build.

`smoke.json`: eight exact comparisons pass, including all three modes, empty/nonfinite/wrong-rate/invalid-JSON errors, and a successful call after errors. Smoke budget was 1 ms to require repeated suspension (14–28 yields on successful one-second inputs). Errors match complete thrown strings. The async wrapper's success string includes **both result and alignment features**, with no normalization.

`cost.json`: six frozen live windows, two warmups plus five retained samples, alternating engine order per sample, one bounded feasibility block. Every complete output string matches the builder's bridge-v2 baseline. These are not the established three-block/15-sample acceptance distributions, browser event-delay gates or an independent validation. No full cost acceptance claim follows. Partial first cost evidence, whose noise path was missing, is retained as `cost-partial.{json,log}` and excluded from the completed feasibility summary.

| Window | Baseline median ms | Asyncify median ms | Asyncify interpolated p95 ms |
|---|---:|---:|---:|
| sideband | 249.87 | 268.87 | 277.98 |
| dense | 100.34 | 111.05 | 112.32 |
| real-solo | 154.44 | 167.38 | 185.51 |
| real-comp | 103.75 | 110.81 | 126.53 |
| noise | 79.20 | 89.42 | 101.30 |
| dense-boundary | 52.33 | 57.51 | 57.97 |

`long.json`: one valid deterministic sustained two-tone polyphonic whole call at each length, not a cap failure. Full output strings match exactly. This is a simple sustained polyphonic fixture, not a substitute for dense/high-output/real-recording 300-second sweeps.

- 30 seconds: baseline 565.79 ms, Asyncify 769.81 ms, output 43,008 bytes.
- 300 seconds / 7.2M samples: baseline 5,437.00 ms, Asyncify 6,528.35 ms; output 419,467 bytes; `result.duration` = 300; output SHA-256 `cf9bad3545cc357574cac65dbb5c0a501d106340da1d048c03425045c9135be7`.
- 300-second Asyncify: 86,783 host polls, 128 task yields, longest measured active raw-export interval 56.96 ms, saved-stack high-water 2,832 bytes, linear-memory high-water 39,583,744 bytes including the allocated Asyncify stack. Baseline linear high-water 38,535,168 bytes.
- Process RSS after that call was 261,701,632 bytes with **two instances** loaded in one Node process. This is not a per-worker process bound. JS 96 MiB product ownership, browser native memory and all-input stack-depth safety are not certified here. Binaryen checks stack bounds when unwind/rewind completes, not before each write; the measured 2,832 bytes is an observation, not a universal bound.

## Real browser evidence and limits

Actual files are under `target/cancel-compat/browser/`. The page calls the generated actual Rust analysis/glue in a real module worker. It does not exercise the complete ingestion/retained-session facade. No UI/mock result or synthetic infinite-spin engine was substituted.

- **Firefox 155.0**, installed firefox-1543: default runtime exposes both native JSPI functions. With the isolated launch preference `javascript.options.wasm_js_promise_integration=false`, the page **and worker** report both APIs `undefined`. The Asyncify small analysis completes. This is a real runtime-disabled Firefox branch; it is not evidence for historical Firefox versions or Safari. We do not delete or replace any WebAssembly globals.
- Firefox cancellation follow-up: actual 300-second PCM request, `DOM Worker` CPU grows **17 ticks** between completed samples wholly before cancel. The DSP thread is conservatively absent by **51 ms** after the page's cancellation handler mark. It remains absent for the remainder of the >2-second observation, and there is no late result. Worker identity is distinct from the browser's background/JIT pool threads.
- **Chromium 143.0.7499.4**, installed chromium-1200: Asyncify path is used directly and contains no JSPI calls, but native APIs are still exposed. DSP `DedicatedWorker` grows **21 pre-cancel CPU ticks**, conservatively absent by **32 ms**. No late result. This validates Asyncify scheduling on that browser; it does **not** validate an actual old/no-JSPI Chromium runtime. Tried `--no-wasm-jspi` and `--no-experimental-wasm-jspi` launch flags did not remove the APIs; all such runs retain their actual feature state and are not mislabeled no-JSPI coverage. No further browser/tool shopping was done.
- **WebKit 2359**: explicitly launched the installed `pw_run.sh`, avoiding the stale default Playwright executable path. It fails before page load with missing `libgstcodecparsers-1.0.so.0`, exit 127. `webkit-small.json` retains the full error. No Safari version, WASM load or cancellation claim can be made. No global repair attempted.

The final observer samples only the already-censused browser process tree, with start/end timestamps for every `/proc` read batch; maximum batch durations were 28 ms Firefox and 26 ms Chromium. CLK_TCK is 100, so CPU accounting has 10 ms granularity. Busy proof requires completed samples before the handler; the disappearance bound uses the **end** of the first fully post-handler census missing that exact thread, not its start. JIT/pool threads that consume CPU are retained in raw evidence and are not falsely called DSP workers.

The first Firefox observer walked global `/proc` on every sample, taking 98–174 ms. Its 266 ms conservative disappearance bound did not certify 250 ms; retain it as `firefox-cancel-slow-observer.json`, **inconclusive**. The declared follow-up changes only observation overhead and retains the same PCM/real processing/termination. The initial ignored Chromium flag runs are also retained separately. These are not cherry-picked numerical outliers.

All browser runs here used Playwright's browser connection. Direct/no-debugger product cancellation, nested ingestion ownership, saved PCM/retry, deadline/watchdog sweeps, phase/re-entry/trap rejection tests and five complete product cycles must still be established for this new backend. They are not inherited automatically from the JSPI tester. This limited candidate does not close the public portability contract.

## Required root integration before this could ship

The concrete design is one JSPI primary backend and one numeric-handle Asyncify backend, selected solely by both JSPI APIs being available. Build both from the same verified raw Rust module. Extend the guarded build/verifier to include the numeric backend's deterministic generation, Binaryen pin/license and all output hashes; generate the fallback wrapper/declarations from its actual numeric-handle multivalue ABI. Keep both branches under the existing worker initialization/busy guard and preserve whole-request generation/deadline/late-reply rules. Add the saved-stack allocation to reported/bounded worker memory. Do not let synchronous tooling imports become the browser fallback by accident.

The current fixture supplies runtime, guarded-message worker and generated ownership wrapper for this design. It is intentionally **not** an integration patch against active product code: generic exported glue can still be called incorrectly by arbitrary callers, complete lifecycle integration is untested, old Chromium is not installed, and WebKit cannot load. A full state-machine rewrite is not justified by the successful bounded Asyncify evidence.

## Bounded read-only release audit

Root owns all fixes and publication. No hosting/build sources were edited here.

| Finding and location | Impact / minimum action | Owner / state |
|---|---|---|
| `Dockerfile:16`, `:31` omit `scripts/wasm-jspi-adapter.mjs`; candidate `scripts/wasm-build.mjs:1` imports it and candidate verifier `:43` hashes it | Both build stages need the helper in their exact COPY inventory. Otherwise module resolution or verification fails. | Root packaging track; root acknowledged ownership. |
| Candidate verifier `scripts/wasm-verify.mjs:44–45` hashes `src/audio/live/**` and `src/audio/analysisV1.ts`; `Dockerfile:13–18` copies neither into wasm-builder | Add the same canonical source inventory before guarded regeneration. Missing directory otherwise produces ENOENT. | Root packaging track; preserve canonical manifest association. |
| `.dockerignore:27–28` excludes test TS/TSX, while candidate canonical source inventory recursively includes live tests | Node-builder `COPY src` loses files named in canonical source identity. Docker ignore exceptions/COPY inventory must preserve the exact canonical hashed inputs; regenerate/check through normal guarded flow if the inventory changes. | Root packaging track; do not silently weaken verification. |
| Active bridge checks: `src/audio/live/analysis.worker.ts:38`, `scripts/wasm-build.mjs:109,130`, `scripts/wasm-verify.mjs:64`, generated manifest `:3` are v1. Frozen builder equivalents are v2 and host import defaults are explicitly injected | Adopt the complete bridge-v2 patch and regenerated assets together. Speedup-only or generated-WASM-only adoption leaves an incompatible init/import/version contract. Current active v1 is internally consistent and was not changed. | Root integration; builder freeze already contains the paired v2 changes. |
| `validation/live/browser.ts:19` still requires bridgeVersion1 | Update any current acceptance harness using this helper to expect v2. It is a harness issue, not a saved-session schema migration; `parseAnalysisResult`/feature validators still take engine identity separately. Do not edit archived evidence to v2. No current helper callers were found in the bounded live-directory search. | Root/test harness, conditional blocker if reused. |
| Speedup-only `target/live-cost-builder/frozen/source/crates/fretbloom-analysis/src/live_cost_tests.rs:94–103` searches ignored ancestor `target/.../cost-pcm` in a default test | Use the completed repair-builder split at `frozen/source/.../live_cost_tests.rs:94–139`: default synthesized test, explicitly ignored frozen test with absolute FRETBLOOM_COST_PCM_DIR, complete file validation and exact fixture hashes. Do not integrate the speedup-only test unchanged. | Builder fixed in its final freeze; root must preserve it. |
| `validation/**` is untracked; e.g. `validation/live/runs` alone is 210 MiB and contains archived source/context trees; `.gitignore` does not globally exclude these archives | No accidental staging currently observed: `git diff --cached` and `git ls-files validation` were empty during this audit. Root must stage a deliberate validation/evidence allowlist rather than bulk-add archived contexts. `.dockerignore:14–18` already keeps target/validation/docs out of Docker; Vite test/lint excludes contexts/runs. | Root packaging; risk, not an already staged defect. |

MIME/environment checks did not uncover a cancellation-specific code defect: `server/index.ts:30` explicitly serves `application/wasm`; generated glue has the standard wrong-MIME byte-buffer fallback; Netlify `netlify.toml:1–6` builds checked-in verified artifacts with pinned Node24.22.2 and publishes `dist` (no Rust install required for verification-only builds). No actual hosted headers or Netlify build were tested. Existing static Netlify config has no backend proxy: its SPA catch-all at `:8–11` cannot provide `/api/session`, `/api/songs` or Rust/YouTube APIs. `server/index.ts:243–253` / `scripts/start-production.mjs:29–40` require DATABASE_URL and a 20+ character FRETBLOOM_ACCESS_PASSWORD for full hosted mode. These are pre-existing hosting-scope/environment requirements; root must not promise static hosting supplies the backend or touch a live database to test this cancellation patch. No new isolation headers are needed by the proposed Asyncify path.

## Commands and closeout

First preparation, performed once against the then-frozen associated builder input:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-compat/prepare.py
```

To reproduce generation from the retained **owned** frozen numeric input instead of rereading another owner's evolving tree:

```sh
.tools/wasm-bindgen-0.2.100/bin/wasm-bindgen target/cancel-compat/numeric-input.wasm --target web --out-dir target/cancel-compat/numeric --out-name fretbloom_wasm
target/cancel-compat/tools/binaryen-version_125/bin/wasm-opt target/cancel-compat/numeric/fretbloom_wasm_bg.wasm --all-features --asyncify --pass-arg=asyncify-imports@fretbloom_host.poll --pass-arg=asyncify-asserts -o target/cancel-compat/numeric/asyncify.wasm
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/adapt.mjs
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/smoke.mjs
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/cost.mjs
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/long.mjs
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/browser.mjs firefox:small webkit:small
.tools/node-v24.22.2-linux-x64/bin/node validation/cancel-compat/browser.mjs firefox:cancel chromium:cancel
PYTHONDONTWRITEBYTECODE=1 python3 validation/cancel-compat/freeze.py
```

Do not rerun those measurements during the independent tester's exclusive window. All own compute ended before explicit performance-clear at 21:06:26.598Z, acknowledged by the tester; subsequent work was source reading, documentation and hashing only. Browser closeouts report no live owned PIDs. No background server, port, worker, browser or measurement remains owned by this track. Ownership is released with this handoff. **Adoption remains blocked for root decision; capability feasibility is demonstrated without changing product scope.**
