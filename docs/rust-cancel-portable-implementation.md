# Portable cancellation integration — preparation handoff, BLOCKED

2026-10-31. Implementation owner: Sol 6.1 xhigh, no subagents. Writes are only
`target/cancel-portable-builder/**` and this report. Active product, previous
freezes/evidence, browser-owner files and original holdout remain read-only.
No production, database, default preview, sibling checkout, global install,
commit, push or deployment was used.

**This is an immutable source-preparation handoff, not a completed integration
candidate or adoption request.** The JSPI tester's exclusive heavy/timing window
remains in force; no release arrived. No Rust compilation, WASM assembly,
container build, browser launch, DSP call, cost test or product acceptance gate
ran. Root should create a new follow-up delegate after explicit timing release.

## Coordination and possible contention

The requested coordination send returned `thread_not_found` with the decoded
ID; retrying the literal supplied encoded ID returned the same error. No message
was delivered. No third send, delegate polling, sleep or watcher was used.
`preparation/coordination.json` records the two failed attempts and no clearance.

A **source-only** scan of the retained 24,387,997-byte feasibility WAT ran longer
than expected. Its first implementation assembled insertions by repeatedly
slicing the entire string. The owned process (PID308380) was explicitly stopped
with SIGTERM; session exit143 was observed. It produced no completed access
inventory or guarded artifact. The helper now assembles chunks with one join;
the full-module rerun is deferred until release. CPU time was not captured.
The conservative possible-overlap interval is recorded in `coordination.json`
from script creation through the later closeout check; it includes subsequent
source edits and **is not a measured CPU duration**. Root/tester must consider
this potential contention when interpreting overlapping timing evidence. Tiny
source unit/syntax checks and file hashing also occurred during preparation.

Disassembling the immutable feasibility artifact with pinned `wasm-dis` took
0.24s, producing owned preparation WAT only. No detector execution occurred.
This WAT is old feasibility input, not a newly compiled product fallback.

## Reviewable source and interface layout

`source/` is an ordinary disposable copy, never a git checkout/worktree.
`prepare.py` verifies every entry of the immutable JSPI inventory before copying.
Frozen sources take precedence; missing packaging/config/server/public closure
comes from read-only active paths with provenance in `assembly.json`. Root's
`target/cancel-repair-packaging/container.patch` (SHA
`c08e634e5ff3509abe4b958fc72a44e50bda716be5dc31d49c9f2e009171ed75`)
is applied in this copy, then extended for the new helpers/license. TypeScript
build-info output is moved inside the owned target, avoiding shared
`node_modules/.tmp` writes. Dependency/tool symlinks are read-only inputs;
`.tools` itself is an owned directory rather than a writable link to root tools.

The intended generated layout is one atomic staged set:

```text
src/generated/analysis-wasm/
  fretbloom_wasm.{js,d.ts}             # unchanged primary ABI/JSPI adapter
  fretbloom_wasm_bg.wasm{,.d.ts}
  manifest.json                      # normal source/tool/artifact association
  portable/
    fretbloom_wasm.{js,d.ts}           # guarded numeric backend API
    fretbloom_wasm_bg.wasm{,.d.ts}      # bounded Asyncify; NOT GENERATED YET
    asyncify-runtime.js
    generation.json                  # metadata/guard/adapter identities
```

The portable public API is `initialize(input): Promise<void>`,
`analyze(pcm, rate, options): Promise<string>`, `info(): string`,
`memoryBytes(): number`, `savedStackBytes(): number`, and `close(): void`.
Raw exports, numeric heap, allocators, synchronous analysis and initSync stay
private. The standalone generated-JS source exercise is under
`preparation/adapter-source/`; it has **no WASM** and is not a generated release
set. Re-entry checks precede input allocation, initialization, and info/memory
calls. Worker code caches validated engine identity before busy work.

`src/audio/live/analysis.worker.ts` selects primary JSPI only when **both** native
APIs exist; otherwise it initializes portable. Both paths use the same worker
initializing/ready/busy/failed guard and existing key/generation handling. There
is no user-agent sniffing, global API replacement or synchronous browser branch.
Task suspension returns numeric0 via one reusable MessageChannel. The portable
raw call ignores every partial unwind tuple, retaining generated input/string/
error/free ownership through completion. Trap or rejected transport marks the
runtime failed and prevents allocator re-entry. Closing while suspended avoids
freeing a live stack; failed instances belong to worker disposal.

No ingestion/facade/protocol/recognition Rust source was changed from the JSPI
freeze. Thus retained PCM, atomic replacement, total deadlines, late-result
fences and once-per-generation refinement code remain the frozen implementation;
their behavior on the new backend is **not yet validated**. `memoryBytes()` counts
the actual complete linear memory including saved stack/header. The separate
1MiB+8 saved-stack allocation is exposed for accounting and must not be added a
second time. This supplies no claim about JS/native/browser memory or overlapping
old/new workers.

## Stack safety remains the adoption blocker

Binaryen125's `makeCallIndexPush` writes before checking its end, local saving
writes all locals before incrementing the position, and terminal assertions run
after those writes. Neither a larger allocation nor observed2832B establishes
safety for all bounded inputs and indirect callbacks.

The prepared `scripts/wasm-asyncify-bounds.mjs` parses pinned Binaryen WAT
structurally. It identifies state/data globals from actual control exports,
classifies saved-stack cursor locals and every metadata use, rejects local
aliases/reassignment/unknown uses, and wraps every call-index/local load/store
address with a private WASM check. It inserts checks without removing or
rewriting original instructions. Each check tests unsigned address>=begin,
address<=end, and offset+width<=end-address **before** the original load/store.
This also checks rewind underflow. Bounds are configured once by the private
host after allocating the saved stack. Cursor/header updates remain within the
owned header; wrapping/invalid cursor values trap at the first guarded access.
Only the existing single unshared wasm32 memory is allowed. No new memory,
shared-memory headers or call-graph/indirect-call omission is used.

This is a **proposed implementation**, not an audited proof. Full-module cursor
classification has not completed. Neither WASM validity nor safe tiny-stack
unwind/rewind traps with unchanged adjacent live bytes has been executed. The
small parser fixture is not that evidence. The copied low-level numeric WASM
declaration also still describes the bindgen input; a complete generated set
must declare the added Asyncify/control exports from the assembled module
while retaining private ownership at the public API boundary. Exact guard counts deliberately
remain `null` in `wasm-portable-build.mjs`; normal `wasm-build.mjs` rejects that
state **before Rust compilation**. Do not populate the counts just to unblock a
build. First establish exhaustive generated access coverage, inspect the bounds
helper and wrap arithmetic, then execute overflow/underflow controls and discard
trapped instances. Do not rely on canaries alone; they supplement the pre-access
proof. If this route cannot be proven, retain the blocker.

## Build and packaging preparation

The primary and numeric pipelines consume the **same verified raw Rust file**.
`wasm-portable-metadata.mjs` validates u32 lengths/names/feature prefixes,
removes exactly one enabled `reference-types` feature, requires enabled
`multivalue`, and compares every non-custom section's complete bytes/hash.
Real frozen input reconstructs the existing numeric input exactly. No detector
instruction is patched by metadata adaptation.

The prepared portable builder pins raw, numeric, numeric-bindgen and unguarded
Asyncify identities, runs official Binaryen125 with conservative indirect-call
instrumentation/asserts, then requires the exact structural guard inventory
before assembly. The existing pinned JSPI adapter is unchanged. The portable
adapter checks all three numeric glue/declaration SHA-256 values and exact
replacement counts, preserving the five-number/four-number ABI and numeric JS
handle extraction/free list.

`wasm-bootstrap.mjs` adds a local Binaryen125 bootstrap using the existing official
archive/checksum pin and Apache2 license. Installed tools must match exact
wasm-opt/as/dis identities; existing mismatched tools are not overwritten.
No bootstrap was executed here. `wasm-build.mjs` stages/publishes/checks both
sets together; `wasm-verify.mjs` inventories all six portable files plus every
helper/license/pin under the ordinary canonical identity. No manifest was edited
and no verification bypass was added. Existing copied primary manifests are
**stale references** after source changes, as the normal verifier should report.
Normal dual generation, publish, verification and fresh-check are still unrun.

The copied Dockerfile includes all new helpers/license/pin in relevant build
stages, plus root's runtime/test source-closure fixes. No test/corpus/tool copies
were added to the final runtime stage. Actual Docker ignore/COPY behavior,
reproducibility and runtime-image inventory remain untested. No host/default
`dist` was written.

## Evidence and honest check status

- PASS: every JSPI frozen inventory entry verified before copying; raw/numeric/
  native reference identities retained. Full before/after freeze verification
  is in `frozen/identity.json`.
- PASS: four focused source tests, `preparation/unit-tests-final.log`. The actual
  frozen raw module reconstructs byte-identical numeric input; truncated/overflow/
  already-stripped metadata fails; a small structural stack fixture inventories
  all four access classes and refuses aliases/unknown uses.
- PASS: guarded numeric JS/declaration source adaptation, exact public exports,
  `preparation/adapter-source-final.log`; actual glue shape/hashes accepted.
  Initial attempt used the wrong relative input URL and failed ENOENT, retained
  in `adapter-source.log`; that failure is not runtime evidence.
- PASS: twelve pinned Node syntax checks, `preparation/syntax-and-gate.json`.
- EXPECTED BLOCKER: normal build `--check` exits nonzero with the explicit
  unvalidated-stack-guard message before invoking Rust. This is fail-closed
  source preparation, **not** a successful normal build/check.
- STOPPED/NO RESULT: full old-feasibility WAT guard scan, exit143.
- NOT RUN: actual bounded WASM generation/instantiation, tiny-stack controls,
  actual output+feature parity, repeated success/errors/heap handles, trap/yield/
  init/re-entry lifecycle, product fallback Stop/refine/cancel/PCM retry/upgrade/
  deadline/watchdog/five cycles/valid300s, both-branch intervals/cost/event delay,
  accounted JS+WASM+overlap memory, full lint/types/Rust tests/fmt/clippy, Vite and
  Docker build, fresh rebuild identity, independent acceptance. Gates remain
  <=250ms true processing stop, <=500ms window p95, <=1.5s event-delay p95,
  <=120s valid300s refinement, <=96MiB accounted JS, <=128MiB WASM including stack.

The portable frozen-fixture/default-test split from the JSPI freeze is unchanged.
No all-music suite or original holdout was rerun. The native executable is only an
inventory-verified reference copy, not a fresh build; a future native rebuild
must remain SHA `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`.
Engine stays rust-dsp-3.1, internal bridge2, saved schema1.

## Browser handoff and next assigned work

Read `docs/rust-cancel-browser-matrix.md`. Its prepared Chrome136.0.7103.113 and
private WebKit2359 launcher can be reused **read-only after clearance**. Delivery
inventory hash is
`5307c5f83224c7be6064d79020b9ab05fb135792999df42ec7d0426ca4fcb53b`.
Neither browser's launch/feature state has been measured. The environment-owner
harness targets old feasibility WASM, not this product candidate. WebKit exposing
both JSPI APIs would be a branch-coverage finding; do not delete globals or call
that a product failure.

Root should next assign a delegate with the actual explicit timing release and:

1. Finish full-module guard analysis; fix/review any refused shapes without
   weakening coverage. Establish exact counts plus pre-access safety controls.
2. Build both artifacts through normal stage/publish/check inside this owned
   context. Complete raw/native identity and same-module association; freeze a
   new **complete** candidate independently of this preparation snapshot.
3. Run focused lifecycle/parity/build checks and the unchanged product acceptance
   protocol serially, including natural no-JSPI browser branches using the new
   product assets. Use real CPU disappearance evidence, preserve all failures,
   and establish worker-memory overlap with actual evidence.
4. Perform independent root acceptance; root alone owns active adoption.

Executed command entry points (repository root):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 target/cancel-portable-builder/prepare.py
# one-shot source preparation; already executed, do not overwrite source
.tools/node-v24.22.2-linux-x64/bin/node --test target/cancel-portable-builder/tests/preparation.test.mjs
.tools/node-v24.22.2-linux-x64/bin/node target/cancel-portable-builder/preparation/adapter-source.mjs
PYTHONDONTWRITEBYTECODE=1 python3 target/cancel-portable-builder/check-preparation.py
PYTHONDONTWRITEBYTECODE=1 python3 target/cancel-portable-builder/freeze-preparation.py
```

`preparation/check-source.mjs` is the deferred full WAT scan; do not run it during
the tester's exclusive window. Direct Rust1.89 tools should be selected via
`FRETBLOOM_CARGO`/`RUSTC`/`RUSTDOC` and an owned `CARGO_TARGET_DIR` for future builds;
do not rely on rustup proxies under the app environment. No future command here
implies timing clearance.

## Immutable files and cleanup

`frozen/source/` is the exact proposed source snapshot; `frozen/from-active.patch`
and `frozen/from-jspi.patch` are ordinary text patches. The latter uses read-only
active closure files where the JSPI freeze lacks packaging inputs; provenance is
recorded. Existing generated files are explicitly inventoried as **JSPI reference
only/stale association**; there is no portable generated WASM to adopt.
`frozen/analyze-pcm` is the unchanged native reference. Exact paths/hashes are in
`frozen/inventory.json`, `frozen/identity.json`, and `delivery-inventory.json`;
the final handoff gives their own hashes. Source files in `frozen/` are read-only;
symlink targets were not chmodded or mutated. Continue in a new owned copy rather
than editing this snapshot.

No owned browser/server/container/port was started. The one owned long-running
source scan was stopped; all other preparation processes completed. Cleanup is
recorded in `preparation/cleanup.json`. This owner is performance-clear and
releases source ownership; it does **not** release the independent tester's
exclusive window. Retain owned files for follow-up review/reproduction; no other
owner's file needs cleanup. No acceptance threshold has been relaxed.
