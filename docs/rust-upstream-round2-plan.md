# Upstream recognition round 2 — Opus proposal, joint decision and outcome

2026-10-31. Author: Opus 5.5 (lead). Active engine stays rust-dsp-3.1 (source `f75b55eb…`, native `d3bec4e4…`, WASM `c9217873…`). This file is the lead's record. Astra's challenge lives in `docs/rust-upstream-round2-review.md`; builder and tester reports in `docs/rust-upstream-round2-implementation.md` and `docs/rust-upstream-round2-validation.md`.

## 1. New lead measurements (before the proposal)

All with the preserved baseline binary `target/event-stability-baseline/analyze-pcm` (sha `d3bec4e4…`), outputs in `target/upstream-round2-lead/`.

**The vibrato fixture is a ±64-cent vibrato, not "mild".** The generator (`target/event-stability-builder/acoustic_controls.py:15`) adds `.006*hz/5*sin(2π·5t)` *cycles* of phase. Its derivative is `.006·2π·hz·cos(…)`, a ±3.77 % frequency swing = **±64 cents at 5 Hz**. The truth (one MIDI note for 1.6 s) is still musically right, but the excursion crosses the semitone midpoint on every swing.

**Global tuning on the 171 acoustic controls** (`probe/`): all 18 estimates with |offset| > 8 c are vibrato (57, 69 → +47.5 / +49.6 c) or 45-beating (+15.5 c). A symmetric ±64 c swing wraps to ∓36 c on the 100-cent circle, so its circular mean points at the wrap (±50 c). The estimate is not "slightly off"; it is the worst possible value.

**Interaction with the candidate gate.** `polyphony.rs:59` keeps a fundamental only if `|cents − tuning| ≤ 45` with no wrap. Every tuning therefore leaves a 10-cent hole centred at `tuning ± 50`. At tuning 47 the hole is [−8, +2] c — exactly where in-tune notes sit. That is the 0.84 s loss (0.718 c measured, −46.7 c from tuning).

**But tuning is not the whole story.** Vibrato controls whose tuning came out `None`/≈0 (45, 81) still fragment every 0.1 s (45: gaps; 81: alternating harmonics 92/94). So: tuning inference *and* candidate matching *and* missing pitch continuity all contribute; fixing any one alone does not keep a ±64 c note whole.

**Real recordings do not hit the wrap** (`real-tuning/`): GuitarSet DEV 3, Guitar-TECHS 25 completed (3 exit 3 cap failures as before), supplemental 12 — every estimate within ±15 c. Real-data exposure is wide vibrato/bends (>45 c), not tuning.

**Sustained upper voice (late_voice 69 over 57).** `voice_evidence.rs:291-304`: strength rises only when this hop shows an *innovation* (upper partials change unlike the lower envelope predicts) and falls by 1 every hop otherwise. Innovation detects onsets. A steady two-voice mixture produces zero innovation, which the code reads as evidence of absence, so a proven voice expires one hop after it stops changing. Separately, `polyphony.rs` combs copy observed amplitudes, so a lower comb fully consumes shared partials; residual witnesses for the octave are zero by construction.

## 2. Opus proposal (sent to Astra)

- **A1 Stable-peak tuning.** Tuning votes only from peaks whose frequency is stable between two probe windows ~50 ms apart (e.g. < 3 c change). Modulated peaks cannot vote. No votes → `None` (0) as today.
- **A2 Continuation candidates with peak ownership.** A note present in the previous frame may seed its own MIDI comb from a fundamental peak within a per-hop continuity window of its last frequency (≈ ±50 c), bounded by a max deviation from its anchor (≈ ±75 c), even outside the tuning gate. A peak claimed by a continuation cannot also seed a neighbouring semitone in that frame. Internal cents stay unclamped; output cents keep the ±50 clamp.
- **B Hold on no-innovation.** An independent voice (strength ≥ 6) keeps its strength while its fundamental is still a prominent measured peak, its parent is still active, and no *signed* offset evidence appears (upper partials falling below the lower-envelope prediction). Absence of change is not evidence of absence. New voices still need onset innovation; local support alone never admits anything.
- **Attack (beat vs re-pluck): out of build scope.** No discriminating upstream measurement exists yet; 3.2 failed this. Unresolved, not hidden.
- No contract, schema, limit, model or dependency change. All changes inside `polyphony.rs`, `voice_evidence.rs`, `lib.rs` of a disposable fixture.

Main risks I expect: A2 holds a note through a slide/legato semitone; B prolongs false octaves admitted at onset (harmonic-envelope drift, "tilt"); A1 removes a correct tuning on real recordings with slightly drifting attacks.

## 3. Astra exchange and joint decision

Astra (gpt-6-astra xhigh) review: `docs/rust-upstream-round2-review.md`, evidence `target/upstream-round2-review/`.

| Item | Opus proposed | Astra objection (with evidence) | Opus response | Joint decision |
| --- | --- | --- | --- | --- |
| Vibrato math | ±64 c symmetric | Exact −66.5 / +64.1 c; uniform sampling gives concentration 0.39 (would fail the 0.65 gate) — acceptance comes from windowed FFT sidebands + 4-phase probe sampling (0.82/0.84) | Concede the precision and the mechanism | Cause = wide FM + windowed peaks + gate hole + no continuity |
| Gate hole | Missing wrap | Hole is real, but per-MIDI absolute cents are not a wrap bug; blind mod-100 wrapping lets distant MIDIs share a peak | Concede | Optional separate ablation **G**: unique nearest-MIDI assignment within 50 c of the tuned lattice, deterministic ties. Never combined untested. |
| A1 stable-peak tuning | Build | Rejected: MIDI69 vibrato still reports +46.6 c (concentration 0.86) with the rule; a 2.9 c-stable peak can be a sideband. Raising concentration is uncalibrated; static −49…+49 c controls are correctly handled today | Concede fully | **Not built.** Tuning unchanged. If A2 needs a tuning repair to pass, stop and bring a separate falsifiable proposal. |
| A2 continuation | Build | Modify: track measured fundamental, immutable identity anchor, claim a peak only when the continuation survives admission, honour absence/silence, align `voice_evidence.rs:79` gate, test slides/bends/cold start/crops | Accept all; anchor = admitted MIDI's tuned nominal (cannot drift); per-hop continuity bounds catch abrupt legato | **Build as the only product-shaped candidate**, bounded, private state only |
| B hold on zero innovation | Build | Reject: (1) even/third-partial ramps of ONE source already give 28 false cells of 69/76 in baseline — B would prolong them; (2) **live calls are stateless 2.56 s windows**: an onset latch is gone once the onset leaves the window, so B cannot work in live without a contract change | Concede. (2) is decisive. I considered a stateless spectral-smoothness test instead, but the even-ramp bytes are identical to "added octave", so it would trade a sustain gain for new false octaves | **Not built.** Sustained-upper loss stays a named, unrepaired failure. Needs a stateless ownership/release measurement first. |
| Attack | Out of scope | Agree; keep counts, no new false attacks | — | Out of scope; reported only |
| Contracts | None | Agree; stateless calls, cents wire clamp, limits unchanged | — | No contract change |

**Joint decision:** build one disposable candidate = A2 (bounded continuation identity), with G as a separate ablation, unchanged tuning, strict admission/absence. Tester freezes Astra's control families and gates before seeing candidate results. Full DEV, all 28 Guitar-TECHS whole inputs, cost on WASM where executable. Reject if any claimed component fails truth, safety or cost gates.

## 4. Assignment and ownership

- Builder (gpt-6.1-sol xhigh): `target/upstream-round2-builder/**` (disposable source fixture copied from verified baseline, candidate tests inside it), `docs/rust-upstream-round2-implementation.md`. Must not read or tune against `validation/upstream-round2/**`.
- Tester (gpt-6.1-sol high): `validation/upstream-round2/**`, `target/upstream-round2-test/**`, `docs/rust-upstream-round2-validation.md`. Owns controls, truths, thresholds, scorer.
- Lead: this file, `target/upstream-round2-lead/**`. Astra released.
- Read-only for all: crates/**, Cargo.*, package*, src/**, scripts/**, Dockerfile, prior validation/evidence/docs, generated WASM.

## 5. Outcome (lead closeout)

**No adoption. rust-dsp-3.1 stays active. Nothing for root to integrate.** Both builds are preserved as rejected experiments in `target/upstream-round2-builder/frozen/{a2,g}` (A2 native `634f7890…`, G native `78627fa6…`).

Independent phase-2 test (`docs/rust-upstream-round2-validation.md` §Phase 2; 335/335 frozen controls per engine, frozen hashes unchanged):

| Strict vibrato passes | Baseline | A2 | G |
| --- | ---: | ---: | ---: |
| prelude | 26/36 | 22/36 | 29/36 |
| cold start | 26/36 | 22/36 | 27/36 |
| ±65 c | 4/24 | 3/24 | 8/24 |
| original fixture | 0/24 | 6/24 | 6/24 |
| 2.56 s crops | 0/6 | 0/6 | 0/6 |

- **A2 (continuation) — rejected.** 2,246 new false cells on vibrato and 573 in rolling windows; 73 unsafe inputs; slides and event controls regress. Continuity holds whatever was admitted, including overtone/sideband identities, so it amplifies upstream false admissions instead of fixing identity. The causal lesson: continuation is only safe once admission of the *right* fundamental is reliable; on FM-heavy windows it is not.
- **G (nearest-MIDI gate) — rejected, but the closest.** Leaves pluck/beating/tilt/neighbour/phase/seam/slide/static unchanged, removes 966 false vibrato cells and recovers 307, yet adds 313 false vibrato cells (7 unsafe inputs), 51 on negatives, and in the builder's quick pass 189 new reference-false cells on the 3 GuitarSet DEV recordings. Also ~6–14 % more compute.
- **Crops 0/6 for every engine**: no build fixes vibrato in live-sized windows.

**New finding for root (independently reproduced):** baseline 3.1 WASM already exceeds the live p95 ≤ 500 ms gate on a dense FM-sideband window (three ±65 c vibrato sources, 16 partials): p95 678 ms. Dense chords (196 ms) and two real GuitarSet DEV windows (245 / 365 ms) pass. This is an existing live-cost exposure, not caused by this round.

**What remains unrepaired (named, not hidden):** wide-vibrato fragmentation; sustained upper-voice ownership loss (B blocked by stateless live windows and by the even/third-ramp false-octave hazard); same-pitch re-pluck vs beating; C6/madd11 missing voices; palm-mic cap failure. Full DEV, Guitar-TECHS whole-input and browser checks were **skipped** because no candidate passed the cheap stage — not executed on doomed snapshots.

**Recommended next step (proposal only, not started):** the evidence points at admission, not continuity. Before more repair, measure *why* FM vibrato admits overtone/sideband fundamentals (e.g. 81 above 57, 69/76 under G) with a passive observer on the frozen vibrato controls, and separately decide whether the sideband cost exposure needs a bounded per-window peak budget. Any G-variant tuned on these results would be threshold shopping and is not recommended.

Children: Astra review, phase-1 tester, builder and phase-2 tester all completed and released. **No children active.** Lead wrote only this file and `target/upstream-round2-lead/**` (probe outputs of the baseline binary on the 171 acoustic controls and 43 real recordings; commands in §1). No active source, WASM, validation inputs, commits, pushes or deployments were touched; no lead processes remain.
