# Independent frozen-candidate validation — 2026-10-31

Independent Sol 6.1 high tester; no subagents, implementation edits, detector tuning,
fixture/label/scorer edits, holdout audio/annotation access or detector runs,
production, database, credential, deployment, commit or push actions.
Read `/home/xtra/AGENTS.md`, architecture, DSP-fix, live-review and latest
live-validation reports before execution. This report identifies **new candidate
execution**, not historical c2/abd evidence. Final UI acceptance is pending root's
R1/R2 handoff; no such handoff arrived during this independent scope.

## Tested identities and source association — PASS

All evidence paths below are relative to
`validation/candidate/runs/fc324-independent/` (ignored bulky immutable evidence).

- Generated source: `fc324cd4b474f4b8f0264fd25ebe78f5c4253741e9054f16d00e0259f1f9eb24`.
- Actual WASM: `52205fce031db775a99495a6e4c815e70ca4064af3f3fbe1e328fb0a4b8affa2`.
- Fresh native: `d3e0e9bc8bd73a034cf36ebded05979dbed68f63a3539a37fb5c9001437bcccd`.
- Engine: `rust-dsp-2`; Node 24.22.2; explicit Rust/Cargo 1.89.0;
  actual browser Chromium 143.0.7499.4.

`prepare.py` performed a **fresh** `cargo build --locked --release -p
fretbloom-analysis --bin analyze-pcm --target-dir <owned native-target>` with
explicit RUSTC/RUSTDOC. `association.json` includes commands, tool executable
hashes/versions, and before/after source inventories. Every builder snapshot
core source/test/manifest/lock/toolchain entry matched **before compilation**.
Fresh native bytes exactly match the builder's copied executable. Inventories
remained unchanged. Normal `scripts/wasm-verify.mjs` passed without bypass;
`verifier.stdout`, `build.stdout`, `build.stderr` preserve raw diagnostics.
Generated assets were preserved. This establishes source association through
compilation and inventory, not merely matching engineVersion.

`context/` is a newly copied candidate worker-test fixture, not the historically
remapped `.tools/wasm-checkpoint/context`. Its before/after source inventories
match; there are no UI-final acceptance claims for this pre-handoff copy.
Only its copied harness path guard/default root were adapted to candidate-owned
storage; no app/core/scorer changes. `additional-provenance.json` records DEV
real input hashes and decoder/Python tool hashes. `evidence-inventory.json`
hashes 1,409 retained evidence/source files, excluding native build intermediates
and dependency caches. Original reports/results remain untouched.

## Independent musical evaluation — EXECUTED, ACCEPTANCE FAILS

`music.py` executes the original synthetic runner/scorers unchanged, the original
real scorer unchanged and original extended runner/scorer unchanged. All 51
synthetic DEV files ran in **auto, monophonic and polyphonic** modes; all three
real GuitarSet DEV recordings and all 12 supplemental DEV fixtures completed
without execution/schema/scorer errors. `music-runs.json` locates each run;
all streams, raw predictions, harmony primary/alternatives, stderr and decoded
PCM are retained. Synthetic `run.json` contains exact input, command and tool
inventories. Completion is not an accuracy pass.

The stock real runner verifies every split's audio before selecting DEV. The new
owned real runner instead checks only DEV WAV/annotation hashes, decodes with the
same FFmpeg arguments and calls the unchanged strict wire validator and real
scorer. No holdout audio or annotation file is opened. Extended output placement
alone is redirected to the owned directory; its detector options/scoring are
unchanged. No fixture is regenerated or relabeled.

Synthetic settled auto findings independently reproduce the builder's final
numbers:

| Measure | Independent result |
|---|---:|
| Early / sustained mono exact | 99.63% / 92.03% |
| Poly exact MIDI sets | **137/2,059 (6.65%)** |
| Poly exact pitch-class sets | 1,806/2,059 (87.71%) |
| MIDI precision / recall / F1 | 95.24% / **66.95%** / 78.63% |
| Compatible primary harmony | **59.17%** |
| Harmonic boundary F1 | 60.00% |
| Reference-empty false-positive frames | 0/1,745 |

Separate timed stream P/R/F1 (includes attacks/releases/overlaps):

| Mode / stream | P / R / F1 |
|---|---:|
| auto / mono | 100.00 / 88.90 / 94.12% |
| auto / poly | 91.24 / 66.00 / 76.59% |
| monophonic / mono | 100.00 / 88.90 / 94.12% |
| polyphonic / poly | 92.44 / 68.18 / 78.48% |

Explicit mono refuses multi-voice inputs in 2,527/2,527 reference frames. All modes
have zero cross-stream duplicate-pitch frames. Neither fact excuses missed notes.

Real full-recording label agreement (unchanged imperfect GuitarSet annotations):

| Recording | Mono P/R | Poly P/R | Reference-empty frames emitting notes |
|---|---:|---:|---:|
| Rock2 solo | 100.00 / 28.29% | 59.13 / 93.58% | **125/175** |
| SS3 comp | 98.21 / 30.14% | 70.39 / 60.41% | **86/135** |
| Jazz3 comp | 100.00 / 25.79% | 58.29 / 76.85% | **252/382** |

Wrong-stream poly emissions on mono-reference frames are 1,602 / 606 / 686;
lowest-note bass agrees in only 238/1,178, 641/2,151, 146/898 frames. Performed
comp quality accuracy is SS 14.16%, Jazz 3.48%. Real note-event onset+offset
precision is especially weak (Rock 23/420 = 5.48%, SS 40/584 = 6.85%).
This is not reliable note transcription, timing, routing or harmony recognition.
No listening adjudication has established that reference-empty predictions are
correct; no full-band or human-listening acceptance is claimed.

Supplemental counts retain exact-register versus pitch-class and primary versus
alternative distinctions:

| Fixture (capo 0 / 3) | Exact MIDI | Exact PCs | Compatible primary | Compatible alternative | Abstained |
|---|---:|---:|---:|---:|---:|
| Amadd9, each 60 frames | 0 / 0 | 60 / 60 | 60 / 60 | 0 / 0 | 0 / 0 |
| Cadd11, each 60 frames | 0 / 0 | 60 / 60 | 60 / 60 | 0 / 0 | 0 / 0 |
| Amadd11, each 60 frames | 0 / 0 | 0 / 0 | 0 / 0 | 60 / 60 | 60 / 60 |
| Bdim7, each 61 frames | 61 / 61 | 61 / 61 | 0 / 0 | 61 / 61 | 61 / 61 |
| Bhdim7, each 61 frames | 61 / 61 | 61 / 61 | 0 / 0 | 61 / 61 | 61 / 61 |
| E5, each 62 frames | 0 / 14 | 62 / 62 | 62 / 62 | 0 / 0 | 0 / 0 |

Concrete musical counterexample: Amadd9 capo 0 expects MIDI
`[45,52,59,60,64]`; at 0.45s the actual notes are `[45,52,59,60]`, omitting E4,
while primary Amadd9 is accepted with all expected **pitch classes** supported.
The lower E3 masks the missing E4 in pitch-class scoring. Amadd11 correctly
retains uncertainty/compatible alternatives but that is zero correct primary
frames. Dim/half-dim note recovery with abstention is also not primary identity
accuracy. Examples and full alternatives are preserved in the supplemental report.

These findings are ready for root's separate Astra high review. This tester did
not launch a reviewer or tune any detector threshold.

## Actual final WASM/native and worker endpoints — PASS

`context/validation/live/runs/2026-10-31T15-09-23.093Z/` contains the actual
Playwright/Vite worker harness run and raw native/WASM outputs/PCM. It tests
all three modes × both spellings × A=432/440/446 × full/rolling/silent/60ms
controls: **72/72 parity comparisons passed** with exact identities, timestamps,
labels, MIDI, stream structure and alternatives.

The reused comparator permits RMS tolerance; a second owned **stricter** audit
(`audit.py`, `strict-parity.json`) independently rechecks all 72 saved pairs,
allowing <=1e-5 only score/margin/cents/tuning-offset/chroma evidence. RMS,
timestamps and other numeric fields must match exactly. All 72 pass that audit.
The 60ms controls are retained unpadded, with conservative abstention; parity
alone does not prove short-input pitch accuracy.

Actual ingestion/analysis workers accepted ordered PCM/end boundaries, stopped,
exported and fully refined both off-grid controls through unchanged strict parsers:

| Samples | Retained PCM bytes | Exact final feature time | Refined completeness |
|---|---:|---:|---|
| 65,536 | 262,144 | 2.7306666666666666s | refined |
| 61,696 | 246,784 | 2.570666666666667s | refined |

No worker errors. The harness exits **2** because unrelated integration/load/UI
areas are explicitly pending, not because parity/endpoints failed. Both stopped
snapshots were `live`; both refined results valid. No microphone or tab-capture
claim follows PCM-port endpoint evidence. Servers and browser owned by this run
closed in its normal finally cleanup.

## Pending post-handoff scope — NOT VALIDATED

Root has not released R1/R2 UI ownership. No moving-UI run or current frontend
build is presented as final. Root should resume this tester after handoff for:
actual built/static mic/worklet → live → Stop/refine → playback → save/reload/delete;
controlled delayed R1 anchoring and queued stale-status/patch cases, empty
pre-PCM pause/resume, annotation save/JSON/removal; actual retained 300s R2
restore/playback/save integrity-worker allocation accounting, corrupt/quota
rollback and bounded workers; actual synchronous 300s DSP Cancel <=250ms after
handler with lifecycle trace and successful preserved-PCM retry; cap-aware paced
300s polyphonic run with full retained refinement; per-call compute and p95
signal-to-visible latency. Prior 87,514,144-byte builder estimate is not adopted.
No JS-buffer counter is called total process RSS or total browser memory.

Actual Chromium tab-audio SIGSEGV remains root-owned environment investigation.
Neither broken launch was retried or replaced with microphone evidence. No user
QA is assigned. Broader historical journeys were not rerun without a relevant
change. No final product or musical acceptance is implied by the passes above.
