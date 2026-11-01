# Portable cost review: failure confirmed, cause unresolved

2026-10-31. Sol 6.1 xhigh, independent source/data review, no children. **NO-GO
remains.** The [arithmetic audit](../target/cancel-portable-cost-review/evidence.json)
reproduces all 54 rows, 972 calls (162 warmups, 810 retained) and all 18 portable
gate records with zero discrepancies. Only portable block2 sideband fails:
**p95 557.2169716ms >500ms**. Nothing was rerun, waived or adopted. Recognition
acceptance, independent safety proof and actual-worker/cancellation acceptance
remain separate questions.

## Association and measurement

The authoritative candidate is **frozen-complete**, not the older `frozen/`.
Its identity SHA256 is `3accc91c35f82fcbcb1ff8da71eb2f11d82ccb4377f355817a08df662e3caae4`,
inventory SHA256 `01140d93bf875e705647bdbe9c19922d9da02c4e7c6b6f4ee2c12b4013e055d0`,
source `5ae907ea5062d28a8be9b116fee05cf7a10c79ea6e97fafd7b65164f146c71a4`,
portable WASM `fe01db79d4930d86d28f4fe5204a476cb91dea096d836e4c5fc01a5a2c01543e`.
I independently hashed the identity/inventory and bounded runtime/glue sources;
their identities agree with the pre-run protocol, loaded identities and final
inventory. Binary/native association relies on root's 221-entry verification;
this reviewer did not traverse/re-execute WASM or re-prove the native hash.

The protocol's earlier source hash is `acc9604e…`; the final source association
records generator-only hardening after cost. Exact runtime/glue hashes agree
independently; measured WASM agrees with the final inventory and root's verified
binary. The [association](../target/cancel-portable-completion/cost-final-association.json)
is supporting evidence, not a substitute for those identities. Active WASM is
still `c9217873…`; optimized comparison is `7b40ba5c…`. The active facade
request-identity fix matches both final `runtime.ts` and `runtime.test.ts` exactly.
Engine rust-dsp-3.1 and numerical acceptance are unchanged.

The final declaration at21:37:54.482955Z precedes the run's21:39:57.213Z start.
The embedded protocol matches its file exactly. Each of three blocks has all
three engines and six fixtures, in the declared order, with3 warmups+15 retained
calls per row. Node24.22.2/V8 13.6.233.17-node.63 records empty execArgv and null
NODE_OPTIONS. Instances initialize once, optimized→active→portable, then persist
across blocks; rows batch an engine's fixtures rather than pair adjacent calls.
Every call's retained hash/size agrees across references for its fixture. This
is a hash/record reconciliation; no raw output corpus or recognition score was
independently recomputed.

[cost.mjs lines5–8](../target/cancel-portable-completion/cost.mjs#L5) time the
complete generated public call: input allocation/copy, whole computation,
Rust JSON serialization, task waits, UTF8 decode and completed output free.
UTC/CPU reads bracket the monotonic interval; CPU has a slightly wider scope.
File I/O, initialization, options stringify, output hashing/equality and report
writes are outside. Output strings/arrays remain reachable, and complete reports
are rewritten between rows: relevant history, not measured synchronous I/O to
subtract from a call. JS JSON.parse/parseOutput/postMessage are excluded.

The [actual worker](../target/cancel-portable-completion/frozen-complete/source/src/audio/live/analysis.worker.ts#L100)
includes PCM-view/options construction, generated call, JS parsing/validation and
memory check; computeMs ends before postMessage. Its retained Chromium143
sideband p95=316.65ms is a different observation and cannot clear Node's failure.
The prior **JSPI** block1 sideband770.5919632ms remains separately failed. Its
[648-call proposal](../target/cancel-performance-review/diagnostic-plan.json)
is unrun and concerns a different ABI/scheduler; its no-yield controls are not
this portable probe. The later old WAT scan does not explain that older failure.

## What the retained failure identifies

The failed portable row starts21:40:54.245Z; its final call starts
**21:41:01.061Z**, sample index17 (retained sample15). Fourteen of fifteen retained
calls are≤500ms; the median is428.169481ms. The top two are478.951669ms and
739.836011ms. The declared interpolated p95 uses zero-based rank13.3:
`0.7×478.951669 + 0.3×739.836011 = 557.2169716ms`. The single high call matters
under the frozen rule; removing it or changing quantiles would change that rule.

That739.836011ms call records723.890ms user+0.002ms system process CPU, giving a
net wall-minus-process-CPU difference15.944011ms. The row's process-CPU p95 is
549.0404ms. This supplies positive evidence of substantial process work during
the slow interval, weakening a **pure idle task-wait-only** account. It does not
identify DSP CPU: process accounting includes main/helper V8 work and GC, can
overlap waits, and is not main-thread or per-phase accounting. Earlier portable
warmup CPU even exceeds wall time (1197.77ms versus651.15ms), demonstrating that
process CPU cannot be treated as a single-thread wall partition.

This is a later spike after108 earlier portable calls and17 calls in the target
row, so it is not simply the first portable call. Late compilation/tiering and
GC remain possible. The synchronous optimized reference also has a later
632.33ms sideband call in block2; that is contextual variability, not a paired
causal control. Load endpoints2.65→2.76, runnable snapshots7→19 and heap/memory
endpoints do not identify interference, thermal changes, GC or measurement error.
No raw task-post/handler/resume, main-thread CPU, GC or compilation events were
retained. Measurement arithmetic/order is consistent; that does not prove that
clock/environment/observer effects are absent. **Cause remains non-identifying.**

The actual scheduler is
[asyncify-runtime.js](../target/cancel-portable-completion/frozen-complete/source/src/generated/analysis-wasm/portable/asyncify-runtime.js#L14),
not the older JSPI `taskYield.ts`. It posts a real MessageChannel task; the handler
clears pending and resolves numeric0 (lines17–24). Polling starts unwind only at
the50ms budget (26–34); the call ignores partial tuples, stops unwind, awaits the
task, checks zero/closed, then starts rewind (39–51). Its clock resets at initial
raw entry and the rewind poll, not at arbitrary timer intervals. Rust crosses
the host first and every64 engine checks
([lib.rs78–87](../target/cancel-portable-completion/frozen-complete/source/crates/fretbloom-wasm/src/lib.rs#L78));
host polls are not yield counts. Public analyze encloses copy, controller call,
decode and completed-output free
([glue148–175](../target/cancel-portable-completion/frozen-complete/source/src/generated/analysis-wasm/portable/fretbloom_wasm.js#L148)).
I found **no concrete small source bug** establishing this failure's cause.
Pre-access guards, poll cadence and cancellation correctness must stay intact.

## Smallest bounded next step

Under the diagnosing-bugs skill, the retained run is real red feedback, but it
does not yet provide the fast, repeatable, minimized Phase1 loop. The
[one-variable proposal](../target/cancel-portable-cost-review/diagnostic-plan.json)
adds **observations only** to the exact product path. One process executes the
342-call causal prefix through block2 portable sideband, then stops. This retains
known instance/call/allocator history while removing the35 later rows. It is the
smallest prefix preserving known history, **not a proven minimal reproducer**.
No second configuration or unchanged acceptance rerun is proposed.

Record actual raw entry/return, task post→handler→continuation and decode/free
intervals, main-thread versus process CPU with read bounds, bounded poll summaries
and GC event intervals. Long measured waits with low main-thread CPU narrow
scheduling delay; long active spans with high main-thread CPU narrow execution
work; process/helper excess or correlated GC narrows runtime work. None by itself
names an instruction-level cause. A slow raw span still needs a subsequent
specific probe to distinguish DSP, guards/Asyncify and V8 work. Keep all output
strings exact, all thresholds and scheduler behavior fixed; observation overhead
and unclassified residual remain explicit. If it does not recur, report unresolved.

**NOT RUN, NOT SCHEDULED.** This is a concrete diagnostic specification, not an
executed engine harness. Root must first freeze an observation diff/driver and
grant a fresh exclusive window after the independent safety owner releases.
Phase1 still needs that actual red-capable invocation with retained output,
bounded attribution and evidence-guided reduction/reproducibility. Only then
proceed to falsifiable repair hypotheses. A500ms Node gate,500ms actual-worker
gate and≤250ms actual CPU-stop gate remain mandatory; a quieter machine or a
relaxed gate is not a repair. This proposal neither accepts numerical recognition
nor completes safety, browser cancellation, memory or packaging proof.

## Audit and closeout

Executed only:
`PYTHONDONTWRITEBYTECODE=1 python3 target/cancel-portable-cost-review/read-evidence.py`
→ `54 rows / 972 calls; zero arithmetic discrepancies; 18 gates match; portable
block2 sideband p95=557.2169716000009ms FAIL; inputs unchanged`.
The script uses exclusive output creation; a later run cannot overwrite this
evidence. Its [122 input pins](../target/cancel-portable-cost-review/evidence.json)
include source/evidence hashes and UTC/mtime metadata, every retained top-level
builder log, initial/corrected setup records and the shared Vitest-cache incident.
The [supplementary pins](../target/cancel-portable-cost-review/retained-record-pins.json)
also retain41 bounded builder metadata records, including browser setup amendments
and before/after failure-control records. Filesystem mtimes are not inferred event times.
Those records remain unchanged; no shared-cache repair hides the incident.
The raw cost records, old JSPI failure, old proposals and original corpora/labels/
scorers/holdout were neither edited nor rerun. No giant summary/raw output dump.

Writes belong only to this report and `target/cancel-portable-cost-review/**`.
No tests, build, WASM/WAT traversal, DSP, browser, benchmark, profiler, dependency
install, cache write, commit/push/deploy, active product/default preview or external
service was invoked. All foreground readers have exited; no child/background
process, timer, browser, server, port or temporary product instrumentation exists
to clean up. **Performance-clear: this reviewer never acquired a heavy window.**
