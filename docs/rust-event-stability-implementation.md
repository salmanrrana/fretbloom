# Rust event stability implementation — frozen rejected candidate

2026-10-31. **Do not adopt rust-dsp-3.2.** The bounded reconstruction/harmony changes are implemented and frozen, but the acoustic attack contract fails, two new truth tests remain red, real transcription still misses notes, and additional whole-input cap failures occur. This is an implementation and diagnostic handoff, not independent acceptance or an approved integration. No further tuning followed the freeze. Root must retain/restore active 3.1 or coordinate a separate reviewed change; generated WASM remains 3.1 and normal source verification correctly fails.

## Scope and identities

One implementation agent worked alone, without children, commits, pushes, downloads, training, original holdouts, browser/app builds, production, databases, secrets or sibling-checkout changes. Required architecture, support-path supplement, temporal root corrections, live architecture and root reattack report were read. Root’s timeline fix was read-only. Rejected v4 and Basic Pitch were not integrated or rerun.

Owned product writes are exactly `crates/fretbloom-analysis/src/lib.rs`, `voice_evidence.rs`, `segments.rs`, new `crates/fretbloom-analysis/tests/event_stability.rs`, and this report. All remaining implementation fixtures, sources, drivers, logs and outputs are under ignored `target/event-stability-builder/**`. No `polyphony.rs` extension was needed or made: the existing fitter admission remains a conservative prerequisite; this package does not pretend that projected shared energy establishes independent ownership. No public type, option, feature format, manifest, dependency, limit or generated artifact changed.

- Candidate canonical source SHA256: `b7181b2d1a362c0a546b9b24532c3b218f3b06187a00362885545947bac09e50`.
- Frozen native SHA256: `13fa38b9fda0e7d612428061390a391e5f9914b0032c7e5c860ec01a77defbd3`.
- Active baseline canonical source: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`; native `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`.
- Unchanged generated WASM: `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`.

The root’s ordinary preservation fixture `target/event-stability-baseline/{source,analyze-pcm,snapshot.json}` remains untouched. The before inventory has 25 entries; all archived bytes were checked. Candidate `target/event-stability-builder/frozen/{source,analyze-pcm,snapshot.json}` contains 31 source/test/build inputs, exact per-file hashes, canonical association and build command. `baseline-phase-core-equivalence.json` checks all ten archived core modules: phase source and active 3.1 differ only in ENGINE_VERSION. Stored full-DEV baseline comparisons therefore use exact phase-corrected core outputs, explicitly labeled historical rust-dsp-3 (`57d810…`), not a claimed fresh 3.1 broad rerun. New acoustic/resource baseline calls actually use the preserved 3.1 binary.

## Implemented behavior and limits

Frames retain four additional private MIDI bitsets: raw confirmed support, raw uncertainty, pre-support fitter/YIN admission, and measured attack. Existing measured absence remains separate; no bit means not measured. Admitted notes plus a raw uncertainty bit identify the existing at-most-two-hop allowance without laundering it into raw confirmation. No dense spectra or projection history are added per frame. Fitter omissions are never reinserted from current-band confirmation. The admission mask is an algorithmic prerequisite, not a new physical ownership proof.

The smoother keeps only adjacent original frames, instead of cloning the full recording. It removes isolated uncorroborated proposals but cannot fill an omitted fitter hypothesis from neighboring votes. Demonstrated attacks survive smoothing. Ordinary three-hop pitch confirmation still backdates to the first retained measured cell. Measured absence and silence remain barriers; route changes do not restart physical duration confirmation. A witnessed/confirmed short interval has a separate bypass, proven only with injected frame evidence here: this is **not** adequate acoustic validation for brief notes and is another reason not to adopt the package.

Local attack measurement uses four disjoint 20 ms projections of the measured fundamental and up to three harmonics. At least three partials including the fundamental must have a roughly doubled amplitude after a stable preceding cell, with the largest adjacent rise at that boundary. This is a narrow 6 dB excitation witness, not a calibrated model of all plucks. Matching frequencies use the existing support tolerances; another admitted current/previous comb at the same partial or inside the local Hann main lobe vetoes ownership. Global RMS/flux, chord names, phase reset alone and shared harmonic energy cannot vote. Measurements retain their amplitudes, exclusivity and witness masks in test diagnostics; only the final mask is retained in frames. There is no time debounce, global bridge or threshold search.

The first experiment reused stationary long-window leakage subtraction and missed all six low-register positives. Direct projections with a resolution guard avoid assuming a stationary amplitude across excitation; using the existing measured fundamental avoids a separate nominal-frequency anchor. These focused measurement corrections precede the single corpus freeze. They still do not meet the attack gate. The final rule was not changed after its failures, and no Guitar-TECHS labels were used to set it. Shared voices without exclusive measured partials abstain; low-register and complete-path misses remain open. An abrupt gain/excitation ambiguity is not uniquely resolved by this witness.

Physical membership is confirmed before projecting honest mono/poly spans. An admitted multi-note fit now vetoes singleton YIN replacement even when its peaks tightly fit a harmonic comb; no sticky mono suppresses that evidence. Auto routes each actual cell, explicit mono refuses poly cells, explicit poly retains singleton fits, and a same-pitch attack closes/reopens at its observed boundary. The wire still has no shared physical-event ID: true route changes split serialized spans. No cross-stream copying or whole-event initial-route assignment was added. Stricter routing and removal of unsupported fills cause real regressions recorded below.

Harmony confirmation is now streaming with at most three pending 20 ms cells. The ordinary 60 ms root/quality rule still confirms across bass/null/alternative changes without merging those boundaries away. Brief chords are demoted before final coalescing and the 3,000 output cap. Final identity includes kind/reason, complete primary identity, **every ordered alternative**, each supported/missing PC vector, and bass MIDI/null. Adjacent equal semantics merge only at equal endpoints; evidence scores and margins use minima, recomputing evidence levels, including bass and all alternatives. This avoids carrying an earlier stronger score over a weaker cell. Unknown/silence/unpitched/bass/second-alternative changes remain observable. There is no unbounded raw-event array. Honest final overflow still errors; 4,000 per note stream, JSON/input limits and cancellation remain.

## Focused tests and failed acoustic gates

Pinned Rust 1.89.0 actual cargo/rustc/rustdoc use `target/event-stability-builder/check.sh`, explicit RUSTC/RUSTDOC and owned CARGO_TARGET_DIR. Commands and status files are retained. `cargo test --locked --release -p fretbloom-analysis` **fails** (15 library passes, one acoustic failure, two existing diagnostic ignores); Cargo stops before integration targets, so each integration target was also run explicitly. Existing analysis 8/8, DSP reliability 9/9, musical repair 11/11 ordinary with the known sustain ignore, and vocabulary 1/1 pass. The new complete-path event test fails. Thus 44 ordinary tests pass and two fail across separately executed targets, with three existing ignores; this is not an all-green test run. Full `clippy --locked --all-targets -- -D warnings`, pinned rustfmt check, and diff whitespace check pass. The known ignored sustained-source truth control was explicitly run and still fails at window 3.2/local 1.4, expected [57,69], observed [57]. Expectations/ignore were not changed.

New state tests pass attack splitting and unit-only short admission; omission despite confirmed shared-band support; exact new-voice route boundary and explicit-mono refusal; unchanged measured-release protection; complete alternative/PC/bass identity; weakest-evidence aggregation; short-chord demotion; final-equal demotion coalescing across 6,000 raw cells; exact cap and cap+1; bounded tail/layout and cancellation. Existing quiet release, bright singleton, short input and irregular 65,536/61,696-sample endpoint checks remain in the passing targets. These frame tests do not establish physical truth.

The final local measurement matrix has 24 pluck positives across MIDI 45/57/69/81, two gains and three phases; 18/24 detect, all six MIDI 45 cases miss. All 120 paired local vibrato/beating/tilt/neighbor/phase confounders have zero witness hits. Raw final rows/components are printed in `cargo-test.log`; earlier experiment logs/JSON are preserved. The positive test stays red rather than accepting the misses.

After freeze, owned `acoustic-controls/manifest.json` froze all 171 full-pipeline PCM controls **before** either binary ran: 144 paired controls plus 27 whole/cropped seam variants. Source events, PCM hashes, generator hash and all 342 statuses/commands are retained. All execute; complete-path recovery is weaker than the private measurement alone:

| Complete PCM category | Cases/engine | Baseline attack cases | Candidate attack cases | Candidate extra/lost note cells |
| --- | --- | --- | --- | --- |
| pluck | 24 | 0 | 12 | 18/2 |
| vibrato | 24 | 6 | 6 | 798/806 |
| beating | 24 | 0 | 0 | 12/38 |
| tilt | 24 | 0 | 0 | 0/2 |
| neighbor | 24 | 0 | 0 | 350/476 |
| phase | 24 | 0 | 0 | 34/2 |
| seam | 27 | 0 | 18 | 0/0 |

“Attack cases” above means an emitted target-pitch onset within 21 ms of the constructed boundary, not a measured-witness counter. The six vibrato onsets already occur in baseline and remain defects, despite zero local witness hits. Strong vibrato can cross pitch-admission boundaries. Neighbor controls add 82 extra note cells in the candidate with unchanged lost cells; they do not prove independent ownership. Seam truth has zero extra/lost cells in both engines, but candidate still misses all nine MIDI 57 reattacks (18/27 recovered); whole/crop agreement would conceal this. The failing integration test stops at MIDI 57/1.38s with one continuous [0,2.6) event. The all-case driver continues to record the remaining counterexamples. No shifted timing, cropped acceptance score, or physical source-count assertion for identical unisons is used.

The immutable eight independent controls were run with the exact supplied evaluator, manifest SHA `54a2021223d8a2a810ae0e1183b24016e29fc15b4cf3e7474958293d01f62ee8`, exact PCM and original labels/scorer. All eight complete. Zero regression holds for currently exact stable/dropout/long/noise notes/events. Existing adjacent-reattack extra event, late octave loss and palm defects remain. Chord/bass loses one additional true cell and one onset+offset match:

| Control | MIDI exact/nonempty | PC exact | Extra/lost cells | Onset TP/pred/ref | Onset+offset TP (old→new) |
| --- | --- | --- | --- | --- | --- |
| decay_timbre | 370/370 | 370 | 0/0 | 2/2/2 | 2→2 |
| gap_vs_dropout | 330/330 | 330 | 0/0 | 2/2/2 | 2→2 |
| adjacent_reattack | 235/235 | 235 | 0/0 | 3/4/3 | 3→3 |
| late_voice | 259/400 | 393 | 36/112 | 1/9/2 | 0→0 |
| chord_bass_silence | 217/370 | 367 | 50/107 | 7/17/7 | 6→5 |
| palm_attacks | 249/260 | 249 | 9/11 | 32/48/32 | 18→18 |
| noise_negative | 0/0 | 0 | 0/0 | 0/0/0 | 0→0 |
| long_stable | 21600/21600 | 21600 | 0/0 | 24/24/24 | 24→24 |

Noise exact-set accuracy has no nonempty denominator; no note emission is observed across its 500 empty frames. The long control retains 24/24 attacks and offsets with 21,600/21,600 exact nonempty cells. Fewer events alone is never credited.

## Full unchanged DEV evaluation and deltas

| Intended scope | Actual calls | Completed |
| --- | --- | --- |
| synthetic51 | 153 | 153 |
| real3 | 3 | 3 |
| extended12 | 12 | 12 |
| joint20 | 60 | 60 |
| guitar28 | 28 | 21 |
| event8 | 8 | 8 |

All broad calls use one frozen binary and unchanged inputs/scorers. They are builder-run diagnostic evidence after focused NO-GO, **not** the independent acceptance root requested after handoff. No Basic Pitch or original holdout runs occur. `full_dev.py` imports unchanged evaluator functions and redirects only binary/output roots; original hashes are verified. `all-input-events-status.json` records every input’s exit, event totals and command; synthetic success command strings are explicitly reconstructed from the unchanged runner and retained successful run/log/raw records. No missing output has a fabricated score. All stdout/stderr and raw results are retained.

The synthetic settled auto summary changes note P/R/F1 from 94.36/68.53/79.40% to 94.73/68.39/79.44%; MIDI exact remains 184/2059 (8.94%), PC exact 1794→1795/2059. Root 88.10→88.39%, quality 82.05→82.12%, compatible primary 58.81→58.86%, boundary F1 remains 50%. These do not meet original music gates; recall worsens while precision improves. All 244 dim/half-dim supplemental exact frames remain. C6/madd11 missing defining/register tones, real extras and shared sustain remain unresolved. The unchanged original score files retain family/capo groups, separate-stream metrics and boundary denominators.

Exact 20 ms frame deltas on matching **completed** scopes follow. Gained/lost true and added/removed extra are separate pitch-cell counts. The full per-input/per-MIDI changed-frame rows, exact MIDI/PC denominators, empty-reference counts and continuous detected MIDI-set runs versus serialized routes are in `comparison/*.json`. Those continuous runs are detector set-union continuity, not physical-string truth. Dedicated synthetic negatives and the noise control remain separate from reference-empty margins in real recordings.

| Scope/mode | Matched/intended | Gained true | Lost true | Added extra | Removed extra | Wrong-stream frames | Duplicate frames |
| --- | --- | --- | --- | --- | --- | --- | --- |
| synthetic/auto | 51/51 | 0 | 46 | 0 | 72 | 22 | 0 |
| synthetic/monophonic | 51/51 | 0 | 3 | 0 | 0 | 0 | 0 |
| synthetic/polyphonic | 51/51 | 0 | 46 | 0 | 72 | 0 | 0 |
| real/auto | 3/3 | 84 | 87 | 216 | 178 | 1709 | 0 |
| extended/auto | 12/12 | 0 | 6 | 0 | 10 | 3 | 0 |
| event8/auto | 8/8 | 0 | 1 | 0 | 0 | 195 | 0 |
| joint20/auto | 20/20 | 0 | 0 | 0 | 3 | 629 | 0 |
| joint20/monophonic | 20/20 | 0 | 0 | 0 | 0 | 0 | 0 |
| joint20/polyphonic | 20/20 | 0 | 0 | 0 | 3 | 0 | 0 |
| guitar28/auto | 21/28 | 395 | 1853 | 3287 | 5335 | 24743 | 0 |

Wrong-stream here is the explicit auto truth activity rule; zeros for explicit modes are not a claim about auto routing. Original synthetic/real scorer outputs retain richer separate-stream metrics. Guitar-TECHS aggregate is incomplete; only the matching completed observations above permit frame deltas. Its pickup/MIC timing, brief events, uncertain EOF offsets and room-tail labels remain agreement uncertainty, not waived errors. No alignment shift, favorable crop, filename truth or alternative-to-primary credit transfer was used.

### Exact-MIDI union event timing on matched completed scopes

The unchanged real-audio event matcher supplies these additional micro-counts: onset <=50 ms; offset <=max(50 ms,20% reference duration); one-to-one matches; overlapping same-MIDI intervals merge but adjacent attacks remain separate. This supplements each original scorer without changing its denominators or tolerances. `timing-comparison.json` retains every per-input result. Failed outputs are excluded from these **conditional** counts and remain failures above.

| Scope/mode | Matched inputs | Baseline onset TP/pred/ref | Candidate onset TP/pred/ref | Baseline onset+offset TP/pred/ref | Candidate onset+offset TP/pred/ref |
| --- | --- | --- | --- | --- | --- |
| synthetic/auto | 51 | 118/286/182 | 114/302/182 | 93/286/182 | 88/302/182 |
| synthetic/monophonic | 51 | 16/16/182 | 16/16/182 | 14/16/182 | 14/16/182 |
| synthetic/polyphonic | 51 | 118/282/182 | 114/298/182 | 93/282/182 | 88/298/182 |
| real/auto | 3 | 312/1477/457 | 321/1488/457 | 163/1477/457 | 171/1488/457 |
| extended/auto | 12 | 41/67/52 | 39/66/52 | 36/67/52 | 34/66/52 |
| event8/auto | 8 | 71/105/72 | 71/106/72 | 55/105/72 | 54/106/72 |
| joint20/auto | 20 | 28/139/53 | 28/139/53 | 22/139/53 | 22/139/53 |
| joint20/monophonic | 20 | 14/29/53 | 14/29/53 | 6/29/53 | 6/29/53 |
| joint20/polyphonic | 20 | 28/103/53 | 28/103/53 | 26/103/53 | 26/103/53 |
| guitar28/auto | 21 | 2428/12212/3240 | 2422/13467/3240 | 1682/12212/3240 | 1554/13467/3240 |

### Every whole Guitar-TECHS observation

| Full source | Audio seconds | Exit | Wall seconds | Mono/poly/harmony events or error |
| --- | --- | --- | --- | --- |
| P1_chords_Set1_maj_directinput | 152.000000 | 0 | 3.60 | 12/455/695 |
| P1_chords_Set1_maj_micamp | 152.000458 | 0 | 4.60 | 4/1381/1957 |
| P1_chords_Set4_min_directinput | 152.000000 | 0 | 3.37 | 1/474/750 |
| P1_chords_Set4_min_micamp | 152.001375 | 0 | 4.41 | 2/899/1273 |
| P1_chords_Set1_dim_directinput | 152.000000 | 0 | 4.70 | 6/407/653 |
| P1_chords_Set1_dim_micamp | 152.000458 | 0 | 6.79 | 2/1010/1608 |
| P1_chords_Set1_Maj7_directinput | 204.000000 | 0 | 6.43 | 7/522/860 |
| P1_chords_Set1_Maj7_micamp | 204.000417 | 3 | 5.95 | analysis limit exceeded: result JSON exceeds envelope allowance |
| P1_chords_Set1_m7b5_directinput | 200.000000 | 0 | 5.36 | 4/777/1060 |
| P1_chords_Set1_m7b5_micamp | 200.000333 | 3 | 7.16 | analysis limit exceeded: result JSON exceeds envelope allowance |
| P1_singlenotes_allsinglenotes_directinput | 552.000000 | 3 | 9.82 | analysis limit exceeded: too many harmony events |
| P1_singlenotes_allsinglenotes_micamp | 552.000375 | 3 | 17.30 | analysis limit exceeded: too many note events |
| P2_chords_Set1_maj_directinput | 155.000000 | 0 | 2.94 | 22/339/663 |
| P2_chords_Set1_maj_micamp | 154.999542 | 0 | 2.86 | 26/272/570 |
| P2_chords_Set4_min_directinput | 155.000000 | 0 | 2.62 | 16/268/548 |
| P2_chords_Set4_min_micamp | 154.997500 | 0 | 2.60 | 17/209/486 |
| P2_chords_Set1_dim_directinput | 155.000000 | 0 | 3.16 | 21/369/695 |
| P2_chords_Set1_dim_micamp | 154.999542 | 0 | 2.98 | 24/350/686 |
| P2_chords_Set1_Maj7_directinput | 216.000000 | 0 | 4.42 | 21/699/1380 |
| P2_chords_Set1_Maj7_micamp | 216.000375 | 0 | 5.97 | 14/936/1688 |
| P2_chords_Set1_m7b5_directinput | 220.000000 | 0 | 4.53 | 20/694/1277 |
| P2_chords_Set1_m7b5_micamp | 220.000375 | 0 | 6.33 | 11/792/1552 |
| P2_singlenotes_allsinglenotes_directinput | 552.000000 | 0 | 7.56 | 246/1169/2357 |
| P2_singlenotes_allsinglenotes_micamp | 552.000375 | 3 | 14.11 | analysis limit exceeded: too many harmony events |
| P1_techniques_PalmMute_directinput | 552.000000 | 3 | 20.07 | analysis limit exceeded: too many note events |
| P1_techniques_PalmMute_micamp | 552.001417 | 3 | 48.72 | analysis limit exceeded: too many note events |
| P3_music_01_directinput | 72.500000 | 0 | 1.58 | 11/461/657 |
| P3_music_01_micamp | 72.501417 | 0 | 1.62 | 7/490/668 |

The four new failures are two JSON-envelope overflows (P1 Maj7 mic and m7b5 mic) and two harmony-event overflows (P1 single-note DI and P2 single-note mic). Original palm DI now encounters the note cap before reaching harmony, so its changed error is not a repair.

All three original full failures were actually executed at their original ~552-second lengths. The exact commands/input hashes/statuses are in the machine evidence linked below, and failed destinations are absent. Newly failed observations are regressions, even when a more faithful representation reaches a cap. Completed-only scores cannot conceal them. No cap, JSON bound, source length or event count was relaxed.

## Resources and compatibility

| Engine | Input seconds | Wall s | User/system s | Peak RSS KiB | Exit | Events mono/poly/harmony |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | 30 | 1.716 | 1.28/0.00 | 9484 | 0 | 0/24/17 |
| baseline | 600 | 21.221 | 18.36/0.09 | 115732 | 0 | 0/450/302 |
| candidate | 30 | 0.550 | 0.54/0.00 | 9452 | 0 | 0/17/24 |
| candidate | 600 | 11.471 | 11.40/0.05 | 115704 | 0 | 0/301/451 |

Machine: Linux-7.0.0-42-generic-x86_64-with-glibc2.39; CPU 	: 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz. `resources.py` uses the exact four-second harmonic generator/formula from the existing resource probe, repeats the same frozen bytes for 30/600 s, hashes them, and runs both preserved 3.1 and frozen 3.2 with the existing 110 s deadline. These include complete native process execution/serialization. Shared-host contention differs between calls; event content also changes, so the smaller timing is not an isolated speedup claim.

Frame size 128→192 bytes adds 1,920,000 bytes at 30,000 hops. The full smoothing clone is removed; only neighboring originals and fixed candidate/projection/tail state coexist. The separate allocation test measures existing history/FFT scratch peak 520,776 bytes and a conservative incremental frame/phase/stack allowance 1,977,984 bytes, below 2 MiB. It explicitly does not count existing history as newly introduced. This is layout plus bounded scratch accounting, not an independent exhaustive whole-WASM allocator proof. Measured native 600 s RSS is effectively unchanged. New per-hop work is bounded by at most six admitted voices × four partials × four 480-sample projections, plus fixed candidate loops; no growing pairwise event search is introduced.

Native SIGINT returns 130 with no output in baseline 3.72 ms/candidate 4.07 ms; partial f32 bytes, NaN and empty input each return 2 with no output in both. All native bounds pass for the measured fixtures. Browser 300 s, 128 MiB WASM, 96 MiB owned JS, compute p95<=500ms, steady event delay<=1.5s, refine<=120s and cancel<=250ms remain root’s unchanged gates and are **not measured here**. Native timings do not establish them. The existing .64s warmup/.32s future support and call-stateless contract are unchanged. Added projection support is 40 ms each side; chord confirmation is 60 ms, within existing support, but failed seam truth prevents an acoustic live correctness claim.

No app build was attempted with stale artifacts. `wasm-verify-expected-stale.log` records the normal expected refusal; the manifest was not edited to bypass it. Root owns any regeneration and actual new browser/native parity, capture, memory and independent acceptance. The candidate should not reach those adoption steps as a presumed fix merely because some structural tests pass.

## Reproduction, evidence and release

Recorded commands from repository root. Preserve completed evidence; choose new destination roots before any rerun:

```sh
# Actual pinned compiler paths and owned target are set by this script.

target/event-stability-builder/check.sh build --locked --release -p fretbloom-analysis --bin analyze-pcm
target/event-stability-builder/verify.sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/note-events/evaluate.py \
  /home/xtra/code/personal_projects/fretbloom-song-audit/target/event-stability-builder/frozen/analyze-pcm \
  target/event-stability-builder/controls-NEW
# Full original scorers with owned destinations, native controls and comparisons:

# full_dev.py, acoustic_controls.py, resources.py, compare.py, event_inventory.py

# refuse their existing directories; preserve this completed run.

```

Machine evidence: [frozen source and binary association](../target/event-stability-builder/frozen/snapshot.json), [all required input statuses and event totals](../target/event-stability-builder/all-input-events-status.json), [full frame deltas and coverage](../target/event-stability-builder/comparison/summary.json), [event timing](../target/event-stability-builder/timing-comparison.json), [native resource results](../target/event-stability-builder/resources/report.json), [final handoff](../target/event-stability-builder/handoff.json).

Exact evidence inventory and final byte attestation are `target/event-stability-builder/evidence-inventory.json` and `handoff.json`; commands, raw outputs, scorer hashes, before/after source snapshots and controls remain available there. All 31 frozen source inputs and 22 unowned preservation entries were rechecked; original evaluator/control/PCM hashes and both baselines remain unchanged. This report is itself hashed in the final handoff. No processes or servers remain from this work.

**Ownership is released.** Remaining blockers are measured attack identifiability and its full-path integration, safe continuation ownership for omitted hypotheses, acoustic brief-note validation, legacy missing/excess pitches, routing/offset regressions and additional full-source cap failures. Do not treat either successful execution or count reduction as transcription success. Root coordinates separate Astra review and independent Sol testing; this handoff requests no user manual QA and makes no adoption claim.
