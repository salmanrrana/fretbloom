# Independent temporal v3 validation — 2026-10-31

**Musical acceptance fails.** This is a new independent tester run against frozen rust-dsp-3. Reliability and binary parity passes do not establish accurate guitar transcription. Signal-frontier-to-DOM latency also fails the 500 ms gate in the measured short genuine-tab journey. Final full-length results are recorded below.

## Association and scope

Fresh Rust 1.89.0 release `cargo build --locked -p fretbloom-analysis --bin analyze-pcm --target-dir validation/temporal-candidate/run-v3/native-target` produced `72583af9dcd8ef1cd7fbe81280ba1de181c4c25aed0f2bdcfd4ce55424c977f0`, byte-identical to delivery-final. All delivery source inventory entries matched before build, and remained unchanged after it. Normal artifact verification passed without bypass. Canonical source `693181a3abec04e8320f8243a5245fa646d50e7af55d2e4bbe64f2dfdc04126f`; published WASM `21dea8a5a69485d776bb42b8d0901a47b4f27c6a02d3245598ccae3e584bf5e9`; Cargo.lock `4cf9ea7903f854b54c1eb312c6f0ad828b2a3234015da44afb619c2687bae953`.

Full source/UI/generated input inventory: `validation/temporal-candidate/before.json`; build commands, tool versions/hashes and association: `run-v3/association.json`. Current product inputs were copied into `run-v3/context`; browser tests consume that copy, built into its own dist with the pinned Node 24.22.2. No holdout audio/labels were inspected or executed, no child agents, checkout/worktree, commits, push, deployment, credentials or databases outside disposable browser IndexedDB. Prior evidence was read only. All tests share a host with concurrent tester/reviewer/browser load; timings are observations under that load.

**Scope deviation:** an initial Vite invocation mistakenly ran in the root checkout and rewrote root `dist`; its log landed at `/home/xtra/code/build-browser.log`. No source or generated analysis-WASM artifact was changed. The root dist had no independent pre-run inventory, so byte identity to its previous contents is not claimed. Subsequent builds use only the owned copied context. First scorer imports used normal Python caching; valid scorer runs used `PYTHONDONTWRITEBYTECODE=1`. These deviations prevent a claim of perfect exclusive-write compliance.

## Unchanged DEV scorers

All 51 synthetic DEV files ran in each of auto/monophonic/polyphonic (153 calls); all three complete GuitarSet DEV recordings ran in auto through the unchanged real scorer; all 12 supplemental DEV cases ran through the unchanged extended scorer. Zero valid-run execution, wire or scoring failures. No thresholds, labels, endings, crops or denominators were changed. Raw PCM/results/commands, per-case/per-family scores, stream/routing/duplicate metrics, empty-reference metrics and alternatives/unknown accounting remain under `music-v3-complete/{synthetic,real,extended}`. Baseline comparisons use retained d3e0 outputs without rebuilding it.

| Settled synthetic auto metric | d3e0 % | Independent v3 % |
|---|---:|---:|
| mono_early_exact | 99.63 | 99.63 |
| mono_exact | 92.03 | 92.13 |
| poly_midi_exact | 6.65 | 8.94 |
| poly_pc_exact | 87.71 | 87.13 |
| note_precision | 95.24 | 94.36 |
| note_recall | 66.95 | 68.53 |
| note_f1 | 78.63 | 79.40 |
| root_accuracy | 87.96 | 88.10 |
| quality_accuracy | 82.55 | 82.05 |
| compatible_identity_accuracy | 59.17 | 58.81 |
| bass_accuracy | 98.20 | 98.25 |
| negative_false_positive_rate | 0.00 | 0.00 |
| boundary_f1 | 60.00 | 50.00 |

Frozen gates remain MIDI F1 ≥85%, precision/recall ≥80%, mono early/sustain ≥95/90%, PC exact ≥85%, root/quality ≥90%, compatible primary ≥85%, each intended group ≥70%, bass ≥85%, dedicated negatives ≤1%, harmonic boundary F1 ≥85%. Exact MIDI 80% is the retained diagnostic target. PC accuracy does not receive register credit. Correct alternatives and honest unknowns do not receive primary identity credit.

Synthetic auto note TP/FP/FN = 6887/412/3162; exact MIDI 184/2059; PC exact 1794/2059; compatible primary 1138/1935. Harmonic boundaries TP/FP/FN = 3/6/0 versus baseline 3/4/0. Dedicated silence/noise/percussion negatives: 0/300 false frames, separate from other reference-empty margins (0/1445).

Independent timed-register accounting, every changed synthetic case, real union deltas and reviewed intervals: `music-v3-complete/additional-audit.json`; complete old/new scores: `comparison.json`. Bands 28–47, 48–59, 60–71, 72–96 remain separate from settled metrics. Timed mono TP falls 1025→1012; this loss is not hidden by union gains.

| Whole real DEV recording | Mono P/R/F1 % | Poly P/R/F1 % | Empty-reference emitting / total |
|---|---|---|---|
| 00_Rock2-142-D_solo | 100.00/29.32/45.35 | 60.04/92.81/72.91 | 113/175 |
| 00_SS3-84-Bb_comp | 100.00/30.96/47.28 | 71.31/60.85/65.66 | 74/135 |
| 01_Jazz3-150-C_comp | 100.00/26.00/41.28 | 60.44/74.26/66.64 | 232/382 |

Real union exact MIDI sets remain 416/1178, 372/2151, 224/898; the independent audit retains all lost/gained true and removed/added extra note frames. Reference-empty reductions do not establish correct releases; possible annotation/room-tail disagreements remain unresolved rather than waived.

Concrete production cells (`concrete-probes.json`): C6 at .70 s emits [48,52,57], missing MIDI 60 and 67; Rock at 4.21 emits [64,69,83] against [64,69]; Jazz at 3.61 emits [45,57,60,64,68] against [57,60,64]. madd11 capo 0/3 misses defining 64/67; full exact sets remain 0/60 in both. Supplemental dim/half-dim has 244/244 exact MIDI frames, correct equivalent alternatives and abstention; unambiguous-primary denominator is zero. Full 12-case counts, capo groups and alternatives are retained in the unchanged extended report.

Delayed-octave and singleton controls were rerun with the independently built executable. Astra’s exact whole/late-window DEV fixtures were then hashed and tested in native and actual WASM (`sustain-truth-toleranced.json`): expected [57,69] is recovered at whole .8/1.2/2.08 s, lost at 2.72/3.36/4/4.6 s; the late window emits only [57] at .64/.8/1/1.4/1.8. This corroborates shared late-sustain failure, not recovery. The mathematical phase-pi defect is separately established in `docs/rust-temporal-review.md`; no production fix was attempted.

## Actual WASM and runtime reliability

`parity.mjs` / `parity.json`: 108 new actual browser-WASM/native comparisons cover three modes × two spellings × A432/440/446 × six probes (65536 ordinary, 61696 irregular, C6, madd11, singleton, delayed octave). Chord parity probes use sine-source mixtures; they are not scored guitar acceptance fixtures. Strict keys, lengths, identities, alternatives, register, boundaries, timestamps and routing receive zero tolerance. Only score/margin/cents/tuning/chroma numeric fields allow absolute tolerance ≤1e-5; RMS remains exact. All 108 pass. The two additional sustain comparisons also pass the same strict tolerance. No detector is mocked.

`offgrid.json`: actual worker Stop/export/refine preserves 65536 and 61696 samples exactly, correct finite final feature endpoints, engine rust-dsp-3 and refined completeness.

`report.json` / `segmented.log`: actual worker restore/refine at extents 0/16384/7200000 emits 9+3742=3751 legitimate frames. Refinement 10,770.5 ms; strict JSON round trip preserves all frames; extents and verified 28,800,000-byte PCM hash survive. `segmented64-valid.json` repeats actual runtime with 63×15361-sample segments and the remainder: 63×9+3246=3813 frames, with no truncation. Each segment is checked by ceil(samples/1920). The first 64-segment attempt deliberately-too-short in practice used 1921 samples and correctly stayed partial under the existing 15360-sample refinement minimum; it is retained as a harness setup error, not a product failure.

`busy-memory-v3.json`: genuine synchronous DSP was started before cancellation. Visible cancellation 22.40 ms; actual nested worker termination 3.40 ms (both ≤250 ms). Original 28,800,000-byte verified PCM and old saved engine remain intact; retry uses a distinct generation and storage changes only after explicit Save. Canceled work is not adopted. Playback/save on 300s retained PCM observes 87,514,144 bytes (83.46 MiB) application-owned audio high-water, below 96 MiB. Runtime baseline 58,714,112 plus 28,800,032 verification working bytes reconstructs that maximum after accounting the shared PCM Blob once. Observed WAV Blob is 14,400,044 bytes; source audit accounts both its source ArrayBuffer and Blob copy. DOM counters are measured logical ownership, not allocator/GC or browser RSS. Existing independent R2 allocation evidence remains source-applicable; current integration has been re-executed.

The first memory harness had a syntax error; the next replaced Blob with a subclass and thereby broke native IndexedDB Blob instanceof checks. Corrected v3 uses a forwarding Proxy preserving native Blob identity; both rejected attempts remain. The first extra sustain check accidentally demanded exact floating-point equality and rejected harmless ~1e-13 cents differences; corrected field-specific ≤1e-5 comparison passes without relaxing structure/identity/boundaries.

## Genuine browser capture and pacing

Chromium 143.0.7499.4, actual getDisplayMedia tab selection from the local musical WAV fixture, no fake detector or fake capture device. Capture launches ignore default --disable-infobars and --mute-audio. Only owned 127.0.0.1:5323/5324 servers are used. Built-app short journey passed changing note evidence before Stop, positive captured RMS and browser displaySurface, pause/resume, keyboard Stop/narrow layout, refinement, playback clock advance, retained-audio save/reload/playback/delete, zero audio/session network mutations and owned track/context/worker cleanup. Stop hover contrast independently remains >6.7:1.

The short journey’s actual unique DSP calls: 33; compute p95 216.9 ms; signal-frontier-to-DOM observed estimate p95 **573.5 ms**, max 623.0 ms — **fails ≤500 ms** under concurrent load. No skipped windows. `performance-summary.json` defines the status-informed per-segment source-frontier mapping, joins clocks via timeOrigin, retains all pairs and long tasks. This includes 320ms intentional future support and block quantization. It is not acoustic-onset latency or frame presentation time.

Full cap journey and final inventory results are recorded in the closing section.

The first 300s paced tab run (`tab-1793462626527`) reached automatic Stop: 467 unique actual DSP calls, compute p95 221.9 ms, 465 DOM observations with signal-frontier estimate p95 608.9 ms and maximum 945.5 ms. Zero skipped windows. Its final Stop click times out because the app already automatically stopped; this is a retained harness failure after pacing, not an engine crash or a completed refine/save journey. The corrected full-cap journey is separate evidence.

`refine-memory-direct.json` adds transparent observation of actual nested-worker result messages: 16,384 samples use 3,145,728 bytes WASM; 7,183,616 samples use **38,076,416 bytes (36.31 MiB)** and 8,885.4 ms compute. Both remain under 128 MiB / 120 s. Earlier status-only memory samples were stale during the synchronous refine call and are not used to claim its WASM peak. WASM memory grows monotonically within that worker, so its actual post-call linear-memory size also bounds its preceding call's linear-memory peak; this does not bound native browser allocations.

Hardware/environment is recorded in `environment.json`: Intel i7-1165G7, 8 logical CPUs, Linux; shared-host concurrent load. No exclusive-load latency claim or RSS delta is made. Browser process/native allocations, physical peak, hardware acoustic onset, broad device/browser support, and every MessagePort's direct resource count remain unvalidated. The historical browser-closure cause remains **unknown**; a harness timeout after automatic Stop is not a reproduction or explanation of it.


## Final full-length result and handoff

Corrected genuine-tab run **`tab-1793462818684/report.json` passed the complete lifecycle**: live changing notes, pause/resume, automatic five-minute Stop into Review, actual refinement in **10,683 ms**, playback, original PCM retained with metadata, save/reload/playback/delete, no mutation requests or browser/React errors, and owned stream/context/worker cleanup. It retained **7,200,000 samples / 28,800,000 bytes**. Actual recorded segments [0,65536] and [65536,7200000] refine to **35+3716=3751 frames**, preserving both pause-separated extents. This independently exercises the frame-cap fix on actual captured PCM, in addition to the exact 16384 split repro and the 3813-frame maximum test.

Its **467 unique actual DSP calls** have compute p50/p95/max **138.3/190.3/236.0 ms**. Across 466 DOM observations, the signal-frontier estimate is p50/p95/max **507.6/560.7/907.7 ms**. **The ≤500 ms DOM latency gate fails**, including on this completed run. No skipped windows. Observed live WASM 3,538,944 bytes, live runtime-owned JS 29,914,112 bytes; full-refinement and combined playback/save memory are measured separately above. Per-segment source/retained offset modes match 5/5 first-segment and 555/594 second-segment status samples, with asynchronous status outliers retained. This estimate is not a sample-exact acoustic-onset measurement.

The completed 300s run recorded 6 main-thread long tasks, maximum 160.0 ms, summed duration 468.0 ms. Every task and per-call/pair observation remains in the raw report and `performance-summary.json`.

Final `final-attestation.json` rechecks every original source/generated/UI input and every copied-context source input against its before hash; both inventories are unchanged and both normal artifact verifiers pass. Native and published WASM still match their frozen hashes. `evidence-inventory.json` hashes the owned evidence (excluding private build/dependency caches); the report hash is recorded there. No new product changes or regeneration followed testing. Owned server/browser cleanup is recorded in `cleanup.json`.

Ready for root/Astra triage. **Do not grant musical acceptance or the DOM-latency gate.** Build association, actual parity, irregular endpoints, segmented frame preservation, busy cancellation/retry, genuine full cap lifecycle and the measured logical-memory/refinement budgets pass within the stated coverage. Production readiness, physical memory peak, broad browser/device coverage and the original unexplained browser closure remain unproven. No manual QA is assigned to the user.
