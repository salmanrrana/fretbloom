# Baseline wide-vibrato admission trace

2026-10-31. **Baseline FM false notes come through static residual admission, without temporal independence.** A harmonic source under wide FM yields several displaced maxima per partial region. The MIDI57 comb cannot own maxima outside its narrow frequency tolerances. Upper hypotheses collect those leftovers, pass the peak-count and improvement gates, and receive local support from the same modulated source. Tuning gaps sometimes remove57 altogether; they are not necessary for false69/76/81 admissions. No repair or candidate was built.

This is a passive causal trace of **nine preselected cells on five existing whole inputs**, not a corpus accuracy result. A2 and G remain rejected and were neither run nor rebuilt. All inputs have construction truth consisting of MIDI57 only. “Independent” below means the engine's numeric predicate, not independent physical sources.

## Freeze and reproducibility

Read round2 plan §5, review, validation, implementation and admission-trace-v1. Verified every file bound by `validation/upstream-round2/freeze.json`, its manifest, selected PCM hashes, active canonical sources and all preserved baseline snapshot entries. The initial disposable copy equals active `crates/**` byte-for-byte, including tests. Its uninstrumented executable is itself byte-identical to the preserved executable.

Selection [manifest](../validation/vibrato-admission-trace/manifest.json) frozen **19:29:01.360428 UTC**, first analysis **19:29:43.701061 UTC**, first instrumented analysis **19:30:22.466001 UTC** on 2026-10-31. No cell or logging range changed afterward. The manifest records exact input paths/hashes, construction parameters, cell indices, centers, reasons, saved membership and logging ranges. The original fixture is reused at its existing path bound by that same round2 manifest; no PCM was regenerated or cropped. Builder controls were unnecessary because the tester's saved baseline already emits all three requested upper identities.

| Identity | SHA256 |
| --- | --- |
| Baseline canonical source | `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9` |
| Initial complete source-copy inventory | `9a222e130a033b667374bdb3cd3aa2b3f20c46b59bbeb97f290d837aa567d74f` |
| Uninstrumented / preserved binary | `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8` |
| Instrumented canonical source | `8fa100510691200a9d42db55ab7919b2f593636f1a5e8ea20ae438ffd21891e3` |
| Instrumented complete source-copy inventory | `ceaea4ceb80e21de985c6d93fd5884536416739f0bc3d27d121893fb7484f7a0` |
| Instrumented binary | `a5cc7e66649c0e7d2f0ac8b157a7d913fab736469201a2967917ede474e76e26` |
| Frozen selection manifest | `544947ee0ad1a0bc6d53d894155a3f0b460ee71c366edb29dc0cb29caa9f8414` |

Inventory digests use SHA256 of ordered compact path→SHA256 JSON. Canonical digests use the existing ordered tools/sources convention, adding `trace.rs`; unchanged external build-script hashes supply canonical context but were not needed in the disposable Cargo source copy. [Identity before](../target/vibrato-admission-trace/identity-before.json), [build association](../target/vibrato-admission-trace/build-association.json), [final verification](../target/vibrato-admission-trace/summary.json).

## What the predicates actually establish

The 4096-sample Hann spectrum spans170.67ms; 5/7Hz FM produces broadened/interfering partial lobes rather than one instantaneous pitch per partial. The reused generator integrates the frequency trajectory and sums eight harmonics of **one** source. Calling a recorded maximum “FM/partial structure” follows that construction and the logged geometry; this trace does not assign an exact theoretical sideband order or claim an FFT implementation defect.

`polyphony.rs` considers any measured peak within45c of a tuning-adjusted MIDI as a possible fundamental. It selects the highest-norm comb per MIDI. The comb includes peaks within12c of integer multiples of that measured anchor (configured maximum eight harmonics). Admission then checks:

- Fundamental strength `(peak_amplitude / frame_max)^0.7 >= 0.10`. This is **original observed strength**, not residual fundamental strength.
- Each independent witness is a prominent peak with candidate weight>0 and residual>0.07, outside12c of harmonics1–64 of every active voice's weighted/clamped pitch. This geometry differs slightly from the measured comb anchor.
- If the candidate's weighted/clamped pitch lies within25c of an active lower harmonic2–32, it needs at least two independent peaks and at least three matching peaks. **Matching counts peak slots, not distinct harmonic orders.** Otherwise a prominent residual fundamental>0.15 allows the singleton path with one independent peak.
- Improvement is the sum of positive squared residuals over matching peaks, at least0.005×total observed squared magnitude. The candidates below win that competition and their fitted amplitude/norm ratios are approximately1, above0.10. This fit ratio is not a source-identity probability.

Temporal credit can bypass the independent-witness count only with strength≥6 and its parent active. **Every relevant upper admission at the nine selected cells has temporal strength0 and `temporal_voice=false`.** The observer logs real innovation votes; it does not manufacture supporting projections or history. Short support instead measures energy/coherence near an admitted band, which can be real for an overtone of the same source. In particular, with fewer than three measured partials, a good fundamental alone can return `Confirmed`.

## Findings at each frozen cell

A/B/C/D refer respectively to (a) harmonic/FM maxima acting as fundamentals, (b) residual fitting/ownership, (c) short support/temporal behavior, (d) tuning/gates. E, physical source ambiguity, is discussed below. Rounded frequencies are Hz, distances cents; full-precision operands and stages are in the linked per-cell JSON. Cells are20ms with centers at `480*i+240` samples.

**1. `prelude_clean`, cell15, [0.30,0.32), `vib-57-65-5-0` — clean contrast.**57 wins with eight independent/matching peaks, improvement2.011965>0.010060, local support confirmed. Its selected fundamental is near nominal220, at−0.316257c. Singleton explained/all=1 and tight/all=1; only57 survives raw, median, confirmation and output. This is the stable prelude, before FM starts at0.7s. [Evidence](../target/vibrato-admission-trace/prelude_clean.json).

**2. `fm81_76_start`, cell38, [0.76,0.78), `vib-57-65-5-0` — A+B+C.**57 wins first at anchor216.048802Hz.76 anchors at653.544155Hz (gate distance15.062575<45),81 at872.066150Hz (15.679141<45). After57 and69 are active,76 still has two witnesses:653.544155 and1311.515559, residuals0.274127/0.134231, respectively16.125/21.979c outside57's ownership center. Their initial57 comb weights are zero; anchor differences14.358/20.212c also exceed12.76 passes explained=true, independent2≥2, matching3≥3, fundamental0.274127≥0.10; wins0.093163>0.009554. Its three matches are **h1,h2,h2**.

81 then passes the same rules with original fundamental0.211613, independent2, matching3; witnesses872.066150/1751.266115 have residuals0.211613/0.096135 and57 ownership offsets17.464/24.530c. Improvement0.054022>0.009554. Its matches872.066150/1739.913/1751.266115 are again **h1,h2,h2**. Both supports confirm;81 has h1 coherence0.82416 but h2 only0.18418, yet measured2/good1/fundamental_good permits confirmation. Temporal strength0. Singleton57 cannot clean up the fit: explained/all0.790146<0.96. Raw69 at this cell is removed as a short run, whereas76 and81 survive confirmation/output. The first incorrect source inference is residual admission after the true comb, not continuity. [Evidence](../target/vibrato-admission-trace/fm81_76_start.json).

**3. `fm69_start`, cell41, [0.82,0.84), same input — A+B+C.**57's216.050011Hz comb wins.69 anchors at429.271136Hz, gate42.737226<45. Its fundamental residual is effectively zero after57, but the fundamental test still uses original0.529164. Two *higher* witnesses854.394025/1279.231532 retain0.284931/0.196545, lie−17.851/−21.041c from57's ownership harmonics, and have zero initial57 weights. Explained=true, independent2≥2, matching4≥3 allows improvement0.119816>0.009601. Both first projections pass (coherence0.98652/0.96693), so support confirms; raw/median/confirmed include69. Temporal does **not** authorize it: lag12 fundamental change0.019545<0.10 and matched2<3, best0; lags18/21 fail similarly.76's evaluated lag6 change0.568493 passes its0.209575 threshold but only two changes match, still below3. Static admission succeeds despite failed temporal tests. [Evidence](../target/vibrato-admission-trace/fm69_start.json).

**4. `fm76_sustained`, cell70, [1.40,1.42), same input — A+D+C; no true comb active.**Tuning is null/0. The measured214.306504Hz fundamental is−45.393470c, rejected by the45c gate;427.591289Hz also fails69 at−49.525273c. This is a gate gap under wide FM even with no bad global offset.76 now wins first from655.788818Hz: fundamental0.233591, independent2/matching2, singleton=true, improvement0.066453>0.009933.81 later wins0.045833. These are not residual leftovers *after57* at this cell:57 never becomes a candidate.76 and81 supports return `Uncertain`, but both are continuing with uncertainty_before1<2, so the cached bridge promotes them for this second uncertain hop.76 h1 coherence−0.411758 fails;81 h1−0.999355 fails. Both survive raw/confirmation;76's final saved run is[0.76,3.62). This cell shows how an admitted upper identity survives root-gate loss and short uncertainty, without temporal credit. [Evidence](../target/vibrato-admission-trace/fm76_sustained.json).

**5. `fm7_69_76`, cell53, [1.06,1.08), `vib-57-65-7-0` — A+B+C.**57 is retained continuously in the saved output, and wins at223.256867Hz.69 anchors450.449130Hz (gate40.632799<45); witnesses450.449130/904.833614/1360.358228 retain0.524719/0.281829/0.193070, at+15.544/+23.090/+27.050c outside57 ownership. All have zero initial57 weights. Explained=true, independent3≥2, matching4≥3, fundamental0.524719; improvement0.392034>0.011840.76 anchors657.773950Hz and gets three witnesses at−30.937/−42.642/−25.035c from57 ownership, improvement0.101839>0.011840. Its weighted pitch is too far from57's third harmonic for explained=true, so singleton=true. Three matches again mean h1,h2,h2. Short supports confirm (76 h1 good, h2 coherence0.20289 fails, but measured2 allows good1). Temporal strengths0;69's evaluated lag12 matched0, fundamental change0.009804<0.106862. All57/69/76 survive. Root omission and bad tuning are unnecessary. [Evidence](../target/vibrato-admission-trace/fm7_69_76.json).

**6. `fm7_81`, cell71, [1.42,1.44), same input — A+B+C, singleton path.**57 remains active at weighted−30.447715c.81's876.916753Hz maximum passes the gate at−6.076358c. Its weighted comb frequency puts it **25.262105c** from57's fourth harmonic, just beyond the explained-partial `<25` test. Thus singleton=true: **one** independent peak suffices. That fundamental residual0.210214>0.15, original fundamental0.210214≥0.10, and witness ownership distance24.371356>12 permit admission; matching3 is h1,h2,h2.81 wins0.065054>0.011734 with active57/69 and no temporal credit. h1 coherence0.93833 is good; h2's weaker half is0.0309×peak amplitude, failing the0.12 bound. The measured2/good1 rule still confirms it. Raw/median/confirmed81 survive as[1.42,1.48). The specific first false inference is the singleton residual-ownership path, not a temporal innovation. [Evidence](../target/vibrato-admission-trace/fm7_81.json).

**7. `cold_bad_tuning69`, cell12, [0.24,0.26), `vib-57-65-5-1` — inherited A+B, then smoothing; D context.**Global offset+46.671101c selects57's225.976476Hz maximum. At this exact cell69's452.988012Hz candidate exists but, after57 wins, independent0<2 rejects it. Raw is only57; there is no direct69 admission to explain here. Its cached support is nevertheless confirmed (coherences0.81950/0.96666), so absent69 is false. Raw69 on both neighboring cells11/13 supplies2/3 median votes; median and confirmation restore it into the saved[0.20,0.30) run.

The already-frozen neighborhood gives the upstream cause: at11, original69 fundamental0.549614 but residual0; witnesses1362.636705/1818.646707 retain0.206875/0.162231 and sit13.085/14.797c outside57 ownership. Independent2, matching5, explained=true yield0.157718>0.010080;13 repeats0.157679>0.010081. Temporal credit remains false. Bad tuning is present and shapes lattice selection, but it is **not proved necessary** for these false neighbors; no tuning ablation was run. This distinguishes an emitted cell from a fresh admission. [Evidence](../target/vibrato-admission-trace/cold_bad_tuning69.json), [logged neighbors](../target/vibrato-admission-trace/runs/2-instrumented/trace.jsonl).

**8. `original_gate_hole`, cell42, [0.84,0.86), original fixture — D first, then raw A admissions that do not serialize here.**Tuning+47.453800c makes220.091260Hz, nominal+0.718002c, miss57 by46.735798>45 and56 by53.264202>45.57 support is actually confirmed, but cannot create a fitted candidate. Raw68/69/75/76 pass static gates with57 absent; for example69 wins0.296552>0.011126, fundamental0.474943, independent3, matching3, singleton=true. Median leaves only69, then the<3-hop confirmation removes it: **no note is emitted at this selected cell**. The true57 run ends0.84. This reproduces the earlier gate-hole mechanism and prevents mistaking raw sideband hypotheses for saved false events. [Evidence](../target/vibrato-admission-trace/original_gate_hole.json).

**9. `fm3_clean`, cell60, [1.20,1.22), `vib-57-65-3-0` — clean modulated contrast, B rejection works.**57 anchors218.503458Hz and owns all eight observed peaks, winning1.537789>0.007689. Upper69/76/81 candidates **do exist** with original strengths0.516905/0.336956/0.245774. After57, each has independent0<2;76/81 also match only2<3. No temporal override (all strength0; evaluated matches0). Local57 support confirms; singleton explained/all1 and independent=false permits57 replacement, despite tight/all only0.93259. Raw/median/confirmed/output contain only57 at this cell. The same wide excursion at a different rate/phase can therefore pass because the measured harmonic geometry is coherent, not because upper hypotheses disappear. Other cells in this whole file still fail; this is a cell contrast only. [Evidence](../target/vibrato-admission-trace/fm3_clean.json).

## Ambiguity and a future discriminating measurement

**E: no separately synthesized upper source exists in these construction labels.** The trace demonstrates that narrow comb residuals, peak counts and local band presence are insufficient to establish one. It does not prove a unique physical source decomposition from PCM: a finite harmonic waveform can have alternative source descriptions. The even/third-partial-ramp ambiguity from round2 remains a mandatory counterexample; no new ambiguity experiment or source-separation oracle was introduced here.

A future measurement would need to distinguish **coherent modulation of one harmonic family** from a real independent upper source even when both leave comparable residual peaks. It would need to track which physical partial regions supplied witnesses, demonstrate how duplicate FM maxima and consumed fundamental magnitude are handled, and show calibrated evidence beyond short band presence. It must preserve real delayed/sustained octaves and fifths, independent releases and neighboring notes, and survive onset-free2.56s crops, cold starts, static detuning, even/third ramps, beating/phase cancellation, clean wide-FM cells and the original gate gap. This is a measurement requirement, not a proposed gate, tuned threshold or implementation. None of the nine cells requires unresolved construction truth to explain its false labels; alternative physical decompositions remain a general limit, not the measured admission cause here.

## Output identity and bounded observation

**PASS: four-way full-output byte identity on every input**: saved round2 baseline = freshly run preserved executable = uninstrumented copy = instrumented copy. Full JSON equality includes all note/event fields, features and warnings; stdout/stderr also match, all exits0, no temporary partials. Full PCM hashes and separate compact-JSON note/feature/warning hashes are in [summary](../target/vibrato-admission-trace/summary.json).

| Input | Complete output SHA256 |
| --- | --- |
| `vib-57-65-5-0` | `d7085b1bf41982e13012a970a794c7db8bcffe40dfb8c676bc04366edeb57974` |
| `vib-57-65-7-0` | `fc74b9d98ecacb9b0481136d59515f4be506c33cc78020b13870b1c5f8922682` |
| `vib-57-65-5-1` | `24033dfe50b6e49864b75edee90ac870a087b656e2f434e280868e1a06e81ba4` |
| `original-57-0.03-0.0-vibrato` | `135fe2016ba1b5956641f406513cd2837ff00e650d2f6b67acae9c7857585797` |
| `vib-57-65-3-0` | `1bd63390ba8613c34f2037bf760ee868bf84d8d7bde4222ad0e0a75cd9d5ed34` |

Observer reused admission-trace-v1 and added passive candidate-gate/option frequencies, comb cents and active-owner frequencies. No extra DSP, support or innovation calls; no branch/threshold/decision changes. It records cached support once where actually evaluated, long/short measured peaks, candidate IDs/weights, residual witness IDs, active owners, temporal strengths/parents/shapes/votes, greedy improvements/rejection operands, post-fit support, singleton operands, raw/median/confirmed sets and actual boundaries. Regular and bass fits are explicitly tagged; attribution above uses the regular fit. [Complete diff including trace.rs](../target/vibrato-admission-trace/instrumentation.diff).

Logging is restricted to frozen neighborhoods:73 observed frames, across whole-input analyses. Raw JSONL **17,827,218 bytes (17.00MiB)**; derived per-cell JSON plus summary **2,049,912 bytes**; combined **19,877,130 bytes (18.96MiB)**, below256MiB. Each process additionally enforces32MiB. All recorded numeric values are finite. The full inputs still run normally outside logging ranges. No timing or throughput claims are made.

Only this new report, `validation/vibrato-admission-trace/**`, and `target/vibrato-admission-trace/**` were written. Scripts are prepare, run, instrument, augment, extract and verify; evidence includes source inventories, disposable source/build, both binaries, build logs, per-run commands/UTC/hashes/stdout/stderr/JSONL/outputs and per-cell extractions. Final checks reverify active source, copied lockfile, frozen inputs/manifest/scripts and instrumented inventory. The initial verification script had a context-path assumption corrected before its successful final run; no inference was repeated or changed.

Builds used direct Rust1.89.0 cargo/rustc/rustdoc, `--locked --offline --release -j2 -p fretbloom-analysis --bin analyze-pcm`, with both manifest and `CARGO_TARGET_DIR` inside the owned target directory. The copied toolchain file did not trigger a proxy and was retained. Exact build argv/environment are in [build command](../target/vibrato-admission-trace/build-command.json). One-time order from repository root:

```sh
python3 validation/vibrato-admission-trace/prepare.py
# Direct-toolchain Cargo command above, before instrumentation.
python3 validation/vibrato-admission-trace/run.py copy
python3 validation/vibrato-admission-trace/instrument.py
python3 validation/vibrato-admission-trace/augment.py
# Same direct-toolchain Cargo command, after instrumentation.
python3 validation/vibrato-admission-trace/run.py instrumented
python3 validation/vibrato-admission-trace/extract.py
python3 validation/vibrato-admission-trace/verify.py
```

One analysis process at a time. All owned commands have exited; no persistent workers. Skipped: repairs, threshold sweeps, new candidates, A2/G builds/runs, broad scoring, builder-control analysis, performance measurements, generated WASM/browser/live paths, production, installs, secrets, git creation/worktrees/commits/push/deploy and servers. No child agents. Other agents' owned paths were untouched. [Evidence inventory](../target/vibrato-admission-trace/evidence-inventory.json) binds the report, scripts and finished evidence; source/build identities are bound separately above.
