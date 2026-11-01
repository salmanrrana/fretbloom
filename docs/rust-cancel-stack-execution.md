# Independent portable stack execution — FAIL on R4 control contract

2026-10-31. Requested Sol 6.1 xhigh, independent execution, no children or user QA.
Root granted the exclusive heavy window in
`target/cancel-portable-independent-coordination.json` (SHA-256
`3ce812b76eac61c0619e0da9ff09be0b8c51b8a41ae771349351ddc464e8ad59`).
Only new `validation/cancel-stack-execution/**`, `target/cancel-stack-execution/**`
and this report were written. No active product, old freeze, default dist/preview,
corpus/labels/scorer/holdout, shared dependency/cache/tool, production/database,
sibling checkout, commit/push or deployment was changed. No browser or cost suite ran.

**Overall safety contract: FAIL, not accepted.** The frozen lower-bound control
expectation fails both on an assembled fixture and the exact final native binary.
This is a control-contract defect, not a demonstrated out-of-bounds saved read/write.
All measured performance failures and unaccepted numerical recognition remain so.
In particular the retained Node sideband block2 p95 557.22ms still exceeds 500ms;
no rerun, waiver, adoption or claim about its cause follows from these checks.

## Identity and setup

Final input is `target/cancel-portable-completion/frozen-complete`, never `frozen`.
All 221 inventory entries matched before and after. Identity SHA-256 is
`3accc91c35f82fcbcb1ff8da71eb2f11d82ccb4377f355817a08df662e3caae4`, inventory
`01140d93bf875e705647bdbe9c19922d9da02c4e7c6b6f4ee2c12b4013e055d0`, source
`5ae907ea5062d28a8be9b116fee05cf7a10c79ea6e97fafd7b65164f146c71a4`, portable
WASM `fe01db79d4930d86d28f4fe5204a476cb91dea096d836e4c5fc01a5a2c01543e`.
Native inventory entry remains `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`.
Active WASM remains `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`.
The root runtime.ts/runtime.test.ts repair matches the final source exactly.

The preparation SHA256SUMS and all named docs/binding were read and checked.
Owned control copies were syntax-checked and frozen before candidate execution.
`candidate-v1.json` hash is
`b925adc56c0b4d312cab0b35907d15f05b8a2054933e9f331613575ca2f052de`.
Release files bind the parent root grant and candidate manifest; this is root's
existing binding authority, not a new grant. Additional source SHA files and
versioned declarations retain later standalone-driver bindings. The final evidence
inventory associates them without pretending it was a pre-execution freeze.

Setup amendments preserve original preparation and every failure: output root is
owned; setter uses `(header, begin, end)`, including its unused mutant signature.
The frozen ledger already calls initialize(input) directly, so it needed no edit.
The final route is official unpatched Binaryen125 plus FINAL guardWat; no writer fork.
Node24.22.2 and pinned bindgen/Binaryen bytes were checked against builder's tool
inventory. Build probes use direct Rust1.89 paths, owned Cargo targets/homes/TMPDIR,
and read-only tool symlinks. No Vitest or shared result-cache write occurred.

## Executed findings

| Scope | Result and concrete evidence |
|---|---|
| R1 access safety subset | **PASS for decoded pre-access/update subset.** All 94 scalar cases, 3 mixed frame cases, 10 alias/refusal cases and 16 malformed cases pass before the independent R4 failure. Eight same-control unguarded/terminal-assert mutant cases pass by rejecting mutants. See core-v1 and supplement-v1. |
| R2 disposal/lifetime | **PASS for named ledger and real-instance controls.** 56 stub ledger cases plus 2 rejected/nonzero-yield cases pass. 28 unchanged-native-instance cases pass, including boundary native traps, 12 ordinary Rust-string-error/success reuses and real suspended close. A separate real writer overflow traps in checker875 and has zero subsequent guest calls. |
| R3 verified capture | **PASS for actual capture/substitution probe.** Exact source and real bindgen/numeric/Asyncify/guard/assembly/verification consume raw A after shared Cargo output is replaced by valid same-ABI B. Both consumer inputs are hashed; staged raw is mode0444. |
| R4 complete control contract | **FAIL.** Header identity, reconfiguration, changed end, cursor beyond end and malformed routes pass; cursor below begin returns normally at start-unwind. Exact final binary independently reproduces it. Full acceptance/proof flag stays false. |
| R5 bounded scanning | **PASS for named resource/source check.** Cached function lookups and pieces/join inspected. One independently timed exact full guard scan exits0, 2.40s wall, 574,192KiB maxRSS, no swap, output exactly equals retained guarded WAT. This is tooling memory, not application memory. |
| R6 failed-build retention | **PASS for declared after-guard, after-assembly and after-verification probes; limited prior-bundle claim.** Each exits86, preserves actual failure files/logs and unchanged published baseline. After-verification was reached and its full manifest set survives. A separately frozen prior-evidence sentinel stays unchanged; an earlier real failure bundle inside the same build root was not seeded, so no executed claim about that stronger scenario is made. |
| R7 binary declarations/API | **PASS after explicit harness syntax binding.** Independent binary section decoder matches all12 exports and their signatures against actual arrow-function const declarations; exact six public names and initialize returning undefined pass. Prepared parser failure is retained. |

### R4 minimum reproduction and implication

`real-stack-v1/results.json` records a fresh instance of the exact final binary:
allocate a 40-byte header+stack; begin=header+8; end=begin+32; initialize the two
header words and call the private setter once; set header cursor to begin-1; call
asyncify_start_unwind(header). It returns normally; frozen expectation requires
a WASM RuntimeError. No guest cleanup is attempted on any trapped instance.
The source insertion at `scripts/wasm-asyncify-bounds.mjs:128` checks header identity,
and the unchanged writer control checks only cursor>end. Neither rejects cursor<begin.

The independent binary listing confirms start-unwind869 and start-rewind871 have
that shape. Every following saved access and cursor update remains independently
checked against fixed bounds. Thus this result does not establish unsafe memory
access, normal product reachability of host header corruption, or a public raw
instance leak. It still fails the unchanged requested control contract. Candidate
was not fixed and this expectation was not weakened.

### Independent binary proof, including a truly late read check

`binary-audit-v3.py` decodes the original binary instruction stream directly;
it imports no builder parser, guard classifier, count manifest or generated WAT.
It examines all874 defined functions, 728,202 instructions and 54,555 memory
instructions, including286 call_indirect sites. JSONL records contain absolute
instruction offsets, function indices, memargs, address provenance and guard call
positions. All reference indices are numeric binary identities.

There are25,614 saved accesses: 652 call-index loads, 652 stores, 12,155 typed frame
loads and 12,155 stores. Header accesses number7,730, ordinary accesses21,211.
The exact checker875 instruction formula checks configured begin, unsigned
A>=B, A<=E and span<=E-A before returning A. Each saved address is that exact
returned operand, with span=offset+width; operand-stack provenance proves the
check executes before the memory operation and the address is evaluated once.
Unknown address joins or cursor escapes refuse proof, not disappear from counts.

`cursor-motion.json` independently decodes every one of2,574 header stores into
its complete eight-instruction window: header address; cursor read; signed
constant delta; add; zero span; checker call; store. `frame-proof-v1/frames.json`
reconciles all1,270 cursor-local frame groups with contiguous typed offsets and
exact whole-frame size. Signed delta multiplicities match each frame/index family
by function; range is -1396..1396. This is per-instruction evidence, not count-only
agreement. Families map to pinned upstream writer sites1454–1465,1598–1648,
1651–1690,1693–1703; upstream SHA-256
`85c302b9edafc49669e7880b91166c53a8e890bb7ad241d4f1d1988ae8edb110`.

The assembled control/global/table audit finds private defined zero-init mutable
i32 data/state/header/begin/end globals2/1/3/4/5; setter874 alone writes bounds;
only exact controls assign data/state. No guest call/ref.func/element reaches the
controls/setter. One fixed303-entry funcref table and one unshared wasm32 memory
(min17,max2048 pages), two function imports, no imported/exported globals/storage.
The setter's independently decoded49 instructions enforce one-time setup,
header+8==begin in i64, actual-memory/end/span caps. Complete decoded control bodies
are retained; the lower-bound control failure remains explicitly false in proof.
Rust allocator/disjoint-allocation correctness remains a runtime premise, not a
new theorem about all ordinary Rust accesses.

A real assembled **after-read-check** mutant reads live memory at stack end and
then traps. The same runtime trap/canary oracle accepts it; that is retained in
`late-read-v1/runtime-result.json`, not called safe. The same independent binary
provenance rule rejects its actual load at function8 byte563: its address is a
cursor local, not the checker return. The late checker at byte572 is dropped
later. This proves sensitivity to a forbidden read even when eventual trapping
and unchanged canaries would hide it. The tiny fixture decoder changes only the
expected maximum-memory comparison for its two-page fixture; the final-module
2048-page assertion and audit remain untouched.

`frame-proof-v1/access-proof.json` and `all-assembled-accesses.json` retain exact
reconciliation. The former deliberately retains full-control verification=false;
a complete safety certificate is not issued. Binary scan resources:3.10s,
190,464KiB maxRSS, exit0 under55s timeout; no SIMD/atomic/GC/exception syntax was
silently skipped. Unsupported instruction/section forms refuse the bounded decoder.

## Build association, retained failures and limitations

Four new byte-identical source copies use separately pinned real raw A. B changes
one valid one-byte i32.const code immediate, preserving all ABI declarations,
and is validated by native WebAssembly. Actual raw pins preclude arbitrary tiny A;
using real pinned A gives a stronger real-consumer substitution test without
patching source/pins. Cargo is explicitly stubbed to return this captured raw;
this is **not** a new fresh Rust compilation. All downstream tools are real.

The raw-switch normal stage verifies the same sourceHash and all10 artifact
hashes exactly match final frozen assets. It publishes nothing. The builder's
fresh-Cargo rebuild remains separate evidence. After-guard injects tool status86
before assembly, preserving guarded/input WAT and raw/intermediate bytes.
After-assembly induces an actual adapter ABI refusal by changing only owned stage
JS. After-verification throws only when the normal stage-success log is reached,
after verify(out) completed. Each external probe exits86 with retained command,
status/stdout/stderr, exact source/tool manifests and file hashes. Some stdout/
stderr are empty and remain actual files. `build-evidence.json` enumerates them.

Failures and setup corrections are never overwritten:

- core-v1 stops at the first real R4 failure. Only unexecuted independent controls
  continue in supplement-v1; no failing case rerun seeking a pass.
- The prepared declaration parser recognizes function declarations but final
  generator emits arrow-function const declarations. Its failure stays in
  supplement-v1; the separately named arrow parser matches the actual ABI.
- binary-v1 decoded but failed serializing because a globals list shadowed a
  Python builtin. Its source, empty partial file, traceback and resources survive.
- binary-v2 retains three unresolved ordinary select joins and is INCOMPLETE.
  Retained targeted instruction windows justify the version3 ordinary-provenance
  join correction; tainted/unknown operands still refuse. No binary changed.
- Initial read-only inspections found no final .tools directory and no tests glob;
  one result inspection hit KeyError on an omitted undefined JSON error field.
  These are inspection/setup errors, not candidate execution failures. They are
  recorded separately in failure-ledger.json; no test result was changed for them.

No browser acceptance, arbitrary input proof, new numerical recognition test,
performance cause, worker CPU-stop/overlap accounting or physical/native memory
claim is supplied. The shared Vitest cache incident remains untouched.

## Reproduction and handoff

All commands use repo cwd and `.tools/node-v24.22.2-linux-x64/bin/node` (N below).
Parent grant/release and every input/driver hash are in candidate/release manifests.
Main commands (all already executed, new output directories required for any new task):

```
N --experimental-vm-modules validation/cancel-stack-execution/run.mjs target/cancel-stack-execution/release-v1.json target/cancel-stack-execution/candidate-v1.json target/cancel-stack-execution/core-v1 core
N --experimental-vm-modules validation/cancel-stack-execution/supplement-v1.mjs target/cancel-stack-execution/candidate-supplement-v1.json target/cancel-stack-execution/supplement-v1
N --experimental-vm-modules validation/cancel-stack-execution/real-instance-v1.mjs target/cancel-stack-execution/candidate-supplement-v1.json target/cancel-stack-execution/real-v1
N validation/cancel-stack-execution/real-stack-v1.mjs target/cancel-stack-execution/candidate-supplement-v1.json target/cancel-stack-execution/real-stack-v1
/usr/bin/time -v timeout 55s python3 validation/cancel-stack-execution/binary-audit-v3.py FINAL_PORTABLE_WASM NEW_OUTPUT
python3 validation/cancel-stack-execution/proof-v1.py
python3 validation/cancel-stack-execution/frame-reconcile-v1.py
python3 validation/cancel-stack-execution/final-audit-v1.py
```

Build modes, exact environment/arguments, exit codes and logs are in each
`build/MODE/command.json` and `probe.json`; guard resource invocation is in
`guard-resource.command.json`. Prior binary versions/resources remain alongside
version3. Failure ledger, final verification, handoff status, release UTC and final
per-file evidence hashes are in this report's owned target directory.

No servers, browser channels, ports, workers or child agents were created.
Node MessageChannels were closed; real trapped instances were disposed without
allocator/free/stop calls. All owned execution commands completed. Heavy ownership
is explicitly released at the UTC recorded in `heavy-release.json`; root may
schedule the next owner. The final candidate and all preparation hashes were
verified unchanged on closeout.
