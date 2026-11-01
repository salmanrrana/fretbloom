# Root decision: one portable browser cancellation backend

2026-10-31. This is a prospective implementation and acceptance decision. It
does not change any frozen result, declare a failed gate passed, or adopt an
untested artifact. The reviewed JSPI candidate remains rejected: its retained
Node sideband cost fails and its original facade has the independently proved
completion race. Root has separately fixed and verified that race in the active
working branch; the JSPI cost cause remains unresolved.

The next browser candidate should use the guarded, whole-call portable Asyncify
backend across the browser matrix. The old portable prototype now executes
correctly in natural pre-JSPI Chrome 136 and explicit Asyncify on Linux WebKit,
as well as the earlier Firefox/Chromium cases. Those results support completing
one portable path instead of maintaining two production ABIs and selection
branches. They do not establish the new guarded implementation's safety or
performance. Failure of the portable candidate will remain a failure; there is
no automatic fallback to the rejected JSPI candidate or synchronous processing.

The immutable JSPI and optimized synchronous modules remain comparison and
diagnostic references. Temporary generation/reference utilities may remain when
needed for proof, but the production worker should not ship an additional JSPI
selection path without a measured product need and a new explicit decision.
Numerical engine/schema, output identity, recording semantics and browser scope
stay unchanged. This decision does not claim Safari or physical-device coverage
from Linux WebKit evidence.

## Prospective acceptance

- Preserve the original named-machine/browser product budgets: live compute
  p95 at most 500 ms, steady event delay p95 at most 1.5 s without growing backlog,
  actual expensive processing stopped within 250 ms of cancellation, valid 300 s
  refinement within 120 s, accounted owned JS within 96 MiB, and WASM linear memory
  including the saved stack within 128 MiB. Keep the required lifecycle, retained
  PCM, request identity, phase/overlap and cleanup checks; label unavailable
  physical/native memory separately.
- Keep the additional declared Node sideband 500 ms maximum safeguard for the new
  portable candidate. Declare the complete three-block sample protocol, tool/
  artifact identities, timed scope, ordering, clocks and load observations before
  execution. Preserve every result. Node and browser measurements have different
  scopes and cannot replace each other.
- Measure comparison distributions against both the already optimized numerical
  reference and the unchanged active numerical baseline. For future cancellation
  acceptance, zero overhead against the already optimized synchronous engine is
  not a release gate: it was a stricter campaign addition, not the original
  product contract. Report that overhead explicitly. Any claim of a speedup or
  of no regression must be supported against its clearly named reference; the
  earlier numerical campaign's verdicts are not changed by this decision.
- Require exact complete result/feature/error preservation, guarded deterministic
  generation and fresh byte identity, pre-access saved-stack safety, default
  test portability, actual integrated browser behavior and final packaging.
  The old unguarded feasibility artifact cannot satisfy these requirements.

The original independent cancellation run remains **FAIL under its frozen
protocol**, including its per-row comparison test. This prospective distinction
does not rehabilitate it. The known later WAT scan did not overlap its failed
cost measurements and supplies no explanation for them.

## Execution ownership

The existing portable-completion builder owns the exclusive heavy window under
`target/cancel-portable-next-coordination.json`. It should finish the safety proof
and actual artifact, apply the verified root request-identity fix, and validate
the single portable production path. The separate stack review remains source
only; root forwards its findings. Active product adoption still belongs to root
after independent acceptance.

The performance review's648-call instrumented JSPI diagnostic remains **not run
and not scheduled**. It is a sound bounded proposal if understanding that rejected
path becomes necessary. It is not on the critical path while a simpler portable
candidate is being completed. No unchanged-candidate pass-seeking rerun is
authorized by this decision.
