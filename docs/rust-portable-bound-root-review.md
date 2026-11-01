# Root review of final browser bindings

2026-10-31. Source review only. Root read the handoff, all 25 exact observation
patches, their audit/coverage records, the observer implementation, staging and
execution guards, and the relevant final product source. All 66 files in the
binding lock matched. The lock SHA-256 is
`66619cbb73a296fc5b694b25cbf893404b3654e65713c56d27ec4aec6afe0f75`.
No browser, syntax/type check, build or engine ran in this review. Original
bindings remain immutable; no execution grant has been issued.

## Observations and limits

The bindings preserve the production calls, waits, transfer lists and numerical
artifact. Identity hooks occur outside the accepted compute clock. Detailed
hooks add clock reads, metadata allocation and asynchronous fetches; they can
change task pressure and the existing time-based yield boundary. The detailed
profile is diagnostic, not evidence of identical scheduling or uninstrumented
compute performance. Missing or late records remain missing evidence.

The observer does not keep strong references to observed ArrayBuffers through
its WeakMap. It also does not establish when those allocations cease to be live.
The allocation/resource-site audit is useful but is not a measured peak or a
complete ownership ledger. Transfer records must be joined by actual ownership
and request identity; matching byte counts alone are insufficient. Cancellation
must not erase an old worker's retained buffers merely because terminate returned.
The current hooks do not close immediate-retry overlap or all capture/playback/
verification resource lifetimes. Those requirements remain incomplete.

Detailed phase marks alone cannot prove that cancellation interrupted the named
phase: transport may deliver the start mark after the operation already ended.
Real phase intervals, OS identity/CPU evidence and the action time must agree.
Likewise a fast successful refinement cannot prove that its production timeout
fired. Unexercised phases remain incomplete. No artificial delay or fabricated
engine result is authorized to relabel such a case as an actual DSP proof.

## Preserve the original memory scope

`rust-live-architecture.md:275` defines ownedJsBytes as accounted application
buffers, not total browser memory. Its resource contract at lines 809–814 sets
the 96 MiB application-owned JS/PCM buffer budget and names canonical chunks,
transfer/refinement copies, export Blob and WAV copies. The R2 amendment at
lines 239–249 also includes UI PCM and verification buffers and requires exact
shared-Blob identity. It explicitly excludes a hard cap on browser-native
AudioContext/Blob storage/iframe/process memory and does not promise synchronous
GC. The later portable decision preserves this budget.

Accordingly, future execution must account for every relevant audio buffer,
Blob/copy backing ownership and old/new overlap in those operations, with WASM
linear memory and its saved stack accounted separately once. The experiment
must still report metadata/observer/native-memory limitations. A universal
browser GC, object or string-allocation proof is not a newly added release
requirement. This clarification does not permit dropping audio buffers,
double-counting shared ownership, or substituting existing counters for a
missing independently checked peak.

## Prospective scoped execution amendment

The source-bound harness currently requires alloc/free stage names before any
staging, even for functional, parity and source checks. The owner correctly left
these absent rather than fabricating a ledger. That global dependency must be
split in a NEW executor-owned amendment before execution: a functional result,
a CPU-stop result, and a memory result are separate verdicts. Each scope must
require its own real evidence. A functional run with memory incomplete cannot
be labeled complete acceptance or make the memory result pass.

Root approves that prospective separation of execution scopes, not an execution
grant or a pass. Keep exact candidate/protocol/tool hashes and independent safety
evidence, preserve the original frozen preparation, declare the chosen scope
before running, and retain all failed attempts. Observer review flags must name
the approved profile and limitations instead of treating one boolean as complete
runtime validation. Identity-only timing and detailed diagnostic results must
stay distinguishable. The independent executor owns this small harness amendment;
no production code change follows from it.

The retained Node cost failure remains FAIL regardless of any functional pass.
Independent safety execution still owns the machine. Root first reviews its
result and release, then separately decides timing diagnosis and browser work.
No automatic repeat, adoption, deployment or musical acceptance is authorized.
