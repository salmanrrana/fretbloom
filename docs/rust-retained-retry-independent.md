# Independent retained-retry acceptance: FAIL

**Do not accept this candidate yet.** The mounted Listen UI misclassifies cancellation during restore as an admitted retained-refinement cancellation. Normal busy cancellation/retry and persistence passed. No candidate repair, adoption, production access, installation, commit, push, or delegation occurred. All writes are confined to the granted independent paths.

## Actionable finding — P2

At [LiveListen.tsx:489](../target/retained-retry-completion/source/src/components/LiveListen.tsx#L489), `retainedRetry.current = controller.signal.aborted && !reanalyze` also runs when an ordinary refinement action is canceled during its **restore**, before lines 474–477 admit refinement. Aborting restore terminates that facade's worker ([runtime.ts:264](../target/retained-retry-completion/source/src/audio/live/runtime.ts#L264)). The next click takes the retained-retry branch at lines 435–436/475–476 against that unavailable facade.

**Actual mounted red reproduction:** open the seeded saved session through Listen; complete one real refinement; click Refine again (the ordinary restore branch); withhold its actual successful restore MessageEvent; click Cancel refinement; click Refine. Expected: a usable refinement/recovery path. Actual: **“Refinement failed. Previous results are kept.” / “Listening runtime is unavailable.”** No refinement RPC was admitted in the replacement runtime. Old visible results and IndexedDB metadata stayed intact. This is a failed next action, not evidence of permanently lost audio or a memory breach.

[Raw failing result](../target/retained-retry-independent/mounted-early/result.json), [real transport sequence](../target/retained-retry-independent/mounted-early/transport.json), [before-admission cancellation](../target/retained-retry-independent/mounted-early/03-canceled-before-refine-admission.json), [failed retry screenshot](../target/retained-retry-independent/mounted-early/04-retry-after-early-cancel.png). This case uses the **normal, uninstrumented production build**, actual mounted React, IndexedDB, real workers and actual Rust/WASM. Only a genuine transport reply is withheld; no detector result or acknowledgement is manufactured. The harness later attempts delivery through the live callback, which cancellation cleared. That attempt is **not** proof of replay through a retained old callback.

Repair direction for root: distinguish cancellation before refinement admission from cancellation of an admitted attempt; select retained retry only when that same runtime actually has a canceled refinement. Keep the conservative release gate. Add a mounted or caller-state test covering this branch; the existing caller-body test presets `retainedRetry=true` and cannot catch it. Candidate left unchanged. Further heavy controls stopped after this defect, as requested.

## What independently passed

* **35 tests across the intended six current-candidate files**, strict TypeScript as part of the normal `npm run build`, normal WASM source/artifact verification, normal Vite production build, and lint on **145 actually selected files**, including every changed TS/TSX file. Zero lint errors; 13 warnings. [Tests](../target/retained-retry-independent/focused-exact.log), [build](../target/retained-retry-independent/build-corrected.log), [lint](../target/retained-retry-independent/lint.log), [selected files](../target/retained-retry-independent/lint-files.log).
* **One actual mounted 300-second busy cancel → immediate UI retry → Save → reload → Open/verified restore → playback journey passed.** Fixture seeding avoids wall capture; saved metadata is honestly partial with no detector results. Both analysis attempts execute real DSP. Prior visible/saved metadata remains until valid replacement; one UI result adoption; Save replaces the same session ID; restored PCM SHA is unchanged. Playback advanced beyond 0.1 seconds, duration 300, readyState 4, no media error. [Result](../target/retained-retry-independent/mounted-busy/result.json), [pending snapshot](../target/retained-retry-independent/mounted-busy/02-immediate-retry.json), [unsaved result](../target/retained-retry-independent/mounted-busy/03-refined-unsaved.json), [saved](../target/retained-retry-independent/mounted-busy/04-saved.json), [restored](../target/retained-retry-independent/mounted-busy/05-restored.json), [playback](../target/retained-retry-independent/mounted-busy/06-playback.json).
* **Actual CPU-stop passed independently of the ack.** Birth/source/readiness and raw DSP-entry marks identify `PID/TID/startTicks=922446/922508/2868290`; it accrued eight 10 ms CPU ticks before cancellation. Complete OS censuses show absence by **68.700 ms**, no reappearance or post-250 ms sighting through **13,594.700 ms**. Maximum census duration 3 ms. Absence precedes the next full copy by 30.900 ms. [CPU join](../target/retained-retry-independent/mounted-busy/cpu.json), [raw censuses](../target/retained-retry-independent/mounted-busy/series.json), [marks](../target/retained-retry-independent/mounted-busy/marks.json).
* **Named stopped-retry audio interval passed its scoped bound.** Two full copies, same 440 canonical chunk backings totaling 28,800,000 bytes, distinct sender buffers, actual detachment and exact child/key/request/equal-watermark joins. One initial restore Blob read, zero retry restore reads; the later reload adds its own read. Genuine complete-helper release reaches ingestion 59.100 ms after cancel, **40.500 ms before** the retry full copy. UI retry begins 1.300 ms after Cancel. Canonical + retained Blob + one reserved input + ring + fixed transport reserve = **87,514,112 bytes**; with 2 MiB metadata reserve = **89,611,264 < 100,663,296 (96 MiB)**. Conservatively retaining both WASM high waters gives **32,440,320 + 40,435,712 = 72,876,032 < 134,217,728 (128 MiB)**. [Independent assertions and calculations](../target/retained-retry-independent/analysis.json), [analysis script](../validation/retained-retry-independent/analyze.py).

Source inspection confirms synchronous payload dispatch, a sole async helper, and a named completion reaction that captures no request/event/PCM. The returned completion contains metadata/results only; generated `analyze`/Asyncify frames return before release. Ingestion keeps a detached sender object across its await. Release requires the registered child object, engine key, request and equal watermark; normal completion also requires a staged result. Repeated cancellation cannot renew the first deadline. Ambiguous transfer/trap/close/init/transport outcomes fail closed. The root dispatch guard precedes route replacement, and identity-checked finally cannot clear the successor route.

The independently executed focused tests exercise malformed/stale/replayed releases, canceled old result refusal during a later request, duplicate ordinary/retained admission, deadline non-renewal, uncertain transfer, helper drainage, and dispatcher handoff. These are **synthetic transport/backend controls**, not CPU or native lifetime measurements. Canceling a retry while queued is covered there. A new **genuine withheld-release queued-cancel** browser replay and a separate mounted repeated-click control were not run after the concrete defect; those remain incomplete. No blanket acceptance is inferred from unit tests.

## Inputs and reproducibility

All 220 candidate entries rehashed unchanged before/after; the private source copy also matches all 220 at closeout. Independently rehashed the immutable base's 220 entries, verified the exact twelve changed files, protected parent evidence hashes, and byte equality of numerical artifacts/glue/generation data. [Before](../target/retained-retry-independent/inputs-before.json), [after](../target/retained-retry-independent/inputs-after.json), [independent base/diff/lint audit](../target/retained-retry-independent/independent-input-audit.json), [artifact hashes](../target/retained-retry-independent/artifact-hashes.json).

| Input | SHA-256 |
| --- | --- |
| Candidate inventory | `e9353ff1a188333485b5d7d740ddcd7ba2ef9cfa6f52d48fcc639b0f305f892c` |
| Candidate patch | `b4496fb83586f52b8e11b3623396bef8beac5ee1df5cf12736a466049fc0776b` |
| Source association | `97dc9733a444e6fc8c398f9ecd4414cb0e405359bc2a78a3deef604b6f518fd1` |
| Portable WASM | `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e` |
| Reference WASM | `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1` |
| Fixture PCM, 7,200,000 samples | `aacd33386dd292c074ba01075db0935c108a0e7dc92c5548f4b5c1cd02c047fa` |
| Fixture metadata | `f3c2f88bd21690b15e1b4810b986b8562998d2d6d37b53c3b4fd92e39f4ac2fc` |
| Original DEV seed | `5aefdbcce2ffec9913466f98dd171c5c209d2245e0d3a99cf7a0974034a6ee88` |
| Pinned Node 24.22.2 | `904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52` |
| Chromium 143.0.7499.4 | `2e61bc3fd990bd4d7b419ef6b6303c67aaed683e5b83b3b25e416f015f343209` |

[Command ledger](../target/retained-retry-independent/commands.jsonl) includes actual argv, cwd, isolated environment, UTC start/end, PID and exit status. From `/home/xtra/code/personal_projects/fretbloom-song-audit`, the executed core commands were:

```sh
python3 validation/retained-retry-independent/run.py focused-exact node node_modules/vitest/vitest.mjs run --config ../vitest.config.ts
python3 validation/retained-retry-independent/run.py build-corrected npm run build -- --outDir /home/xtra/code/personal_projects/fretbloom-song-audit/target/retained-retry-independent/dist-normal
python3 validation/retained-retry-independent/run.py lint npm run lint
python3 validation/retained-retry-independent/run.py build-observed-corrected node ../build-observed.mjs
python3 validation/retained-retry-independent/run.py mounted-busy node ../mounted.mjs busy
python3 validation/retained-retry-independent/run.py mounted-early node ../mounted.mjs early
python3 validation/retained-retry-independent/analyze.py
```

The runner always puts pinned Node first on PATH and uses private dependency/cache/temp roots. Output files intentionally refuse overwrite. For a fresh red replay without overwriting evidence, use the same mounted harness with its directory-label-only replay variant:

```sh
python3 validation/retained-retry-independent/run.py repro-early node ../mounted-replay.mjs early repro-early
```

That replay command is supplied for root's next granted window, **not executed again here**. [Original executed harness](../validation/retained-retry-independent/mounted.mjs), [replay variant](../validation/retained-retry-independent/mounted-replay.mjs), [observer implementation](../validation/retained-retry-independent/build-observed.mjs), [exact transform plan](../target/retained-retry-independent/harness-observer-plan.json), [transforms](../target/retained-retry-independent/harness-transforms.json). Observers add metadata-only marks and no awaits, audio retention, DSP delays, Rust changes or forged replies. The busy UI uses a static production build with these observers; the early failure uses the normal static production build. No dev/preview server or shared browser was used.

Preserved unsuccessful attempts: [24-test incomplete selection](../target/retained-retry-independent/focused.log) (the source's existing Vitest config selected only two requested files), [copied .bin launcher build failure](../target/retained-retry-independent/build.log) (fixed only private launchers), [ambiguous observer-anchor setup failure](../target/retained-retry-independent/build-observed.log) and its [original script](../validation/retained-retry-independent/build-observed-attempt1.mjs). None is counted as a product pass; the mounted early-cancel failure remains red.

## Limits and release

This review does not certify native RSS/GC, allocator capacity, whole-app memory, arbitrary caller roots, or memory during initial restore, IndexedDB verification/Save, WAV generation or playback. Their mounted functionality passed; their memory intervals inherit no pass. One old analysis send-side metadata fetch was lost during child termination; the genuine helper-return and exact ingestion release receipt are present. Main-thread transport rows before reload were reset by reload; worker identity/copy/restore marks and mounted snapshots provide the busy provenance. No frozen numerical/stack campaign was repeated; normal Rust regeneration was audited, not rerun.

The prior **Node portable sideband p95 557.22 ms and WPE 557.8 ms > 500 ms failures remain**. Musical recognition failures (vibrato/shared partials/C6/madd11/exact voicings and three full-input event caps) remain. No new accuracy, holdout, speed, model/provider or general adoption claim.

Heavy execution released **2026-11-01T00:28:11.625013+00:00 UTC**. [Release proof](../target/retained-retry-independent/heavy-release.json): zero owned processes, zero live recorded PIDs, zero profiles, ports **40615/42391** refuse connections; both complete browser task censuses are empty. Only analysis/hash/report writes followed release. No user QA requested.
