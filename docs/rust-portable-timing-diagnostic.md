# Repaired portable timing diagnostic — unresolved

2026-10-31. Root ran the single prospectively declared observation-only causal
prefix after independent control verification released the machine. The child
completed normally at 22:27:31.267 UTC; the supervisor reaped it at
22:27:31.282 UTC. All 342 calls across 19 rows completed. Every output matched
the retained expected bytes. The 33 preparation pins still match. No candidate,
active product, corpus, scorer or previous evidence was changed.

The candidate is the independently checked `646cbb9a…` source and `8aab705e…`
portable WASM, not the earlier `5ae907ea…` / `fe01db79…` candidate. The exact
bindings, observation patch and prior protocol association are retained under
`target/cancel-portable-diagnostic-repaired/`. Preparation SHA-256 is
`547a0190d819df556bda77421e7358d229d4c9a5d5f851bbc9d09d4ecd284e39`.

## Result

The predeclared detailed target, block 2 portable sideband, has p95
491.3819969 ms. Its declared result is **NOT_REPRODUCED_UNRESOLVED**, not a pass
for adoption. Block 1 portable sideband in the same causal prefix has p95
537.39608 ms. That earlier row has call-level clocks and CPU records but no
detailed phase hooks. The repaired candidate has not received an uninstrumented
performance acceptance. The parent's retained 557.2169716 ms failure is unchanged.

Within the detailed target, almost all observed time is in the raw-call spans.
For its slowest call, 509.58167 ms wall corresponds to 509.338 ms main-thread
CPU; raw-call interiors sum to 508.638112 ms. Queued-task interiors total
0.443274 ms, copy 0.029626 ms, decode 0.017801 ms and free 0.001326 ms. No
recorded GC interval overlaps that call. This does not explain the old slow
call. Raw spans include WASM work, saved-stack guards/unwind/rewind, imported
poll clocks and observer overhead; they do not isolate the numerical engine,
compiler tier or hardware state. These observations do not justify changing
the scheduler or yield budget.

There were 1,171 boundary events without overflow, plus four delivered GC
entries under 0.5 ms each. Added observations can change compilation and the
time-based yield boundary. Thread/process CPU brackets differ slightly from
wall interiors. No observer cost is subtracted, no percentile aggregates are
subtracted from one another, and no failing sample is discarded.

## Commands and retained evidence

The one executed engine command was:

```sh
env -u NODE_OPTIONS .tools/node-v24.22.2-linux-x64/bin/node \
  target/cancel-portable-diagnostic-repaired/supervisor.mjs \
  target/cancel-portable-diagnostic-repaired/root-release.json \
  target/cancel-portable-diagnostic-repaired/run-first
```

`run-first/` retains cost rows, all call records, phase/GC observations, IPC
journals, exact grant and cleanup. The bounded supervisor used 180 seconds total
and 5 seconds per call; neither deadline fired. `analyze-observations.py` reads
those files without executing an engine and produces `analysis.json`; its
ordering, pairing, count and pin assertions pass. The original preparation
under `target/cancel-portable-diagnostic/` remains untouched and unexecuted.

No unchanged repeat is scheduled. An independent data/source review will check
the interpretation and propose a discriminating next step only if the evidence
supports one. Browser functional, CPU-stop and application-buffer checks can
proceed independently under a separately assigned exclusive heavy window.
Neither those checks nor this diagnostic can waive numerical recognition or
performance failures. Root's explicit heavy release is recorded separately.

## Independent review

`rust-repaired-timing-review.md` independently reproduces all row statistics,
phase pairings and relevant hashes. Root verified its four delivered file hashes.
It supports the unresolved result and establishes no production defect. Its
additional accounting check finds that phase thread-CPU deltas do not partition
the outer CPU measurement exactly: the slow call's phase sum leaves 7.475 ms,
whereas the disjoint wall interiors leave only 0.354146 ms. The CPU readings are
supporting observations, not an additive breakdown or an estimate of overhead.

The proposed next diagnostic would distinguish compilation/runtime work,
machine execution rate/run delay, work inside the raw path, and task/GC delay.
It remains a proposal. Browser execution owns the next heavy window; no profiler,
benchmark repeat or tracing process has been started or scheduled. Any later
trace needs its own prospective supported-format/clock/size binding and exclusive
release, and cannot replace uninstrumented acceptance or delete the old failures.
