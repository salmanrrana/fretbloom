# Rust cancellation repair implementation — frozen JSPI candidate

Sol 6.1 xhigh builder; no subagents. Frozen 2026-10-31T21:02:09.419553+00:00. **Builder performance-clear: all owned timing/heavy work ended; all owned processes stopped. Ownership released.** No subsequent benchmark/build will run without coordination. This does not certify another owner's CPU release.

The reviewed product JSPI bridge is implemented and passes the focused builder checks on Chromium 143.0.7499.4 and Firefox 155.0. This is **not adoption or complete portable acceptance**: the explicit non-JSPI Chromium branch fails the unchanged 250 ms stop gate; WebKit cannot launch here; the independent acceptance items below remain open. No browser sniffing, public capability removal, relaxed deadline, production operation, commit, push, deployment, or original-holdout use occurred.

**Frozen handoff.** The immutable input is [frozen/source](../target/cancel-repair-builder/frozen/source), [WASM/glue](../target/cancel-repair-builder/frozen/wasm), [native executable](../target/cancel-repair-builder/frozen/analyze-pcm), [identity](../target/cancel-repair-builder/frozen/identity.json), and [inventory](../target/cancel-repair-builder/frozen/inventory.json). Two ordinary unified patches are supplied: [active → candidate](../target/cancel-repair-builder/frozen/from-active.patch) and [optimized numerical base → cancellation candidate](../target/cancel-repair-builder/frozen/from-optimized.patch). The latter uses unchanged current runtime/build files where the numerical-only freeze has no runtime copy. [Assembly provenance](../target/cancel-repair-builder/assembly.json) records every initial copied file. Frozen dependency symlinks point to existing repository `node_modules`/`.tools`; no new install was performed.

| Identity | SHA-256 |
|---|---|
| Canonical source | `3b248453e4f5d5d5702c6718f7fbdd9113bba4043132288df1574c0255084d1b` |
| Production runtime | `8970edb304c0c6e705950b0aa51b8061f0dbd00a419f24e6ef308d8b838631a4` |
| Native executable | `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa` |
| fretbloom_wasm.js | `605173100548e3b3737e1ec7f32ef083329d76bc19a9eeafda3d557be8741fe2` |
| fretbloom_wasm.d.ts | `a3b7936f4120a3bf64589adc426920cae75cb13997293ca98ec8b2ade6177650` |
| fretbloom_wasm_bg.wasm | `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1` |
| fretbloom_wasm_bg.wasm.d.ts | `8fb535b7d0a88b698f4b84cb1ce417e57e1ee0e06162177e34074ef37a664529` |
| Manifest | `f252c989113c4f837a9a5e219911f5739d2da75e024664e42a548301f6cd4319` |
| Patch from active | `2431b61cb46598c005be23e495abd8a7d09be9493d1be42b6a3674d66c0e5233` |
| Patch from optimized base | `e22789093a491d5664c41c70bcf9c80459551a6851e1651d846cd18d8cf0e7da` |
| Full frozen inventory | `d11cce3d43125a44b4a279cf4f0cf0172256b289a0e3f15ecec50bb223949955` |
| identity.json itself | `0350987d9f09a1a2aaef26b12c6ed941eb81ec709d0d28afb030f9b62eca5d04` |

`runtimeHash` is SHA-256 of compact JSON mapping the manifest's production `src/` entries (excluding `.test.`) to their SHA-256, in manifest order. The ordinary source hash is the source-hashed verifier's canonical `{tools,sources}` identity. The inventory binds the complete copied source, runtime fixtures, native executable, generated set and patches; its own file and `identity.json` are separately hashed above. Every generated artifact and source association passes normal staged build/publish/check in the owned fixture; no manifest waiver or manual generated-file edit was used. [evidence](../target/cancel-repair-builder/stage-final.log), [evidence](../target/cancel-repair-builder/publish-final.log), [evidence](../target/cancel-repair-builder/regeneration-coalesced.log).

The numerical base is exactly source `d89083935142dd7cc8e21e1c57a08d7b21f39f3bf5d9d2d5d697fc86bbb5f6c4`, WASM `7b40ba5ce7fb9018a510c8ddb063304839a9d28abf58675953cbd3093fb23e73`, native `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`, original speed patch `e946722e90b298bbe154bfa9d8160712e7b9f649e2bdbaf88ff35ee0bfea9555`. Every production analysis `.rs` file is byte-identical to that optimized source; only its test module and dev dependency differ. The native release binary remains identical. All active source/artifacts remain unchanged, including the active baseline association `f75b55eb…` / WASM `c9217873…`. [evidence](../target/cancel-repair-builder/native-identity.json), [evidence](../target/cancel-repair-builder/active-verify.log), [evidence](../target/cancel-repair-builder/closeout.json).

**Implementation changes relative to the numerical freeze:**

- `Cargo.lock`
- `crates/fretbloom-analysis/Cargo.toml`
- `crates/fretbloom-analysis/src/live_cost_tests.rs`
- `crates/fretbloom-wasm/src/lib.rs`
- `scripts/wasm-build.mjs`
- `scripts/wasm-jspi-adapter.mjs`
- `scripts/wasm-verify.mjs`
- `src/audio/live/analysis.worker.ts`
- `src/audio/live/runtime.test.ts`
- `src/audio/live/runtime.ts`
- `src/audio/live/taskYield.ts`

- The bridge requires `fretbloom_host.poll() -> i32`, with a non-WASM implementation so native tests link. Internal bridge version is 2; saved schema stays 1 and numerical engine stays `rust-dsp-3.1` after exact parity.
- Important measured correction: importing at **every** checkpoint produced Firefox sideband p95 **2,314 ms**. The final bridge invokes the existing predicate at every engine checkpoint but crosses into the host on the first, then every **64** checks. A local `AtomicU32` satisfies the engine's `Sync` callback bound; the portable unshared WASM target needs no shared memory/COOP/COEP. This changes scheduling only, not recognition arithmetic/order or native core. The first checkpoint still honors a host cancellation immediately. The earlier artifact and its failing evidence are preserved in [initial-every-check](../target/cancel-repair-builder/initial-every-check). Final host-gap and real CPU-stop results below justify the stride.
- The source-hashed generation helper verifies exact pinned JS/declaration hashes and rejects ABI/glue drift. It removes the bare raw-host ESM namespace import, wires the actual `WebAssembly.Suspending` object into both init paths, and preserves an explicit default synchronous `() => 0` import. The generated async allocation/string/error/free wrapper awaits **the raw** `WebAssembly.promising` export's four-value multivalue result. Externref initialization/start/deallocation remain generated. No retptr shim or global WebAssembly patch exists. Inputs retain bindgen ownership through the await; only a valid success return string is freed. Traps/rejected suspensions cause worker failure and instance disposal.
- Typed optional JSPI detection, a reusable MessageChannel with at most one pending task, and numeric **0** resolution yield around 50 ms. Most polls return a number synchronously. Initializing/ready/busy/failed guards reject repeated init and concurrent analyze before any export/allocation, and hold busy through decode/free/validation/reply. Both live and refine use the same adapter and stable key/id.
- Owner termination/generation/retained-PCM behavior and the production **5 s live / 120 s total refine / 121 s facade** deadlines remain unchanged. A small facade fence ignores queued `refined` events after their refinement RPC has been canceled. `refineUsed` is never reset: retry uses a fresh generation restored from the unchanged Blob/snapshot.
- No ingestion code change was needed: measured synchronous decode/copy/export boundaries fit the engineering budget. Portable tests now separate default synthetic from explicitly ignored frozen inputs. Requested fixtures require an absolute `FRETBLOOM_COST_PCM_DIR`, nonempty aligned finite f32le and declared SHA-256; missing/malformed/wrong-hash requests fail clearly. SHA-256 uses existing workspace-locked `sha2 0.10.9` as a dev dependency only; no package version/checksum changed.

**Focused verification completed.**

- Guarded staged build/publish, normal regeneration `--check`, source before/after association and drift refusal pass. Cargo fmt, native and wasm-target Clippy with `-D warnings`, TypeScript and three focused Vitest suites (**19 tests**) pass. Default Rust library tests pass (**15 analysis + 1 bridge**, four explicit ignored tests), including a clean source copy with **no `.f32le` files**. Frozen opt-in succeeds; absent variable and five malformed/missing fixture requests fail as expected. [evidence](../target/cancel-repair-builder/checks.json), [evidence](../target/cancel-repair-builder/clean-defaults-final.log), [evidence](../target/cancel-repair-builder/portability.json), [evidence](../target/cancel-repair-builder/runtime-tests-final.log), [evidence](../target/cancel-repair-builder/typecheck-final.log), [evidence](../target/cancel-repair-builder/clippy-final.log), [evidence](../target/cancel-repair-builder/clippy-wasm-final.log).
- Oxlint inspected all three changed production TS files. Because repository `target/**` exclusions suppress ordinary fixture paths, the same source bytes were read through a directory-fd alias with the same rules and explicit ignore removal; this writes no external files. The successful file list and command are retained. Earlier “no files” attempts are not passes. [evidence](../target/cancel-repair-builder/lint-files.log), [evidence](../target/cancel-repair-builder/lint-command.json).
- Real ABI: numeric suspended 0 success, suspended 1 → `CANCELED` on the first checkpoint, initialized externrefs, repeated successes, **210 exact Rust JSON errors** with stable externref table size, invalid input/options, trap and rejected suspension propagated with discarded instances, default synchronous init and initSync, and actual suspending initSync all pass. Linear memory is an ordinary ArrayBuffer. [evidence](../target/cancel-repair-builder/abi.json).
- Real worker rejects analyze during initialization, second init during initialization and suspension, and second analyze during suspension; only the original analysis returns a result. Guard placement is before every export/allocation. See retained browser reentry records and frozen worker source.
- Exact **result AND feature JSON bytes** versus the optimized WASM baseline: 12 frozen input/mode pairs, 90 synthetic length/mode/options pairs, and five larger calls (300 s dense-boundary auto; 300 s padded DEV polyphonic; 30 s real-comp in all modes). Signed zero, seeded noise, multiple references/spellings and off-grid lengths are included. Native is protected by identical release bytes; pre-existing native/WASM rounding differences are not reclassified as new equality. [evidence](../target/cancel-repair-builder/abi.json), [evidence](../target/cancel-repair-builder/boundary-parity.json), [evidence](../target/cancel-repair-builder/large-parity.json). No unrelated full music/holdout suite was rerun.

**Timing and memory are separate gates.** Named device: Linux-7.0.0-42-generic-x86_64-with-glibc2.39, 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz; Node 24.22.2, Rust 1.89.0, bindgen 0.2.100. No owned build or second compute run overlapped the reported final timing runs. Browser window cost has no `/proc` monitor in its controlled final runs; earlier monitored probes remain exploratory evidence.

| Actual analysis worker window | Chromium JSPI p95 ms | Firefox JSPI p95 ms |
|---|---:|---:|
| dense | 123.66 | 128.00 |
| sideband | 264.92 | 313.60 |
| real-solo | 160.05 | 201.20 |
| real-comp | 108.39 | 130.30 |

All final rows meet **p95 ≤500 ms**. Browser versions are Chromium 143.0.7499.4 / Firefox 155.0; both JSPI APIs were observed. [evidence](../target/cancel-repair-builder/browser-playwright-chromium-workercost-1793479780051.json), [evidence](../target/cancel-repair-builder/browser-playwright-firefox-workercost-1793480033509.json).

Node full-bridge cost uses three alternating blocks, three warmups and 15 retained samples per input/engine, with no deletion or extension. Overall candidate maximum p95 is **264.34 ms**. The paired sideband p95s are:

| Block | Optimized baseline ms | Cancellation candidate ms |
|---|---:|---:|
| 1 | 240.28 | 264.34 |
| 2 | 254.29 | 248.19 |
| 3 | 257.38 | 257.95 |

[evidence](../target/cancel-repair-builder/cost.json). This is standalone Node bridge cost, separately from actual-worker compute and UI event delay.

The final **30 s real WebAudio/worklet** journey (repeated allowed DEV crop, left channel) has **829.56 ms p95** event delay across all 45 pre-Stop timeline patches, max 831.20 ms, below **1.5 s**. Queue high-water is 2, skipped windows 0, and observed main-thread long tasks 0. [evidence](../target/cancel-repair-builder/steady.json).

The final 36-case 2.56/30/300 s matrix covers frozen real-comp, dense, sideband, silence and all three modes. Worst entry-to-first-poll **11.8 ms**, host-poll gap **13.6 ms**, yield interval **54.1 ms**, final-poll-to-decoded-result/error **5.4 ms**. Copy, JSON parse and boundary validation are recorded separately in every row. High-output cap errors are retained as errors, never used as a valid 300 s completion pass. Diagnostic ingestion measures include restore decode **118.8 ms**, full PCM copy **16.5 ms**, export encoding **16.8 ms**; slower total restore/export includes asynchronous Blob/hash waits. [evidence](../target/cancel-repair-builder/intervals-coalesced.json), [evidence](../target/cancel-repair-builder/browser-playwright-chromium-ingestion-1793479137774.json).

Real retained-PCM **300 s / 7.2M-sample** refinement succeeds after cancellation and fresh restore: final Chromium retry 9458.10 ms, Firefox retry 11384.00 ms, both below **120 s**, returning all 3,750 alignment frames. The dense-boundary seed is the established valid fixture; the separate real-polyphonic 300 s parity fixture pads/repeats an allowed DEV crop and is not 300 s of newly captured microphone audio. [evidence](../target/cancel-repair-builder/browser-playwright-chromium-cancel-1793480033509.json), [evidence](../target/cancel-repair-builder/browser-playwright-firefox-cancel-1793480033509.json), [evidence](../target/cancel-repair-builder/large-parity.json).

Peak diagnostic WASM linear memory **53,542,912 B** is below **128 MiB**; successful worker replies also enforce that cap. Owned JS status peak on full 300 s runs is **87,514,112 B**, below **96 MiB**. Status while awaiting analysis can still contain initialization WASM size, so it is not a full-analysis high-water meter. Process RSS, browser-native/JSPI stack allocations and aggregate old-worker/immediate-retry overlap are **not certified** by these counters. Retry tests wait through the late-result observation before fresh restore; do not infer a zero-delay overlap pass. Independent acceptance must close this memory proof.

**Actual processing stop, not promise rejection.** `/proc` uses CLK_TCK=100; every census records start/end, and pre-cancel CPU proof uses censuses completed before the handler. Disappearance is conservatively bounded by the end of the completed census. Raw samples observe beyond the former two-second tail. Direct launches have no debugger/CDP; Playwright commands/feature state are retained. A `started` marker or fast API rejection never earns a pass.

| Product path | Completed pre-handler CPU growth, ticks | Disappearance bound, ms | Stop gate | Raw evidence |
|---|---:|---:|---|---|
| Chromium direct, AbortSignal | 23 | 82 | PASS | [evidence](../target/cancel-repair-builder/browser-direct-chromium-cancel-1793480400742.json) |
| Chromium Playwright, AbortSignal | 28 | 84 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-cancel-1793480033509.json) |
| Explicit engine-upgrade cancelRefinement | 23 | 77 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-upgrade-explicit-1793480033509.json) |
| Total refine deadline, fixture 700 ms | 54 | 116 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-deadline-1793480033509.json) |
| Live watchdog, fixture 250 ms | 17,17 | 88 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-watchdog-1793480033509.json) |
| Live parent dispose | 52,68 | 95 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-dispose-1793480033509.json) |
| Abort during restore decode | 34 | 153 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-restoreabort-1793480033509.json) |
| Firefox direct forced synchronous | 18 | 116 | PASS | [evidence](../target/cancel-repair-builder/browser-direct-firefox-cancel-sync-1793480033509.json) |
| Firefox Playwright JSPI | 19 | 124 | PASS | [evidence](../target/cancel-repair-builder/browser-playwright-firefox-cancel-1793480033509.json) |
| Chromium forced synchronous — FAIL | 23 | 2065 | FAIL | [evidence](../target/cancel-repair-builder/browser-playwright-chromium-cancel-sync-1793480033509.json) |

The watchdog intentionally retains the ingestion owner for PCM export. Its one disappeared busy thread is DSP; the remaining busy ingestion thread is CPU-stable after 250 ms. The source-specific `retainedOwnerIdle`/`dspStopCandidates` fields distinguish this from incorrectly requiring all workers to die. Parent dispose stops both busy owners. No late refined/timeline adoption was observed; injected queued old reply/refined-event tests cover the facade fence. PCM/snapshot hashes, generation rejection and successful fresh-generation retry are asserted. [evidence](../target/cancel-repair-builder/final-browser-index.json).

**Cleanup and release conditions.** Five final mixed start/Stop/refine/discard cycles include historical-metadata cancellation plus fresh-generation retry. Before/after worker censuses, closed AudioContexts and terminated owned workers pass; the direct DSP/cancel cases separately prove busy-work stop. Physical microphone tracks and a direct MessagePort allocation census were not measured; the reusable channel has one bounded pending task and closes with its worker. [evidence](../target/cancel-repair-builder/cycles-mixed.json). The closeout confirms no live owned process and unchanged active/frozen bytes. [evidence](../target/cancel-repair-builder/closeout.json).

Outstanding, with no waived gate:

**Container adoption blocker confirmed:** active `Dockerfile` lines 16 and 31 copy only the old build/verify/bootstrap scripts. Both stages omit `scripts/wasm-jspi-adapter.mjs`, which the new build script imports and the verifier source-hashes. Root must include that helper in both container COPY lists before adoption/container validation. No container build pass is claimed. The active Dockerfile is outside builder write ownership and remains unchanged; the immutable freeze is unchanged. The frozen verifier also hashes `src/audio/live/**` and `src/audio/analysisV1.ts`, which the Docker WASM builder does not copy. In the Node stage, `.dockerignore` excludes `*.test.ts`/`*.test.tsx` while the canonical inventory includes live tests, so a full-checkout manifest will mismatch. Root must reconcile both runtime COPY coverage and test-inventory/container-exclusion policy, then regenerate normally. Adding only the adapter COPY is insufficient; no source/manifest waiver is acceptable.

1. Forced non-JSPI Chromium still consumes DSP CPU until approximately **2,065 ms** after abort. Its functional/API cancellation succeeds but its processing-stop gate **fails**. Compatibility/release scope belongs to root's separate track.
2. WebKit2359 cannot load `libgstcodecparsers-1.0.so.0`; Safari/WebKit product behavior is unverified. No global library/browser install or support-policy change was made.
3. Independent tester must complete early-boot/near-completion/around-yield phase sweeps, immediate-retry aggregate memory, restore abort during Blob/hash work, complete resource/process accounting and any additional supported browser versions. The focused results here are not a substitute for that acceptance list.
4. Normal regeneration check is successful, but a separate **fresh Cargo-target rebuild from the immutable freeze** is deferred to the independent tester after CPU release. The builder's native and WASM builds used isolated targets; the final normal check may reuse their Cargo outputs. No fresh-rebuild gate is claimed or waived.

Earlier failures remain documented: every-check Firefox throughput; initial 90/150 s harness cutoffs; first direct no-load attempt; a duplicate test-fixture local variable and exact test-transform shape drift after Vite's TS/number-literal conversion; and the overly strict initial watchdog summary that conflated the retained ingestion owner with DSP. The final transforms are guarded/test-only and source/runtime artifacts are frozen. One initial overly broad workspace command also hit five unrelated backend `TOOL_UNAVAILABLE` media-tool failures; its log is retained and the appropriate two-crate checks pass. [evidence](../target/cancel-repair-builder/test-initial.log), [evidence](../target/cancel-repair-builder/initial-every-check/cost.json), [evidence](../target/cancel-repair-builder/browser-final-run.log), [evidence](../target/cancel-repair-builder/direct-coalesced-run.log). None is silently counted as a pass.

**Commands and isolated reuse.** Executed from repository root, using `.tools/node-v24.22.2-linux-x64/bin/node` (abbreviated `$NODE` below). `build.sh` sets matching Node PATH, direct cargo/rustc/rustdoc 1.89.0, locked/offline dependencies, target-only 128 MiB/path-remap flags and the owned target directory. It never writes active generated assets.

```sh
python3 target/cancel-repair-builder/checks.py
$NODE node_modules/typescript/bin/tsc -p target/cancel-repair-builder/source/tsconfig.app.json --incremental false --pretty false
$NODE node_modules/vitest/vitest.mjs run --root target/cancel-repair-builder/source --config vitest.config.ts --configLoader native
$NODE target/cancel-repair-builder/lint.mjs
# Exact native and wasm32 Clippy argv/environment are recorded in tooling-commands.json.
# Full pinned Rust command/environment is also recorded in checks.py/checks.json.
target/cancel-repair-builder/build.sh --stage
# --publish used the exact verified staged path printed by that command.
target/cancel-repair-builder/build.sh --publish <verified-owned-stage>
target/cancel-repair-builder/build.sh --check
$NODE target/cancel-repair-builder/abi.mjs
$NODE target/cancel-repair-builder/boundary-parity.mjs
$NODE target/cancel-repair-builder/large-parity.mjs
$NODE target/cancel-repair-builder/browser.mjs playwright:chromium:intervals
$NODE target/cancel-repair-builder/browser.mjs direct:chromium:cancel
$NODE target/cancel-repair-builder/browser.mjs playwright:chromium:cancel playwright:chromium:upgrade:explicit playwright:chromium:deadline playwright:chromium:watchdog playwright:chromium:dispose playwright:chromium:restoreabort direct:firefox:cancel:sync playwright:firefox:cancel playwright:firefox:workercost playwright:chromium:cancel:sync
$NODE target/cancel-repair-builder/cycles.mjs --mixed
$NODE target/cancel-repair-builder/steady.mjs
$NODE target/cancel-repair-builder/cost.mjs
```

Do not overwrite builder evidence. For independent browser reuse, copy immutable `frozen/source` into the tester's owned directory and run the read-only builder harness with `FRETBLOOM_CANCEL_OUT=/absolute/new-output` and `FRETBLOOM_CANCEL_SOURCE=/absolute/copied-source`. Output directory must already exist. It uses ephemeral loopback ports and owned caches/profiles. Direct browser temporary sockets use a short directory-fd alias pointing **inside the owned temporary directory**, avoiding Linux Unix-socket pathname limits without outside source writes. `finally` closes browsers/servers and records owned process exit.

For clean WASM regeneration in the tester's copy, set pinned Node PATH, `RUSTC`, `RUSTDOC`, `FRETBLOOM_CARGO` to the direct 1.89.0 binaries and `CARGO_TARGET_DIR` to a new owned absolute build directory, then run `$NODE /absolute/copied-source/scripts/wasm-build.mjs --check`. The `.tools` dependency must resolve to existing pinned bindgen. Frozen tests opt in with `FRETBLOOM_COST_PCM_DIR=/absolute/declared-fixture-dir cargo test --release --locked --offline -p fretbloom-analysis paired_internal_bits_frozen -- --ignored`. Do not edit a manifest to make association checks pass.

Compatibility owner subsequently declared its own performance-clear and reported an isolated Asyncify feasibility result. That is separate evidence under its ownership, not a builder-verified or adopted compatibility solution. Builder heavy work remains ended; root coordinates independent acceptance.
