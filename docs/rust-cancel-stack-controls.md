# Independent saved-stack controls — prepared, NOT RUN

2026-10-31. Source-only handoff by the requested independent Sol 6.1 xhigh test
agent. No children. Writes belong exclusively to `validation/cancel-stack-controls/**`,
`target/cancel-stack-controls/**` and this report. **Ownership is released on
handoff.** No heavy window was acquired or released. Root schedules execution
after the explicit portable-completion builder release.

No syntax checks, tests, builds, WASM tools, WAT traversal, binary instantiation,
DSP, browser, benchmarks, process polling, waits or network access ran. No
production/database, active source, generated WASM, preserved snapshot, corpus,
label, scorer, holdout, default dist/preview, sibling checkout, commit, push or
deployment was touched. All previous failure evidence remains in place.

## Inputs and limits of inspection

Read the complete stack review and its small `review.json`, root triage and
portable-only decision. Read the immutable preparation identity and exact
inventory, then the relevant frozen helper/runtime/adapter/build source and
pinned Binaryen writer excerpts. `target/cancel-stack-controls/inputs.json`
records exact small input hashes, inventory-selected entries and line ranges.
This is preparation identity `a2b72711dee0806c19b62eff179f0cf78b9cbb5c03e38f372123d7524ef8b690`;
it is not a final candidate. No final completion source or artifact was inspected.
No claim about unchanged final source follows from the preparation hash.

No additional concrete builder defect was established beyond accepted R1–R7.
The source makes the previously reported R1 explicit-zero/end-alias acceptance
and R2 cleanup paths visible; these remain static findings, not executed failures.
For root's immediate reference: frozen `wasm-asyncify-bounds.mjs:90,109–130,142–147`
accepts a canonical module plus `(i32.store (i32.load offset=0 (global.get $data))
(i32.const 99))` without guarding the new store. Frozen runtime `:73–74` and adapter
`:24,41,50` permit close to free after an allocation/info/output-free trap outside
`controller.call`; retained source-only generated facade `:44–54` frees even when
info produced no tuple. These are the accepted review findings, not new evidence
against the current completion builder.

## Frozen controls

The `.mjs` files are standalone Node source and import no project test framework.
They are deliberately not added to the active default test scripts. The mathematical
oracle uses BigInt effective addresses and fixed bounds, independent of the
builder's recognizer/counts. Fixtures are small, retain all four access families
in every alias/drift example and do not copy the builder's preparation tests.

| Finding | Prepared control and expected result | Remaining execution/proof |
|---|---|---|
| R1 | `stack.mjs`: push/pop/local save/local load, scalar i32/i64/f32/f64, exact fit, one-byte overflow/underflow, end, zero, wrap, constant offsets, mixed 24-byte frame and full value roundtrip. Fitting accesses complete with exact cursor/value; forbidden accesses trap. | Run against final implementation and reconcile every actual assembled access. |
| R1 aliases | Explicit `offset=0`, derived local, end-pointer as address, numeric data/state identity, read and write aliases alongside all canonical families. Guard correctly or explicitly refuse; unknown extra use must refuse. | Acceptance of an alias requires its actual access to trap, not a count change. |
| R2 | `ledger.mjs`: exact generated facade loaded unchanged in a fresh VM; native instantiation boundary supplies instrumented exports. Enumerate every observed guest-entry occurrence and inject a WASM RuntimeError at each one. | Run on actual final glue/private runtime, then disposable real instances. Stub ledger is JS ownership evidence only. |
| R3 | `evidence.mjs` checks portable consumers descend from one verified raw capture or build refuses under shared-file replacement. | Final build fault-injection binding and actual run. Portable only; no JSPI rebuild requirement. |
| R4 | Wrong control pointer/state/signature/assert operand, extra data write, unexpected delta, imported/exported private globals, table/guest control routes, extra/shared memory must refuse. Changed bounds/header, invalid cursor and mutable end must trap. | Exact final import/export/table/control/private-global audit, header provenance and motion proof. |
| R5 | No count/scaling claim. Writer route must eliminate production WAT roundtrip; postprocessor needs cached lookups and one bounded complete scan. | Actual pinned source/tool review and root-scheduled resource/exit evidence. No giant synthetic module. |
| R6 | Fail after guard/transform, assembly and verification; retain actual files/hashes, phase, source/tool identities, command/status/stdout/stderr; publish nothing and preserve previous failures. | Final build binding and deliberate isolated failures. |
| R7 | `declarations.mjs` independently decodes binary type/function/import/export sections and compares exact low-level declaration names and JS value signatures. Facade namespace must be exactly six names; initialize resolves undefined. | Run against final binary and declarations. Unsupported syntax fails explicitly. |

Tiny-stack layout: header at 4096, begin 4104, end 4136, inside a two-page ordinary
live memory. Sentinels occupy `[4064,4096)` and `[4136,4168)`. No malloc adjacency
assumption is used. Set cursor **after** normal control entry so a terminal start
assert cannot hide an unguarded store/load. Snapshot memory from the host after
a trap; never invoke guest controls, free or close on that trapped instance.
Frame implementations may reject an entire frame before a partial safe write;
the control requires that no forbidden access happens, not a particular guard
placement or parser.

Read safety is NOT proved by unchanged canaries, nor by eventual trapping.
`evidence.mjs` requires an independent executor's complete binary instruction
enumeration and per-instruction proof tied to function index and instruction
byte offset. It verifies set reconciliation, not just totals. Every memory
instruction must be ordinary, header or saved with a derivation; every saved
instruction must map to one of the pinned writer sites below, with checked width,
offset, address evaluation and pre-access dominance (frame preflight is allowed).
The checker validates supplied evidence; it is not itself a disassembler or a
proof that supplied assertions are true. The executor must author/inspect that
enumeration independently of the builder's guard classifier. A builder JSON
manifest relabeled independent is unacceptable.

| Family | Pinned `target/cancel-compat/tools/src-passes-Asyncify.cpp` site |
|---|---|
| call-index pop | `visitCall(ASYNCIFY_GET_CALL_INDEX)`, 1454–1465: decrement 4 then load |
| local load | `makeLocalLoading`, 1598–1648: decrement total, typed loads at accumulated offsets |
| local save | `makeLocalSaving`, 1651–1690: typed stores then increment total |
| call-index push | `makeCallIndexPush`, 1693–1703: store then increment 4 |

Pinned upstream C++ SHA-256 is
`85c302b9edafc49669e7880b91166c53a8e890bb7ad241d4f1d1988ae8edb110`.
Also inspect position/update emission at 874–897 and controls at 1933–1985.
A patched writer requires its upstream/patch/build-recipe/toolchain/executable
hashes and review of every change to these emission sites. Inventory must include
indirect-callback frames, all header/global references, numeric/symbolic identity,
control bodies/signatures, imports/exports/table routes and one unshared wasm32
memory. Private fixed bounds must remain authoritative if mutable header end
changes. Reconfiguration must trap in the current direct-setter control. If a
final design instead proves setter reachability is private initialization only,
the executor must record that alternative proof and version this expectation
explicitly; it must not silently skip the control or introduce product test knobs.

## Mutant sensitivity and guest-entry ledger

`postprocessor-driver.mjs` prepares unguarded and terminal-assert-only mutants.
The exact same `accessControl` must reject both for every family. Writes use
in-memory adjacent sentinels; underflow reads remain in live memory and return
when the pre-read guard is absent. The late mutant models the old upper-only
terminal assertion, not every conceivable post-read check. Pre-access dominance
in the independent instruction proof must reject a check placed after a read,
even if that mutant ultimately traps with unchanged sentinels. Writer-route
mutants must disable/move the real writer guards while preserving its accesses.
They must not use the postprocessor fixture as evidence about writer emission.

Ledger stages include saved-stack malloc/configure, info and info free, PCM
malloc, options malloc, both Unicode reallocs, raw analyze, each state/control
entry across unwind/rewind, output free and any clean-close guest free. The clean
baseline dynamically enumerates actual entry occurrences; missing expected
stages must be investigated, never silently treated as coverage. A trap at an
entry must propagate, and **no subsequent guest entry is allowed**, including
initialization catch, worker-shaped close, repeated close and analyze after close.
Output free requires a completed owned tuple and cannot duplicate a free.
Unwind partial tuples are neither decoded nor freed. Rust string errors must
remain strings and allow clean reuse when supported by the final facade.
Separate private-runtime controls reject promise/nonzero yields with no rewind,
allocator or analysis entry afterward. Close while a host task is held must
reject the suspended call, skip guest cleanup, and remain idempotent.

`SourceTextModule` isolates the exact final glue and imports its pinned private
runtime without rewriting them. The fake native boundary is explicitly limited
to ledger tests; it does not certify native ABI, real trap behavior or final
artifact parity. Each real generated-instance trap test needs a fresh disposable
instance and whole-instance disposal only. Product cancellation termination,
CPU disappearance and browser performance belong to the separate acceptance owner.

## Commands for the independent executor

Do not run these during the builder window. After root's explicit release:

1. Read this report, source and input/freeze hashes; use the immutable FINAL
   completion handoff and its exact tool closure. Do not use the preparation as
   a candidate. Run syntax checks first and retain failures; none were run here.
2. Create a new candidate JSON from `candidate.example.json`, pinning absolute
   final facade/runtime/WASM/declarations/tool/driver paths and SHA-256s. Pin all
   transitive driver/runtime imports too. New bindings are executor-owned source,
   reviewed and frozen separately. Never edit final candidate or this preparation.
3. Root's release JSON must contain `explicitRootHeavyRelease: true`,
   `owner: "independent-stack-executor"`, and `candidateManifestSha256`. This
   explicit input prevents an accidental self-start; elapsed time is not release.
4. From this checkout, run each command with a NEW output directory:

```sh
node --experimental-vm-modules validation/cancel-stack-controls/run.mjs RELEASE.json CANDIDATE.json target/cancel-stack-controls/RUN-core core
node --experimental-vm-modules validation/cancel-stack-controls/run.mjs RELEASE.json CANDIDATE.json target/cancel-stack-controls/RUN-inventory inventory
node --experimental-vm-modules validation/cancel-stack-controls/run.mjs RELEASE.json CANDIDATE.json target/cancel-stack-controls/RUN-build build
node --experimental-vm-modules validation/cancel-stack-controls/run.mjs RELEASE.json CANDIDATE.json target/cancel-stack-controls/RUN-declarations declarations
```

The default driver binds the frozen `guardWat` interface to the selected FINAL
postprocessor plus pinned assembler, retaining each tiny input, output and command
log. A writer route supplies `createDriver(config, output)` returning
`compile({wat, writerInput, case, mutant})`, `configure(exports, layout)` and
`start(exports, header)`; compilation returns `{bytes, provenance, imports?}` or
an explicit `{refused: true, reason}`. Assembler failure is a harness failure,
not an approved refusal. Expose equivalent tiny test-only operations using real
writer-emitted sites in an isolated fixture; no public product knobs. `writerInput`
keeps mixed typed locals live across an indirect poll. Its generated frame layout
must be inspected and projected onto these operations; this final writer binding
cannot be prepared honestly without the final pinned patch/API. No writer tests
are claimed executed or ready-bound.

Build binding `buildScenario(name)` is likewise pending final source, not a
fabricated build test. For `raw-switch`, create two tiny valid same-ABI modules A/B
with different constant-return bodies in NEW scratch paths; stub Cargo returns A,
replace its shared output with B immediately after the verified capture and
before the next consumer. Fake consumer tools record exact bytes read. Assert
all portable consumers derive from captured A (including numeric metadata path),
or fail explicitly before publish. No JSPI primary is required by the new decision.
For `after-guard`, `after-assembly`, `after-verification`, inject exit 86 at the
named boundary using final owned fake-tool hooks, then check retained files on
disk and absence of staged publication. Return the fields required by
`evidence.mjs`; actual retained files are rehashed. Keep a prior failure bundle
hash as a sentinel against destructive cleanup. Do not inject into active assets.

Runner results are PASS only for the named scope; first unexplained failure
stops and saves evidence. A full candidate verdict additionally needs the
independent source/proof audit, real-instance lifecycle controls, normal guarded
generation, fresh byte identity and product/browser acceptance. No manual user QA
is required: the next independent executor owns bindings, automated execution,
evidence inspection and root handoff. Missing binding/evidence is BLOCKED, never
a skipped pass.

## Handoff status

All source, command entry points and expectations are **PREPARED / NOT RUN**.
`target/cancel-stack-controls/preparation.json` enumerates pending requirements;
`SHA256SUMS` freezes control/report/input metadata files. No generated candidate,
test pass, guard count, safety certification, performance result or product
acceptance is claimed. Source-only work is complete; all commands finished, no
process/server/channel/port/browser/container/worker was started, and no cleanup
outside these owned new files is needed. Root retains scheduling authority.
