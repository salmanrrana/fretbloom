# W runtime and WASM handoff

Implementation evidence, 2026-10-31. This document covers only W's owned runtime,
wrapper and packaging. Root owns acceptance, musical evaluation and final freeze.
No commit, deployment, production access, secrets or other checkout was used.

## Interfaces and implementation

The frozen `protocol.ts`/`runtime.ts` interface is implemented, including optional
channel selection, ingestion-originated boundary acknowledgments, optional live
note IDs/missed intervals/resource counters, and explicit engine-change restore.
`validation.ts` shares strict local metadata parsing with UI storage. Existing
analysisV1 validators remain authoritative for actual native result/features.
Old engine results stay readable; opt-in restore verifies PCM and preserves the
old snapshot until a complete successful reanalysis atomically replaces it.

The wrapper calls the actual core without DSP changes. Core manifest alone makes
CLI dependencies optional under default `cli`; the WASM target dependency tree
excludes clap/ctrlc. Native default commands retain their feature behavior.

Ingestion owns canonical chunked recording and a fixed 10.24-second ring. It uses
a 64-tap Blackman-windowed sinc with double-precision source phase/accumulation,
32-sample future context and per-phase normalization. Start/end padding alone
produces floor(sourceFrames*24000/sourceRate) samples. Initial stereo decision
is buffered and then retained consistently throughout the session. Explicit
left/right is already mono from the worklet and is not selected twice.

One synchronous Rust worker runs one call; ingestion keeps one replaceable latest
pending descriptor. Calls start at 1.28 seconds, hop 0.64 seconds and retain a
2.56-second window, with 0.32-second future and 0.64-second warm-up context.
Mutable 20 ms evidence cells coalesce into intervals. Settled prefixes persist,
notes extend stable IDs only across supported contiguous seams in the same stream,
and harmony compares kind, identity, alternatives and bass. Missed intervals stay
explicit; gaps never synthesize silence or connect notes across segments.

Stop awaits the ingestion boundary barrier, with a one-second partial fallback.
Shorter-than-0.64-second fragments abstain. Refinement analyzes full eligible
segments independently, with no gap padding, then validates/commits all results
atomically. Cancellation/deadlines terminate the synchronous engine worker;
retained canonical PCM remains exportable. There are no fake progress callbacks.

Input sequence/source clocks, safe integers, finite PCM, exact byte lengths,
session/generation/request/revision associations and unknown messages are checked.
Limits cover five minutes PCM, thirty minutes wall, 64 segments, note/harmony/
metadata caps, 128 MiB WASM linear memory, and 96 MiB accounted application buffers.
Facade PCM exports cache one verified Blob; restore reuses the verified original
Blob. Expensive worker operations serialize. UI-owned WAV/playback allocations
must be released before refinement/new expensive export and counted by UI.
Counters cover runtime recording/ring/in-flight PCM, resampler/decision/credit
buffers, export/restore scratch and the cached facade Blob; browser-native audio,
iframe, Blob implementation copies and whole-process memory are not hard-capped.

## Build and tool contract

Pinned Rust1.89.0/wasm32-unknown-unknown, wasm-bindgen crate/CLI0.2.100 and
Node24.22.2. Bootstrap installs CLI in `.tools/wasm-bindgen-0.2.100`, not globally.
Normal dev/build verifies tracked artifacts with Node crypto and needs no Rust.
Build hashes canonical sorted source inputs, tool versions and flags; checks source
identity before/after compilation; obtains engine version from the instantiated
actual output; and atomically replaces a successfully generated set. `--stage`
keeps validated outputs separate; `--publish` re-verifies staged association.
`--check` rebuilds in a disposable directory and compares artifact hashes.
`RUSTFLAGS`/`CARGO_ENCODED_RUSTFLAGS` overrides are rejected rather than silently
invalidating the recorded target-only memory flag.

Vite literal module-worker URLs and explicit generated `.wasm?url` imports emit
versioned assets. Node static MIME adds only `application/wasm`. No COOP/COEP.
Netlify pins Node24.22.2. Docker retains the native builder and non-root supervised
runtime and adds a pinned source-rebuild/byte-verification WASM stage plus all
source-hash inputs in the npm build stage. Existing supervisor behavior is retained.

## Development evidence (not final acceptance)

First measured development artifact:

- Engine actual export: `rust-dsp-2`, bridge/schema1, 24 kHz, max7,200,000 samples.
- Source hash `27bd0ebf37649a3fa60051971e7111a88b5e4ac9ce79905c3bb451a77989492e`.
- WASM SHA256 `198ab7fa22199b2565d3da182d4e90a7c9233cae2b42246dba0accdfd4279327`.
- Artifact556,621 bytes; Cargo.lock SHA256
  `4cf9ea7903f854b54c1eb312c6f0ad828b2a3234015da44afb619c2687bae953`.

Hardware: Intel i7-1165G7@2.80GHz, Linux7.0.0-42-generic. Node24.22.2 actual
portable WASM synthetic five-voice decaying harmonic plucks:
2.56-second windows90.6/64.8/62.9/62.5/64.1ms, 30seconds705.6ms/5,898,240B WASM,
300seconds7813.2ms/37,289,984B WASM; load30.8ms. In Chromium143.0.7499.4 actual
analysis worker: windows119.3/78.4/97.1/73.8/68.4ms, 30seconds816.4ms,
300seconds7884.7ms, same full-context memory; load41ms. Small samples are not a
representative p95 music benchmark; these prove feasible portable compute only.

Real native/WASM structural parity passed in all three modes, flats/sharps and
440/442Hz on identical 2.56/5.12-second canonical PCM, with numeric tolerance1e-5.
No mocked engine is used in that parity/resource test. Scheduler unit tests use a
blocked stub explicitly for timing/lifecycle assertions, not music evidence.

Paced injected canonical PCM through real ingestion and actual browser WASM
produced three changing live timeline patches before Stop. This is worker plumbing
evidence, not tab capture or worklet proof. The same run exposed a real Stop/refine
failure: lengths65536/61696 had final feature times rounded above duration. Strict
validation rejected that output, preserved the live snapshot and complete PCM,
and reported failure. DSP owner fixed round-then-clamp; staged regeneration and
reconfirmation are coordinated separately. The failing run is not erased by later
success. Real browser capture/UI/IndexedDB evidence belongs to U/T reports.

Focused tests include chunk-invariant resampling at8/16/24/32/44.1/48/96kHz;
15kHz alias attenuation below-40dB at32/44.1/48/96kHz; impulse timing; invalid rates/
nonfinite samples; stable seams/releases/missed intervals; boundary acks; frame
loss/gaps; short-fragment abstention; blocked engine retention/deadlines; explicit
engine upgrades, atomic success/cancel; request disposal; segment/PCM caps and
optional-counter validation. W-focused unit tests27 passed, including the resource-cache guards and explicit
upgrade/cancellation cases. Later guard changes require the final rerun below.

## Commands and remaining integration

- `cargo +1.89.0 test --locked -p fretbloom-wasm`: pass.
- `cargo +1.89.0 clippy --locked -p fretbloom-wasm --all-targets -- -D warnings`: pass
  at the recorded development source checkpoint.
- `cargo +1.89.0 tree --locked -p fretbloom-wasm --target wasm32-unknown-unknown -e features`:
  excludes native CLI dependencies.
- `cargo +1.89.0 fmt --all -- --check`: initially failed on the DSP owner's new
  irregular-length test formatting during active edits; W did not edit it.
- `node node_modules/typescript/bin/tsc -b --pretty false`: W files pass; shared UI
  browser-test overload error was reported to its owner and later whole check passed.
- Vite production build emitted distinct worklet, ingestion/analysis worker and WASM
  assets successfully at the recorded development checkpoint.
- Current artifact verifier intentionally rejects source drift during DSP edits.
  Never disable it or hand-edit hashes; final source-associated generation and
  clean npm/build/Docker verification remain coordinated with root.

Final artifact identity, Docker evidence, post-fix off-grid results and ownership
release will be appended when those coordinated checks complete. No holdout runs
or detector acceptance claims are included here.

## Runtime ownership release and fixed checkpoint

W releases protocol/runtime/ingestion/analysis worker/resampler/timeline/validation
and their focused tests to root for the separate follow-up fixer. W retains
packaging/manifests/artifacts/Docker. No W edits will race the root-assigned
capture-position/memory-accounting fixes R1/R2 from `rust-live-review.md`.

Coherent endpoint-fixed DEVELOPMENT checkpoint (not final musical freeze):

- Source `c2dcca24b80554f3c81ef2fc620d7b87a56694c6a2426a9f3664dd50ad1f7f6a`.
- WASM `abd14b5abb5d7d9bb0a150103b084bacc394e67c9334c32ff671824f99a1c3f2`.
- Native CLI `e3c00790bd8b63fdd934805c5a10af3b029b833d4a94ef6a36b50a2777c69dae`.
- Docker source context `0fd8b5eec36c25f934deab9f12a0d06e36cda28c3a159f34bcd6e1b520016253`.
- Guarded regeneration, published verification and same-machine disposable fresh
  `--check` passed. Snapshot retained at ignored `.tools/wasm-checkpoint`.
- Twelve snapshot native/WASM cases (all modes, 2.56/5.12 seconds plus irregular
  65536/61696 samples) passed; largest numeric difference3.91e-14 and no identity,
  stream, alternatives or shape changes. Feature times now remain within duration.
- Chromium143 paced actual runtime: two live patches before Stop,65536 samples,
  Stop `live`, refinement `refined`, last feature EXACT duration2.7306666666666666,
 262144 PCM bytes, zero errors. Five start/stop/refine/export/dispose cycles all
  passed with no errors; CDP dedicated-worker count0before/0after. This checks
  runtime cleanup, not browser-native process RSS or capture tracks/worklets.
- A real 300-second retained PCM refinement was canceled after handler execution
  in0.2ms; no late refined event, original old-engine snapshot remained, and all
 28,800,000 PCM bytes/hash remained exportable.
- WASM memory section: one nonshared memory, initial17pages, maximum2048pages
  =134,217,728 bytes. No mandatory SIMD/shared-memory flags.
- Snapshot verifier+TypeScript+Vite non-root `/listen-test/` build succeeded with
  Rust absent from PATH. Actual built worker/WASM base-path browser results follow.
- Docker native build succeeded; fresh pinned WASM rebuild correctly STOPPED on
  cross-container byte mismatch despite source association matching. Reproducibility
  remains an open packaging finding; it is not bypassed and no manifest was edited.

The non-root static asset browser check passed: built ingestion and nested engine
workers loaded from `/listen-test/assets/`, followed by the emitted WASM with
`application/wasm`. Returning SPA HTML for the WASM URL produced visible
`WASM_LOAD_FAILED`, never ready. No backend or cross-origin isolation was used.

Cross-container mismatch diagnosis found26 embedded local absolute Cargo registry
panic paths in WASM. Build scripts now record canonical project/Cargo path remaps
to `/workspace` and `/cargo`; the strict cross-machine byte check is retained.
New source association requires coordinated regeneration, with active c2 assets
left unchanged until clearance. Docker's pinned CLI tool stage is now independent
of changing engine sources, avoiding unnecessary reinstall work.

## Packaging reproducibility resolved on the derived checkpoint

The strict failure was fixed, not waived. A separate derived build context
`.tools/wasm-repro-context` uses the immutable coherent c2 DSP sources with canonical
path-remap build scripts. Original frozen `.tools/wasm-checkpoint` receives no
further writes. Root's active c2/abd browser artifacts remain unchanged; final
tracked regeneration still waits for the final DSP handoff and publication window.

- Remapped source association:
  `9abc88c180cfe9aea9c00e11e4b895849b5e74932263463366c62ed40857d456`.
- Remapped WASM SHA256:
  `466aef708557cddc833780a18d0eacc1feaf5ccb134b9098afd64450d8b1b228`.
- Host-generated remapped WASM has no `/home/xtra/.cargo` strings; diagnostic
  Cargo paths use the documented canonical `/cargo` prefix.
- Actual pinned Docker fresh build `--check` now matches all host artifacts
  byte-for-byte. The unmodified strict verifier validates the source association.
- Complete image `fretbloom-wasm-w:checkpoint-remapped`:
  `sha256:3963b52cc30a1bcad1a49f57d1b17b7a2e22f447e184951be1e31dd0be9a627f`.
- Docker native workspace release build, source WASM regeneration/exact comparison,
  npm-only Node-stage verify/typecheck/Vite build and runtime image creation pass.
  The image contains coherent checkpoint DSP and pre-R1/R2 frontend, and is not a
  final fixed-UI acceptance image.
- Own runtime only: `fretbloom-wasm-w-checkpoint`, free `127.0.0.1:5203:4173`,
  `NODE_ENV=development`, no database/credentials, uid1000. `/health` succeeds,
  real `/api/analysis/v1/capabilities` reports rust-dsp-2 and all18 qualities.
- Node serves the actual emitted WASM with status200, `application/wasm`,556326B
  and the matching remapped SHA256. COOP/COEP headers are absent.

The preserved `BASE_URL=http://127.0.0.1:5203 node e2e-rust-analysis.mjs` passed
against that actual non-root container: upload -> decode -> native Rust -> playback
-> save/reload -> hash-verified reattachment; manual timing persisted and source
replacement invalidated it. Reported analysis2650ms,3498B serialized song,5seconds,
9harmony spans,1mono/4poly notes. This is plumbing/preservation evidence, not
independent music-accuracy acceptance.

Stopping ONLY the owned container's Rust child caused the unchanged supervisor
to stop the public Node app and exit; the disposable `--rm` container disappeared
and port5203 was confirmed free. No owned browser/server/container remains running.
Docker images/build caches and ignored evidence contexts remain for root review;
no other service was stopped.

## Final handoff boundary

Implementation and development packaging checks are complete. Root retains the
final DSP/music freeze, separate R1/R2 fixes and final integrated acceptance. The
tracked root distributable intentionally remains the tested c2/abd checkpoint;
new canonical-remap scripts and subsequent DSP edits make source verification
correctly fail until the coordinated final regeneration. Do not ship that stale
association or bypass the verifier. At final coherent core handoff, with U/T/fixer
browser publication clearance, run Node24.22.2 `npm run wasm:build`, `wasm:verify`
and `node scripts/wasm-build.mjs --check`, then normal `npm run check:fast`/
`npm run build` and a fresh final Docker image. This last source-associated rebuild
is explicitly pending root's freeze, not a claimed passing current checkout.

W releases runtime files as stated above and returns packaging/artifact/Cargo
ownership to root at handoff (available for a narrowly requested regeneration).
No PR/commit/push/deploy, holdout detector run, production/live database/secret
access or unrelated checkout edit occurred. Musical accuracy gates and actual
capture/browser support remain in root/evaluator/U/T reports; synthetic parity,
portable throughput and retained native journeys do not establish those gates.

## Root correction: distinguish the original archive from its working directory

A delayed W coordination message clarified that remap diagnosis modified
`.tools/wasm-checkpoint/context/` before the final read-only instruction. Root
checked the files directly: that directory now verifies source `9abc88c1...`
and WASM `466aef70...`, just like the separate repro context. It must not be
described as an unchanged c2 source tree based on its directory name.

The original `context.tar` manifest and the separate `analysis-wasm/` assets
still identify source `c2dcca24...` and WASM `abd14b5a...`. Compare those original
assets and archive when reproducing c2 evidence. The c2 and 9abc source manifests
differ only in `scripts/wasm-build.mjs`, `scripts/wasm-verify.mjs`, and the recorded
path-remapping flags; their recorded Rust source hashes are identical. This
does not make their binary hashes interchangeable. Independent tests must record
the actual paths and hashes they consumed; the evaluator was notified.

Separately, root has now regenerated the active tracked assets against the DSP
fixer's frozen source and current remap scripts using Node24.22.2. Guarded build,
publication verification and `node scripts/wasm-build.mjs --check` passed:

- Source: `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`.
- WASM: `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`.
- Actual engine export: `rust-dsp-2`.

This resolves the active source/artifact drift. It does not attest final UI
integration, current Docker packaging or musical acceptance; R1/R2 UI/runtime
changes are still being implemented independently of these fixed WASM inputs.

## Root temporal-engine integration checkpoint

After the temporal builder released its frozen source, root regenerated the
active artifacts with the normal guarded build and pinned Node 24.22.2/Rust
1.89.0 tooling. The actual module exports `rust-dsp-3`:

- Source: `693181a3abec04e8320f8243a5245fa646d50e7af55d2e4bbe64f2dfdc04126f`.
- WASM: `21dea8a5a69485d776bb42b8d0901a47b4f27c6a02d3245598ccae3e584bf5e9`.
- Native: `72583af9dcd8ef1cd7fbe81280ba1de181c4c25aed0f2bdcfd4ce55424c977f0`.

`npm run check:fast` passed lint, typecheck, three independent fixture checks,
and 238 Vitest tests, with seven opt-in/DB skips. The suite includes actual
WASM/native comparisons. Normal `npm run build` passed, and a second guarded
`npm run wasm:build -- --check` reproduced the published bytes exactly. Logs
and exit codes are in `.tools/temporal-{check-fast,build,wasm-rebuild-check}.log`
and `.tools/temporal-integration-checks.json`.

This checkpoint includes the released R1/R2 changes and root's per-segment
feature-bound/Stop-hover fixes. It supersedes the earlier active-source drift;
the historical c2/fc324 evidence remains tied to its own hashes. Independent
new-engine browser resource/latency checks and musical evaluation are still
pending, and the temporal builder explicitly reports unmet musical gates.
No current-image Docker or deployment claim follows from this checkpoint.

## Root restoration after rejected recognition candidates

The joint rust-dsp-4 and official Basic Pitch reference both failed their adoption
criteria; see `docs/rust-joint-attribution.md` and
`docs/rust-learned-recognition.md`. Root restored the active core to the frozen
phase-corrected baseline and assigned the distinct identity `rust-dsp-3.1`.
All 19 baseline source/test inventory entries match `target/root-phase-fix/source`
exactly, apart from that engine string. Five existing files were restored; the
two new rejected joint-fit source/test files were removed from the active crate
only after verifying their unchanged copies in
`target/joint-attribution/integrated/source`. The rejected executable, complete
source and all scores remain archived. No user or sibling-checkout changes were
reverted. The known failing sustain-truth control remains explicitly documented
and is not counted as a passing test.

Normal guarded generation and exact-byte rebuild verification passed:

- Engine: `rust-dsp-3.1`.
- Source: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`.
- WASM: `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`.
- Native: `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`.

`npm run check:fast` passes lint/typecheck, three fixture checks and 238 Vitest
tests, with seven expected opt-in/DB skips. Normal `npm run build` and
`npm run wasm:build -- --check` also pass. Logs/exit codes:
`.tools/restored-final-{check-fast,build,wasm-check}.log` and
`.tools/restored-final-checks.json`; restoration inventory:
`.tools/restored-engine.json`. The first check encountered the deliberately
retained syntax-broken historical harness
`validation/temporal-candidate/busy-memory.mjs`; only that exact failed-attempt
file was excluded from lint, preserving both the evidence and the intentional
validation suites. No product lint error or detector assertion was suppressed.

This restores a coherent build and preserves the evaluated fast path; it does
not fix its documented musical failures or approve deployment. The next evidence
package must use separately sourced, licensed real-guitar recordings and audit
annotation timing and possible model-training overlap before further recognition
changes. Existing synthetic/real DEV scores and holdouts remain unchanged.

## Root restoration after rejected event reconstruction

The `rust-dsp-3.2` event reconstruction candidate is rejected; see
`docs/rust-event-stability-implementation.md`. Its two acoustic truth failures,
additional whole-source overflows and unchanged original three failures prevent
adoption. No new WASM was generated for it.

Root verified all 31 candidate inventory entries against both the active files
and `target/event-stability-builder/frozen/source`, plus the archived executable
SHA256 `13fa38b9fda0e7d612428061390a391e5f9914b0032c7e5c860ec01a77defbd3`.
Only `lib.rs`, `segments.rs` and `voice_evidence.rs` were restored from the
verified `target/event-stability-baseline/source` archive. The candidate-only
`tests/event_stability.rs` was removed from the active crate after verifying its
preserved copy. All rejected sources, failing tests, executable and raw evidence
remain in the frozen candidate archive. No unrelated change was reverted.

All 25 preserved baseline entries now match again, including root's separately
verified live reattack fix. The active engine is `rust-dsp-3.1`, with the same
`f75b55eb…` source, `c9217873…` WASM and `d3bec4e4…` native identities listed above.
Restoration inventory: `.tools/event-stability-restoration.json`.

Normal pinned `npm run check:fast` passes lint/typecheck, three fixture checks and
245 Vitest tests with seven expected opt-in/DB skips. Normal `npm run build`
passes the existing WASM association check, TypeScript and Vite. Logs:
`.tools/event-stability-restored-check.log` and
`.tools/event-stability-restored-build.log`. These are restored-build checks,
not new musical or complete browser acceptance. Original full-input event-limit
and musical failures remain open. No commit, push or deployment occurred.
