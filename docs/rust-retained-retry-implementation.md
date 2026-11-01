# Retained recording retry — isolated implementation record

**Stopped at the immutable manifest/build constraint; partial implementation only. No adoption or acceptance claimed.** Owner: retained-retry-builder, Sol6.1 xhigh, no children. Exclusive grant SHA-256 `2d108fb6aafa8b5e0c9f70155ddc3090e658fdb34bbb8539cd0833f61d7f118b`.

## Plan recorded before implementation

1. Check immutable grant/base identities; copy the frozen source and dependencies into owned paths. Preserve Rust, generated WASM, tools, manifest and package.
2. Record a red control at the actual UI caller: a canceled retry uses the existing restore branch. Add a metadata-only analysis finalizer after the complete payload helper returns, exact child/key/request/watermark validation, retained transfer reservation, a nonrenewing 100 ms cancellation cleanup deadline and sticky affected-runtime refusal if proof is missing.
3. Add an explicit retained retry only after the canceled attempt settles and its input releases. Keep ordinary duplicate refusal, exact pending-RPC result adoption and explicit engine reanalysis separate. Move allocation budget checks before copy.
4. Exercise focused helper/drain, cancellation, stale identity and caller controls; run normal verifier/type/lint/build with owned output/cache. Freeze the actual prospective one-case browser inventory/release only after controls pass. Execute one real Chromium busy 300 s refine → cancel → immediate retained retry; retain setup failures and report CPU, functional and memory separately.
5. Deliver patch, exact inventory, provenance, unchanged WASM evidence and limitations; stop owned processes and explicitly release heavy ownership with UTC.

## State invariants

* One analysis input owner per ingestion realm; engine child epoch is distinct from session generation. A normal result/error alone cannot release it.
* The release finalizer closes over metadata only and runs after the full payload helper (including request/view/event activations) has returned. No payload queues or finalizer closure may retain PCM.
* Cancel rejects the user RPC promptly. Its first onset starts the finite cleanup deadline; repeat cancel cannot extend it. A missing/invalid proof keeps the reservation and refuses affected-runtime full copies, export and retry. Termination is not release proof.
* Retry consumes only a settled canceled attempt, never resets ordinary refine admission, never changes ingestion/canonical/Blob/snapshot identity and never restores. Old finally handlers cannot clear a new attempt.
* Results from canceled/stale/wrong-owner requests cannot be adopted. Normal full-copy completion and subsequent segment allocation wait for the genuine release boundary.
* 300 s, 96 MiB application audio, 128 MiB WASM, options, thresholds, checkpoints and yields stay unchanged. Cross-session dispose, verification, explicit engine fresh-restore paths and all-app memory closure remain outside this proof. Existing Node/WPE speed FAIL and musical NO-GO remain unchanged.

## Stop decision — normal build cannot pass within this grant

**INCOMPLETE / NOT READY FOR ADOPTION.** Stopped before any browser execution. No prospective browser case was frozen or released, because the prerequisite normal build failed. No browser, server, DSP campaign, numerical comparison, CPU run or memory run was started.

The immutable verifier's `sourceIdentity()` includes **every file under `src/audio/live`**, including tests (`scripts/wasm-verify.mjs:61`). Its normal `verify()` compares the entire source map and source hash to the manifest (`:82`). Consequently even an authorized TypeScript-only implementation or new focused test invalidates the unchanged manifest. The frozen baseline verifier passes. The owned normal `npm run build -- --outDir …/target/retained-retry-builder/dist-normal` fails at `wasm:verify` with `source/tool association changed`, before TypeScript/Vite. The grant forbids manifest/generated/tools changes and build bypasses. None was attempted. See [build failure](../target/retained-retry-builder/build-normal.log), [exact source-association mismatch](../target/retained-retry-builder/build-blocker.json), and [baseline verification](../target/retained-retry-builder/verify-baseline.log).

This requires a root decision about the source-association constraint before a normal validated build can exist; it does not justify adoption of this partial patch. No permission or wider framework is inferred. The manifest, package, Rust, generated glue/WASM and tools stay byte-identical.

## Partial changes retained for review

Only the ordinary owned copy is changed. Exact before/after SHA-256 values and all 68 unchanged protected source/artifact entries are in [changes.json](../target/retained-retry-builder/changes.json). The [patch against the immutable base](../target/retained-retry-builder/candidate.patch) has SHA-256 `795a24d819faef3afae8590370ab767e979176ff2f51dc6b8310ba6a11e15946`.

Changed file inventory (all relative to `target/retained-retry-builder/source/`):

1. `src/audio/live/protocol.ts` — typed input fence and retained retry facade operation.
2. `src/audio/live/validation.ts` — strict metadata fence/watermark parser.
3. `src/audio/live/runtime.ts` — retry RPC and exact cancellation request identity; canceled ordinary/retry replies remain fenced by the exact pending RPC. Cleanup deadline is stamped at facade cancellation onset.
4. `src/audio/live/ingest.worker.ts` — input reservation until matching release; result staging; budget check before analysis copy; explicit canceled-attempt retry; nonrenewing cleanup deadline and sticky refusal. Export joins refinement settlement and input release.
5. `src/audio/live/analysis.worker.ts` — synchronous dispatcher, sole asynchronous payload helper, metadata-only completion callback after helper return; cooperative portable close for cancellation. Trap/init/close/uncertain-transfer failures do not manufacture proof.
6. `src/components/LiveListen.tsx` — canceled ordinary retry chooses retained operation without getPcm/restore/replacement; explicit reanalysis and completed-refinement restore behavior remain separate; controller identity guards old catch/finally.
7. `src/audio/live/ingest.worker.test.ts` — updated child protocol and transferable stub; focused synthetic owner/release/refusal controls.
8. `src/audio/live/analysis.worker.drain.test.ts` — new mock-backend helper-drain/close/init/trap controls.
9. `src/components/LiveListen.retained.test.ts` — new actual caller-body seam control with injected surrounding React state/refs.
10. `src/audio/live/capture.test.ts` — add the new required method to the existing typed facade mock; no capture product change.

No active source, frozen input, previous evidence, sibling checkout, default dist/preview, DB or production was changed. No commit, push, deploy or installation. All 220 entries of the immutable base inventory were rehashed successfully at closeout. Portable WASM remains `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e`.

## What was actually proved

* **RED at the actual caller seam:** execute the unchanged baseline's `LiveListen.refine` body with injected surrounding refs/state. A prior attempted/canceled state invokes createLiveRuntime and restore, so the no-recreation assertion fails. The baseline is not asserted to have the future retry API. The same unchanged test passes after the owned edit. [Red](../target/retained-retry-builder/red-caller-actual.log).
* **Focused candidate units: 31 PASS across five files.** Includes the existing facade canceled-reply/event replay controls, both cancellation routes, unchanged ordinary duplicate rejection, retained snapshot identity, old request/child/generation replay, malformed watermark, release withholding, normal result staging, repeat cancel not renewing deadline, bounded refusal and late ack not reopening a blocked runtime. [Final units](../target/retained-retry-builder/units-third.log).
* Helper-drain controls dispatch the actual analysis worker module into a mocked `self`, with a mocked portable backend that holds its helper. They show no ack on cancel receipt, close return or partial drain, and one metadata-only ack after helper return. **These are not real-worker or real-WASM release evidence.** Likewise the ingestion scheduler's release envelopes are synthetic test inputs; they are never labeled genuine release proof.
* **Normal strict TypeScript PASS.** [Log](../target/retained-retry-builder/type-normal.log). Normal lint attempts, including explicit source paths, selected zero files (`No files found to lint`); lint is **NOT VALIDATED**, not a clean pass. Logs retained. Normal build **FAILS**, as above; no standalone Vite build or bypass ran.

Pinned Node24.22.2 and private dependency versions/hashes are in [tool provenance](../target/retained-retry-builder/tool-provenance.json). Later exact argv/cwd/UTC/status and owned environment are in [commands.jsonl](../target/retained-retry-builder/commands.jsonl); early invocations/statuses are retained separately in [early commands](../target/retained-retry-builder/early-commands.json), explicitly marked retrospective with no invented timestamps.

Initial failures are retained: native config import startup failure, nullability type error, mistyped relative Node path, and a unit failure where export resumed after release before refine's finally cleared its busy flag. That last failure prompted awaiting both settlement and release. No actual browser/DSP case was rerun or concealed. One malformed local Python launcher attempt used this environment's unexpected `sys.executable` (the T3 AppImage), exited before starting lint and changed no product source; the literal `/usr/bin/python3` launcher then recorded the actual explicit lint attempt. This is setup evidence, not a passing lint result.

## Missing proof and known remaining review work

**No actual worker genuine-ack withholding control, no real canceled-reply browser replay, no busy 300 s retained-retry case, no CPU-stop result, no transfer/OS-owner/source join, and no conservative memory bound are established by this run.** The requested functional, memory and CPU verdicts are all **INCOMPLETE / NOT RUN**. A 100 ms timer is policy only and is not CPU-stop evidence. The normal-error coverage is conservative trap refusal, not a demonstrated genuine normal-error release. The final patch has not been independently reviewed.

Static closeout also identifies an unresolved dispatcher edge in this partial candidate: a concurrent second refinement RPC can replace `activeRefinement` while its own admission then rejects; its finally can clear the cancellation routing record of the still-running first request. That must be repaired and directly tested before any candidate execution/acceptance. Do not apply this patch as a finished cancellation repair. No additional source edits were made after the build-scope stop.

The React seam demonstrates branch selection and stable key/Blob references but is not a mounted UI/IndexedDB proof of saved identity. Queued cancellation and late-finally interleavings, full request activation/queue source audit and genuine worker instrumentation remain incomplete. The helper split is intended to remove payload roots before finalization, but no all-runtime drainage claim follows from mock tests. Cross-session dispose, verification, explicit old-engine fresh restore, export/play/Save outside this retry interval and arbitrary caller ownership remain outside scope. No global coordinator or WAV/verification framework was introduced.

Existing Node/WPE speed **FAIL** and musical **NO-GO** are unchanged. Root owns independent review and acceptance; this run adopts nothing.

## Cleanup and heavy release

[Heavy release](../target/retained-retry-builder/heavy-release.json): **2026-11-01T00:12:05.166615+00:00 UTC**. Closeout found zero owned execution processes and zero browser profiles. No browser/server was started and no port was allocated. No children or followups remain. Source/report-only provenance finalization after this release started no heavy work.
