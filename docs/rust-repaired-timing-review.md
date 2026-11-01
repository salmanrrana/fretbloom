# Repaired timing: independent source/data review

2026-10-31. Sol 6.1 xhigh; no children. Root's interpretation is supported:
**the detailed target did not reproduce the failed p95; the cause remains
unresolved and performance acceptance stays open.** No production or scheduler
repair is justified by these records. Active product stays on its baseline;
there is no new music-accuracy claim.

The [independent arithmetic and hash audit](../target/cancel-repaired-timing-review/evidence.json)
recomputes every diagnostic row and detailed target span without executing DSP.
It verifies all **33 preparation pins**, **31 closeout entries**, both 52-file
manifest source associations, and the exact parent/observation patches. Its
178 named input files match before/after. This is bounded source/data inspection
and named-file hashing, including pinned binaries, not binary instruction/WAT
traversal or a renewed safety proof. The separate control recheck supplies that
proof for the exact repaired artifact.

## What is established

The repaired source association is
`646cbb9a09577a7362548c416959a2f5caf7dd4f13f94002f31ceb4955ef9f69`;
portable WASM is
`8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e`.
The parent's source is
`5ae907ea5062d28a8be9b116fee05cf7a10c79ea6e97fafd7b65164f146c71a4`;
its WASM is
`fe01db79d4930d86d28f4fe5204a476cb91dea096d836e4c5fc01a5a2c01543e`.
Inventory comparison identifies exactly six changed source paths: package test
command, bounds generator, manifest, portable binary, generation metadata, and
new control-entry test. The regenerated text patch matches the frozen patch.
Numeric Rust, glue, runtime/scheduler, polling stride and budget are unchanged.
The new entry checks are real executed work, so source similarity alone cannot
transfer performance results between these binaries.

The amendment precedes root's grant and execution. The control owner's recorded
release precedes that grant. Root bound a new diagnostic identity while retaining
the historical protocol explicitly as history; it did not relabel the parent's
failure. The actual staged observation diff matches exactly. The driver retains
three reused instances initialized optimized→active→portable, all 18 block-1 rows
in declared order, then block-2 portable sideband: **342 calls, 19 rows, 57 warmups,
285 retained samples**, three warmups plus fifteen retained per row. Every
recorded output hash/size matches its parent's six fixture references; source
also asserts complete-string equality against each fixture's first optimized
output. This review did not recompute raw outputs or recognition scores.

All p50/p95/max and sample lists reproduce. Block-2 portable sideband p95 is
**491.3819969 ms**, correctly **NOT_REPRODUCED_UNRESOLVED**. Its top retained calls
are 483.582137 and 509.58167 ms; the declared interpolated p95 uses weights
0.7/0.3. Thus one call can exceed 500 ms while this row's p95 remains below it.
Block-1 portable sideband still has p95 **537.39608 ms**, with four retained calls
above 500 ms. It has call-level CPU clocks but no phase observations. This is
neither a whole-prefix pass nor an uninstrumented repaired-artifact acceptance.

The parent's retained block-2 p95 independently remains **557.2169716 ms FAIL**.
Its slowest call records 739.836011 ms wall, 723.890 ms user plus 0.002 ms system
**process** CPU. Those values cannot be called main-thread or DSP CPU, or
explained retrospectively by the new traced call.

For the detailed target's slowest call, index14 (zero-based, retained sample12):

- Outer wall 509.58167 ms; main-thread CPU 509.338 ms; process CPU 510.447 ms.
- Eleven raw-call interiors total 508.638112 ms. Ten queued-task interiors total
  0.443274 ms; handler→continuation 0.087254 ms; explicit rewind-entry interiors
  0.010131 ms; copy 0.029626 ms; decode 0.017801 ms; free 0.001326 ms.
- These disjoint wall interiors leave **0.354146 ms unclassified**, including
  marker/control/outer gaps. No recorded GC interval overlaps this call.

All 1,171 events are ordered, correctly paired and within their call's expected
scope; buffers did not overflow. Four delivered GC records each last under
0.5 ms. Normal child exit, portable close and supervisor reap are recorded;
neither deadline fired. Root's heavy release is **22:31:01.889207+00:00**.

## What remains unidentifiable

For this observed slow call, long queued-task delay is not the dominant measured
cost; near-wall main-thread CPU supports substantial on-thread work. Raw spans
still combine numerical WASM/Rust serialization, saved-stack guards and
unwind/rewind, imported poll clocks, observation and any runtime work occurring
there. Small explicit `start_rewind` spans do not measure all rewind overhead.
Neither DSP alone nor a particular compiler tier is isolated.

CPU spans are not a clean additive wall partition. For index14, summed phase
thread CPU is **501.863 ms**, leaving 7.475 ms against the outer CPU bracket,
while unclassified wall is only 0.354146 ms. Reads occur at different boundaries;
their accounting granularity/accuracy is not calibrated here. This discrepancy
does not establish an engine bug or 7.475 ms of observer work. Keep CPU deltas as
supporting observations, and avoid exact per-phase CPU or overhead claims.

GC collection starts only at the detailed target and callback delivery can lag;
absence of a recorded overlap is not blanket proof of no runtime work. There
are no compilation/tier events, sampled stacks, instruction counts, CPU-frequency
or run-delay observations. Load endpoints cannot supply them. Machine frequency
changes can increase both elapsed and thread CPU time; high thread CPU alone
does not exclude machine-state effects. Prefix no-op hooks, extra CPU reads,
IPC/journal work, retained observation arrays and detailed clock reads can alter
compilation, allocation, inter-row history and time-based yield boundaries.

I found **no concrete arithmetic, pairing or production-code bug** explaining
the slowdown. The audit's additional wall residual makes the retained scope
clearer; it does not fix the cause. Do not subtract phase CPU, observer cost,
unpaired percentile aggregates or a hypothetical machine penalty from any gate.
No sample or original failed row should be removed.

## One discriminating next experiment, if root pursues diagnosis

One separately authorized trace is warranted to distinguish remaining causes;
it is optional diagnostic work, not a requirement to explain the historical
spike before other owners finish. Ranked by usefulness of discrimination, not
established likelihood:

1. **Compilation/tiering or other V8 work.** Prediction: slow intervals correlate
   with compile/tier events or main/helper runtime stacks rather than stable
   numerical execution. Complete traces showing stable tiers and no corresponding
   runtime work weaken this account for those intervals.
2. **Machine execution rate or descheduling.** Prediction: comparable work slows
   alongside lower effective CPU frequency or higher main-thread run delay;
   instruction counts, if available, remain similar. Stable rate/delay during
   slow calls weakens these particular machine explanations. Load averages alone
   cannot discriminate them.
3. **Work inside the raw path.** Prediction: with stable tier/machine observations,
   excess sampled CPU or instruction work stays in numerical, guard/rewind or
   imported-poll paths. Attribute only to the resolution actually captured;
   predominantly runtime or off-CPU intervals weaken this account.
4. **Task delivery or GC dominates a future spike.** Prediction: its large wall
   intervals align with post→handler/continuation or recorded GC activity.
   Their continued small spans would weaken this explanation for that spike.
   It is already weak for target index14, not disproved for the old failure.

Prospectively freeze **one** fresh process on the same repaired WASM, pinned
Node, inputs/options, three-instance initialization, 342-call prefix, warmup and
sample inclusion, output comparisons and exact production scheduler/guards.
Retain the existing observations and add a bounded V8 CPU/compilation trace
covering initialization and both portable sideband rows, plus timestamped
main-thread run-delay and effective-frequency context at at most 10 Hz. Freeze
the supported tracing format/clock mapping first; do not assume Node exposes
every compiler event. If instruction/frequency access is unavailable, label that
hypothesis untested; do not substitute loadavg or make it a product gate.

Use root's fresh exclusive window **after** the browser owner releases, the same
180 s total/5 s per-call bounds, no repeats/extensions, and a prospectively fixed
trace storage cap (e.g. 32 MiB). Preserve every completed/failed/partial call and
all original evidence. Overflow, missing trace fields or no recurrence means
limited/unresolved attribution, not another run until passing. Analyze per-call
alignment, including slow block1 calls even if block2 stays below its p95 limit.
Instrumentation changes timing and may not reproduce the spike; it cannot
quantify observer overhead without another independently designed control.
No trace result replaces unchanged uninstrumented acceptance, changes thresholds,
or authorizes scheduler tuning. **NOT EXECUTED OR SCHEDULED by this reviewer.**

## Closeout

Executed only bounded source/JSON reads, hashes and
`PYTHONDONTWRITEBYTECODE=1 python3 target/cancel-repaired-timing-review/read-evidence.py`.
All arithmetic/pairing/hash assertions pass. Exact input hashes are in
`evidence.json`; delivered hashes are in
[SHA256SUMS](../target/cancel-repaired-timing-review/SHA256SUMS).
No engine, test/build, browser, WAT traversal, benchmark/profile, install,
commit/push/deploy, production access, child agent or background process ran.
Only this report and `target/cancel-repaired-timing-review/**` were written.
No owned process, browser, port, server, timer or product instrumentation remains.
**Source/data review ownership released; no heavy window was acquired.** Other
owners may continue independently; this report makes no claim about their work.
