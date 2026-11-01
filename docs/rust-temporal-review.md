# Temporal v3 review — 2026-10-31

**Retain the reliability infrastructure; replace the core attribution strategy on the development branch. Do not adopt v3 as an overall musical upgrade or declare the recognizer complete.** Use a DIFFERENT requested Sol6.1 xhigh builder for the substantial repair below. Root can handle the two small correctness/test issues separately, with transferred ownership and a new freeze. Neither those fixes nor the next architecture comes with a promise that it will pass the frozen musical gates.

## Scope and provenance

This separate Astra high reviewer worked alone. Writes are limited to this report and ignored `target/temporal-review-v3/`. No product edits, global rebuild, full corpus evaluation, browser run, holdout inspection, commits, deployment, database or credentials access occurred. No manual user QA is assigned.

Read the complete temporal evidence report, delivery handoff/snapshot, previous musical repair review and DSP fixes report, and current `voice_evidence.rs`, `polyphony.rs`, `spectrum.rs`, `segments.rs`, `lib.rs`, and `tests/musical_repair.rs`. Independently hashed the frozen executable and every entry of its source inventory: executable matches, zero inventory mismatches.

- Native: `72583af9dcd8ef1cd7fbe81280ba1de181c4c25aed0f2bdcfd4ce55424c977f0`.
- Canonical source: `693181a3abec04e8320f8243a5245fa646d50e7af55d2e4bbe64f2dfdc04126f` (handoff/root association).
- Actual regenerated WASM: `21dea8a5a69485d776bb42b8d0901a47b4f27c6a02d3245598ccae3e584bf5e9` (root-provided association, not remeasured here).

Root reports byte-identical rebuild, 238 fast tests and three fixture checks. Builder reports 37 release functional tests. These establish build/reliability evidence, not musical acceptance. Independent Sol tester owns `validation/temporal-candidate/**` and `docs/rust-temporal-validation.md`; its full DEV and actual WASM/browser corroboration is still required. I neither waited for nor duplicated it. The temporal report's historical statement that WASM had not been regenerated is superseded by root's handoff, not silently treated as current.

## Prioritized findings

### P1 — Shared-source attribution remains structurally conditional on an already clean carrier

Locations: `src/voice_evidence.rs:134–204,269–300`, `src/polyphony.rs:77,155–163,213–250` (paths relative to `crates/fretbloom-analysis/`).

The model estimates a common lower-voice amplitude ratio from unshared partials. Known previous pitches exclude contamination, but unknown voices cannot do so. Relative spread above .10 rejects a carrier except for exactly two ratios with one independently changing partial. Six confirmations must then retain a consistent parent/shape. Static fitting begins with weights equal to observed mixture magnitudes; subsequent joint amplitude fitting changes scalar amplitudes of these already chosen shapes. It is not joint estimation of several source envelopes from the observations.

This is verified against the builder's fixed measured DEV traces, not merely a theoretical concern: C6→C4 at .71 has carrier ratios .910/.585/.581 and spread .187; C6→G4 spread .170. Capo0 madd11→E4 spread .138. They fail precisely the spread/exception conditions in the code. C4's measured fundamental is .04297 against carrier C3 .0495, so an absent spectral peak or one louder global cutoff is not the explanation. Production C6 remains `[48,52,57]` instead of `[48,52,57,60,67]`; both madd11 takes remain incomplete. Trace diagnostics use A440/zero tuning and preceding diagnostic fits, whereas production uses estimated tuning and filtered fits: the trace supports the mechanism but is not an exact instrumented production decision log for every cell.

A measured peak is not proof of a separate string. Conversely, failure of this particular carrier estimator is not proof of physical indistinguishability. The deliberately signal-identical singleton/multiple-source construction correctly demonstrates the narrower impossibility. Independently generated attacks/envelopes and real string measurements require a defensible source model, not claims of unique recovery for arbitrary harmonic signals.

**Ownership/action:** major attribution package below. Do not widen .10, reduce six hops, or add special C6/madd11 tone rules as the proposed solution. The latest gains coexist with more aliases, worse pitch-class/identity counts and two extra boundaries; no evidence supports an indiscriminate relaxation.

### P1 — Live-window agreement currently hides shared sustain failure

Location: `tests/musical_repair.rs:262–290`; relevant state/admission in `voice_evidence.rs:269–300` and mono override in `lib.rs`.

The seam test asserts true two-note recovery only at full-recording .8 and 1.2 seconds. Later it compares rolling output with full output, without checking the known generated notes. Both can be wrong.

I reproduced its six-second construction through the copied frozen CLI, then ran only its late 2.56-second window (start 3.2). `target/temporal-review-v3/probe.py` retains exact commands; `summary.json` retains binary, input and output SHA256s, raw JSON and stderr remain adjacent. The whole output is `[57,69]` at .8,1.2,2.08 but `[57]` at 2.72,3.36,4.0,4.6. The late window emits only 57 at local .64,.8,1.0,1.4,1.8. At absolute 4.0 the constructed upper fundamental still has amplitude approximately `.06*exp(-.65*3.7)=.00542`; its mathematical source has not released. This does not prove that its independent contribution is identifiable from every late crop. It does prove the existing parity assertion cannot establish sustained two-note recovery.

**Small root package:** rename/document the existing assertion as agreement and add explicit truth accounting over the generated active interval, including late windows. Preserve it as a known failing recovery control until a justified model passes; do not weaken the expected set or extend the reported release backward. Test delayed-onset and cropped-onset cases separately, paired with the singleton and signal-identical ambiguity control. **Major builder:** explain any unresolved late-window identifiability using measured residuals and source assumptions; do not use matching failures as acceptance evidence.

### P2 — Phase innovation aliases a half-cycle reversal to no change

Location: `voice_evidence.rs:311–328`, unit test below it; related phase assertion in `spectrum.rs`.

`abs(sin(residual_phase))` is zero at both zero and pi. A half-cycle residual therefore satisfies the stable-phase `<.10` path used for damping and fails the change-corroboration thresholds. This is a concrete mathematical defect if the quantity represents phase innovation, as its documentation and consumers state.

Extracted the exact function into ignored `phase.rs`, compiled with installed Rust 1.89.0 (no Cargo/shared target), and supplied stable 440 Hz amplitudes/frequencies with prior .00/.06 s and current .42 s. Innovation: no shift=0; .5 rad=.4794255; pi=1.029e-13; 2pi=2.156e-14. The source's existing .5-radian test misses this. The spectrum test also uses `sin(error).abs()`, which cannot exclude a pi measurement error; this observation does not establish that its FFT implementation actually produces such an error.

**Small root package:** define a circular distance that is zero only modulo 2pi, choose compatible units deliberately, and add failure-then-pass cases around zero, ±pi, 2pi and wrapping, preserving the unstable-frequency/weak-amplitude guards. Strengthen phase-measurement assertions likewise. Do not silently reuse numeric thresholds across different units. Run focused bright-singleton/damping controls and the independent whole-DEV checks after the change. Its musical effect is unmeasured; this is not a claim that a phase fix repairs C6 or improves aggregate scores.

### P1 acceptance blocker — Rejection gains do not establish robust real transcription

Locations: `voice_evidence.rs::current_support`, `lib.rs` support filtering, `segments.rs::finish`; fixed whole-DEV results in `docs/rust-temporal-evidence.md`.

Candidate-specific projections, uncertain/absent distinction and the absence mask are useful and correctly carried into median smoothing. However, production Rock 4.21 now contains `[64,69,83]`, whereas v2 recovered `[64,69]`; Jazz 3.61 still contains `[45,57,60,64,68]` against `[57,60,64]`. Real reference-empty counts fall 125→113,86→74,252→232, but true frames removed are 16,47,46 (SS also gains 55). Reduced emissions are not automatically correct releases. The scalar fit/support and projection gates cannot by themselves assign an overlapping partial to its generating string.

No trace here proves the exact gate responsible for every extra or lost true frame. Keep the failures as scored disagreements, not an invented diagnosis of each. Require per-voice residual/onset/release explanations in the major package, paired true-decay/noise controls, and the same whole recordings. Do not restore a historical attack-raised floor or select shorter favorable scoring crops.

## Decision and substantial next implementation

Retain local prominence, measured fundamentals, short-input abstention, cancellation, finite endpoints, separate physical confirmation/routing, absence barriers, honest alternatives and frozen provenance. Retain v3 as a development comparison artifact, alongside d3e0 and d933. No mode earns an unqualified replacement recommendation: even timed mono TP falls 1025→1012 relative to v2. Musical F1 79.40 and recall 68.53 remain below 85/80; exact register sets are only 184/2059. PC exact 87.13 passing does not compensate. Primary compatibility 58.81, root 88.10, quality 82.05 and boundary F1 50 remain inadequate. Boundary FP rises 4→6 with TP unchanged at three. The small denominator warrants caution about magnitude, not dismissal of regression.

Repeated framewise ownership repairs plus this temporal gate now give sufficient evidence to change the model, not continue tiny threshold iterations. This is a structural limit of the delivered estimator, not a proof that all bounded DSP approaches fail or that a neural model is required.

### Package A — Joint multi-voice temporal decomposition (different Sol6.1 xhigh builder)

Exclusive ownership after root transfers it: `src/{voice_evidence,polyphony,spectrum,lib}.rs`, new private decomposition module if needed, and focused new/generated tests. Leave public schema, chord rules, scorers, datasets and thresholds untouched. One builder should own this connected fit; do not split shared amplitude/state types across concurrent builders.

Implement a bounded rolling fit of measured complex partial tracks for up to six voices. Reuse long-window frequency anchors and short-window complex observations. Keep several plausible voice sets through shared-peak ambiguity rather than requiring a clean carrier before proposing an upper voice. Bound the candidate sets and iterations explicitly. Compare singleton and multi-voice explanations on the same observations, including explained shared bins and leftover energy.

Use a low-dimensional per-voice envelope: an amplitude trajectory with attack/release state and a smooth harmonic damping term, with phase advance anchored to preceding observations. Jointly estimate each voice's contribution at shared frequencies; the measurement is the sum of complex contributions, not a separate copy of full mixture magnitude per comb. Penalize added voices and rapid envelope changes; evaluate prediction on later hops that were not used to estimate the current envelope. Permit attacks without forcing every harmonic to share phase or decay. Do not grant a model independent arbitrary coefficients at every partial/time, which would fit both aliases and true sources equally well.

This directly addresses C6/madd11's contaminated carrier and the present greedy admission circularity. Use the competing singleton explanation to constrain Rock83/Jazz extras and brightness changes. Derive attack/continuation/release from each fitted contribution and prediction error, not only total pitch-band energy; preserve a demonstrated absence barrier. Integrate the same model evidence into YIN override so routing cannot erase supported extra voices. Delayed octave success and all 244 exact dim/half-dim frames are retention controls.

The initial implementation can use existing Rust dependencies and bounded arrays/scratch; no external model or new library is justified yet. Keep history within existing live warm-up/context, streaming the fit through native 600-second inputs. The current 24-hop history fits .64-second warm-up. Existing .32-second future reserve must cover FFT context plus confirmation; count actual combined support, not just the new algorithm's nominal window. If a useful fit requires longer context or persistent cross-call state, return that concrete API/latency conflict to root before changing the protocol.

### Package B — Integration and independent acceptance

After A freezes, a different validation owner keeps the existing independent-run scope. Root owns artifact generation/runtime integration; the DSP builder must not regenerate shared artifacts concurrently. If segment smoothing needs changes, transfer `segments.rs` as a separate sequential package with explicit boundary/overlap counterexamples; do not flatten strums simply to reduce boundary FP.

Required failure-then-pass controls: C6 missing C4/G4 and both madd11 missing defining/register tones; the late-decay control above; clean Rock target without 83 and Jazz targets assessed independently from extras. Fixed DEV examples diagnose repair, but whole-corpus results decide acceptance. Add generated transposed/register/gain/phase/attack-spacing/independent-decay versions with known sources, including three-to-six overlapping voices; pair with bright/tilting/vibrating single strings, detuned and resolved-adjacent pairs, tonal noise, quiet decays, real gaps and reattacks. Preserve signal-identical constructions without impossible physical-source-count assertions. Require truth and stream identity as well as rolling/full agreement.

Run all existing 51 synthetic DEV inputs in all three modes, all three whole real DEV recordings, all twelve supplemental inputs with unchanged scorers and denominators. Compare against all frozen baselines; report every new extra and lost true frame, family/register/capo groups, onset/offset and harmonic boundaries, dedicated negatives separately from reference-empty margins, routing and duplicates separately from union scores. A predeclared joint-fit-only versus integrated-release ablation can attribute effects; no broad threshold search. Unmet gates remain unmet even if all fixed examples improve.

No new training data or weights are presently authorized or necessary for the proposed implementation. If analytical envelopes cannot distinguish measured multi-string evidence from single-string variation, the next justified data package is separately recorded isolated-string attacks/decays and known mixtures across instruments/players/rooms, with documented rights and recording provenance. Use it to estimate general envelope variability, not chord-label templates or copies of DEV voicings. Keep it separate from immutable DEV/holdout. A learned model becomes a conditional option only after such data and a measured failure of the simpler joint model; specify training/test separation, redistribution license, weight/download size, Rust/WASM inference operations and measured CPU/memory before selecting one. No dependency/model recommendation or unverified licensing claim is made here.

## Resource, lifecycle and interpretation audit

The new state is local to `analyze`; history is bounded and reset on silence. No cross-call phase continuity is fabricated. Candidate and refit loops check cancellation. Targeted continuation projections are bounded but have no callback inside each sample loop; observed native cancellation is good, while browser worker cancellation needs independent measurement. The code retains full frame vectors and a smoothing clone, not a full spectrogram. Incremental allocation accounting (2,018,760 bytes) and 600-second RSS (115,492 KiB) are builder measurements, not proofs of total WASM/JS budgets or worst-case workload. The allocation test uses one short constructed scenario, not an allocator-independent upper-bound proof.

Retain native 600-second input and existing native time/memory limits; browser max300s, WASM ≤128 MiB, application-owned JS ≤96 MiB, live compute p95 ≤500ms and refinement ≤120s. Measure actual new WASM on named hardware, live windows, seam positions and 300-second refinement, including cancellation and retained-buffer disposal. Existing native 600s wall 10.89s offers headroom but does not predict browser performance. No rerun of these long tests was performed here.

Root's segmented JS cap and Stop hover fixes are outside this DSP review and already proven on actual v2 browser. Keep per-segment `ceil(samples/1920)`, legitimate 3751 and maximum3813 across64 segments, unchanged2MiB metadata; do not drop edge frames. Independent tester rechecks v3. Native feature timing/schema remain unchanged; changing note values legitimately changes chroma/MIDI features.

Gates keep their original meaning. Exact MIDI is register-sensitive; pitch-class sets hide missing doubled notes. The exact-MIDI 80% value remains a diagnostic target rather than being relabeled a newly binding gate. Correct equivalent alternatives and unknown are useful behavior but do not receive primary credit. All244 dim/half-dim frames are exact-note retention evidence; their unambiguous-primary denominator is zero. C6's missing G and madd11's missing defining tones are implementation failures regardless of naming equivalence. Real annotation disagreements may include room tails, pickup/MIC offsets and incomplete labels; no independent acoustic adjudication here converts them to correct predictions. Preserve original scores and state that uncertainty separately.

Explicit product scope clarification is needed for a demand to select one primary name among acoustically equivalent identities, support altered/ninth/thirteenth names absent from the current vocabulary, or recover one guitar from arbitrary full-band mixes. These are naming/API or source-separation scope questions, not reasons to remove difficult tests or excuse the verified note omissions. No such clarification is needed to continue the already justified note-evidence repair.

**Objections:** no chord-specific fills, no lower thresholds presented as architecture, no neural dependency on faith, no label/scorer/holdout edits, no accepting common-mode seam failures, no alternative-to-primary credit transfer, and no completion claim based on unit tests, byte parity or browser reliability alone. Root should reconcile the independent tester's forthcoming evidence before adoption. Review ready.

## Root reconciliation after independent v3 testing

The completed independent report is `docs/rust-temporal-validation.md`. Its
fresh native identity, 108 actual native/WASM comparisons, genuine five-minute
capture/refine/save/reload, cancellation/retry, and 3,751/3,813-frame preservation
checks pass. Its musical scores corroborate the builder's failures and the late
sustain counterexample above. Product input inventories remained unchanged
through that handoff. The tester reported an accidental root `dist` rebuild;
this is a disposable build-output change, not an attested source/artifact change.

**Latency interpretation correction:** the original architecture at
`docs/rust-live-architecture.md` specifies **p95 window compute <=500 ms** and
**p95 steady event delay <=1.5 s**. These distinct targets were also recorded in
`docs/rust-live-validation.md` before the v3 work. The latest tester incorrectly
applied the 500 ms compute threshold to DOM delay, following root's ambiguous
brief. Its completed run measured compute p95 190.3 ms and the documented
signal-frontier-to-DOM estimate p95 560.7 ms, with no skipped windows. These
observations pass the original respective targets. No threshold or measurement
is changed; the report's stricter DOM failure is not an original acceptance
failure. Its clock/status mapping, shared-host load and acoustic-onset limitations
remain. The original tester report and raw evidence are preserved as delivered.

Measured refinement, WASM memory and application audio ownership also pass their
existing bounds within the tester's stated coverage. This does not resolve
musical acceptance, physical browser-memory limits, broad-device coverage or the
historical browser-closure cause. There is no justification to shorten FFT
context, remove future support or alter the UI solely to satisfy the misapplied
500 ms DOM threshold.

### Root correctness/test fixes before the replacement fitter

After the tester released the source freeze, root corrected `phase_innovation`
to return the shortest circular distance in radians. Its 0.10/0.15 sine cutoffs
were converted to `asin(0.10)`/`asin(0.15)` angular boundaries, preserving the
near-zero decisions while distinguishing half-turn reversals. The focused test
failed first at pi (reported innovation approximately 1e-13), then passed for
zero, small signed shifts, signed pi, full turns and wrapping. Weak-amplitude and
unstable-frequency guards remain tested. The spectrum phase assertion now also
checks circular distance, so a pi measurement error cannot pass unnoticed.

The rolling/full seam test is explicitly named as agreement despite the known
shared-sustain miss. A separate generated-truth test checks both whole and cropped
contexts against the active [57,69] sources. It is marked with an explicit known
failure and was executed with `--ignored`: it still fails at the late cells.
The next fitter must pass it and remove that ignore; agreement alone is not
accepted as recovery. Its fixture, truth intervals and expected sets are unchanged.

An isolated pinned Rust 1.89.0 build passed all 37 ordinary release functional
tests and clippy with warnings denied; rustfmt completed. Two existing diagnostic
tests and the new explicitly failing sustain control are excluded from the
ordinary suite and are not counted as passes. Logs are `.tools/root-phase-*`
and `.tools/root-sustain-known-red.log`. The initial shared-target attempt failed
on a zero-byte cached rlib; the fresh `.tools/root-phase-target` build succeeded
without changing product code to work around the cache. The initial direct
rustup proxy invocation also failed before testing; retained logs distinguish it
from the actual pinned red test.

The phase-only native snapshot is `target/root-phase-fix/{analyze-pcm,snapshot.json,source/}`,
binary SHA256 `57d8100c0dc11c90330ce74a8d237a811d42141e54e6b5d140da52603f045f53`.
This internal snapshot still labels its schema-compatible output rust-dsp-3;
its source/binary identity, not that shared label, distinguishes it from the
independently evaluated v3. Full-DEV effects remain to be evaluated independently.
Generated WASM was intentionally not updated for this intermediate repair; normal
source verification must reject the mismatch until the next integrated freeze.
The replacement candidate must advance the engine version before publication.

### Joint-candidate rejection and next evidence boundary

The subsequent Package A implementation is frozen as rust-dsp-4 and rejected
for adoption: see `docs/rust-joint-attribution.md` and
`target/joint-attribution/handoff.json`. Root independently rehashed all 21
current source/test inventory entries against its archive with zero mismatches;
the copied executable matches
`d5634791f1af0ebae31176c922424d01bec042ff6dae8a806d134d1940acde72`.
Its complete source and executable remain under
`target/joint-attribution/integrated/` for review. Four unignored functional
failures, lost dim/singleton retention, unresolved C6/madd11 and multi-second
native live-window cost prevent promotion. The generated v3 WASM remains
unchanged; the rejected v4 source is frozen for diagnosis, not an approved app
build. No production or daily-driver build channel has been changed.

The next decision needs evidence beyond another threshold adjustment. Root is
requesting a separate architectural review and an isolated measurement of a
published lightweight transcription model, not adopting a neural dependency on
reputation. The official [Basic Pitch repository](https://github.com/spotify/basic-pitch)
provides the candidate and converted model formats; the official
[TypeScript repository](https://github.com/spotify/basic-pitch-ts) documents its
browser-facing implementation. The probe must pin upstream artifacts, inspect
their licenses and preprocessing, evaluate the same DEV inputs without altered
scorers, and identify possible training overlap with GuitarSet. Rust/WASM
feasibility and actual resource evidence must be distinguished from Python/native
reference performance. No model weights, new dependencies or experimental
runtime enter product manifests during this isolated evaluation.
