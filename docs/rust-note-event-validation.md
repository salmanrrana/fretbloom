# Independent note-event baseline validation

2026-10-31. This is completed DEV baseline testing of the **frozen phase executable**, not candidate adoption or an accuracy claim about the active 3.1 app. All three original full-input limit failures reproduce. Eight new independent CC0 acoustic controls were frozen before inference; all completed, with real note/event failures retained. No product fixes, generated WASM changes, old corpus reruns, holdout access, downloads, models, commits or deployment were performed. No manual user QA is assigned.

## Identity and exact reproduction

Frozen executable `target/root-phase-fix/analyze-pcm` SHA256:
`57d8100c0dc11c90330ce74a8d237a811d42141e54e6b5d140da52603f045f53`.
All 19 archived source entries match `target/root-phase-fix/snapshot.json`.
Guitar-TECHS manifest matches `8e46904e4059ec5f1be62bd9d674a285050dfd14961aa272ae3ea32da42dd311`.
The binary still reports rust-dsp-3; this identifies the phase-corrected frozen source lineage, not a fresh run of the active 3.1 binary.

Commands use the original full PCM, 24,000 Hz, auto, A440, sharps, changing only the destination to `target/note-events/reproduction/`. No crops, limit changes, substitute inputs or acceptance retries. Every run exits **3**, retains stdout/stderr, and leaves **no result or partial file**. Timings include process startup and shared-host contention, not browser or algorithm-only latency.

| Input | Seconds of PCM | Wall seconds | Error |
| --- | ---: | ---: | --- |
| P1 single notes mic | 552.000375 | 16.00 | too many note events |
| P1 palm mute DI | 552 | 23.97 | too many harmony events |
| P1 palm mute mic | 552.001417 | 64.33 | too many note events |

Exact input SHA256s, in the same order:

- `2834a868306b90d967178340b94354dcc1509e54029940a771ac38a3f37367c4`
- `33d9c279a7078dc96a91541cd4928c80168a7ef6c870d0c440fd4b65b0577ea3`
- `a0a87b5371d53d5b0ed750c5601ba337c0e6692081e07231edf5b2968647add4`

[Identity evidence](../target/note-events/identities.json), [exact commands/status/duration](../target/note-events/reproduction/runs.json), [reproducer](../validation/note-events/reproduce.py).

## Isolated instrumentation and measured mechanisms

Ordinary disposable files, without `.git`, are copied from the exact frozen snapshot into `target/note-events/fixture/`. There is no shell worktree or checkout. Only passive diagnostics are added to archived source; inference, segmentation, options and numeric caps remain unchanged. All cap errors still occur. JSONL contains frame MIDI sets, route, RMS, tonal/silence state and decimal absence masks at raw, median and physical-confirmation stages, plus harmony cells reached before its cap and the exact cap location. No PCM is logged. Each frame stage is bounded to 30,000 rows (native maximum is 30,000 cells); support observations are bounded by the fixed 69-pitch candidate range per cell. Diagnostic files stay ignored.

The first `--locked` build correctly refused the archived whole-workspace lockfile with only one workspace member copied. The subsequent **offline fixture-only** build pruned unrelated package entries and version-disambiguation suffixes. Retained package versions, sources, checksums and normalized dependency names were independently checked against the original. No root manifest, lockfile, global flags or shared target directory was changed. [Lockfile diff](../target/note-events/lockfile.diff) and both build logs retain this limitation; this is not a claim of identical executable bytes.

Rust 1.89.0 uses the actual `/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin/{cargo,rustc,rustdoc}`, explicit RUSTC/RUSTDOC, and owned `target/note-events/build`. The first diagnostic executable is preserved as `target/note-events/diagnostic-v1-analyze-pcm`; [build association](../target/note-events/build-association.json), [source inventory](../target/note-events/fixture-inventory.json), [complete first diff](../target/note-events/instrumentation.diff), and [instrumentation creator](../validation/note-events/instrument.py) preserve its provenance.

Predeclared short compatibility controls were `decay_timbre`, `gap_vs_dropout`, `late_voice`. Their complete parsed wire outputs, including floating values/features, equal the frozen executable's outputs exactly. Independently reconstructed mono/poly run counts also match their serialized note counts. This supports compatibility on those controls, not a universal equivalence proof.

### Notes: route splitting is real, but is not the whole problem

These are **diagnostic routed runs reconstructed from all confirmed frames**, not published partial product results. The actual production path still stops on its first cap. Each pitch's counts and duration quantiles and separate start/end reasons are in [mechanisms](../target/note-events/mechanisms.json).

| Full input | Mono runs | Poly runs | Physical set-union runs | Route-only transitions | Poly median duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| single notes mic | 414 | 4,081 | 3,771 | 724 | 100 ms |
| palm mute DI | 849 | 3,721 | 3,747 | 823 | 80 ms |
| palm mute mic | 169 | 9,766 | 9,694 | 241 | 80 ms |

“Physical set-union” here means continuous detected MIDI membership regardless of route; it does **not** prove continuous physical-string truth. Every route-only transition splits serialization despite the same confirmed pitch continuing. Sum(mono,poly) minus union equals the reported route transitions. This proves a contribution to event count. The palm-mute mic's 9,694 union runs demonstrate that removing route splits alone cannot solve that failure within unchanged caps. There are also many different MIDI hypotheses; neither all runs nor all pitch fluctuations can be called genuine reattacks.

Of union-run **ends**, single-note mic has 620 detector-marked absent, 281 nontonal, 2,868 other selection/uncertainty losses and two source edges. Palm DI has 100 absent, 127 nontonal, eight silence and 3,512 other losses. Palm mic has 1,279 absent, 483 nontonal, 7,931 other losses and one source edge. Categories are exclusive, inspected at the first nonpresent cell. Starts are separately preserved; a startup absence flag does not imply a previous physical note.

Median smoothing changes 8,529 / 8,358 / 23,508 pitch-cell memberships respectively; three-hop physical confirmation removes another 4,109 / 3,787 / 11,229. These are symmetric-difference/removal counts, not demonstrated accuracy improvements. Both stages can affect boundary counts; raw traces preserve that distinction.

The single-note mic reaches poly event 4,001 at MIDI82, run [73.86,73.92). Palm mic reaches poly event 4,001 at MIDI53, run [401.56,401.62). **These are pitch-loop append locations, not the wall-clock failure moment or the source-analysis frontier.** All ~552 seconds were already analyzed before segmentation, and pitches are traversed in ascending order. The diagnostic counters are recording-dependent; the cap, loop ordering and 20 ms time conversion are source-independent code facts.

### Harmony: real identity and bass changes both contribute

Palm DI passes both note-stream caps, then reaches initial harmony event **3,001** at cell16,373, source start **327.46 s**, covered endpoint327.48 s. The cap precedes brief-chord demotion and any hypothetical final coalescing. In that reached prefix, spans have median40 ms, p95 360 ms, min20 ms, max3.5 s.

There are 3,000 boundaries: 1,100 change bass MIDI/null; 2,384 change the current `same_kind` identity. These overlap (484 change both; 616 are bass-only). Identity changes break down as 1,711 kind/no-chord-reason transitions, 492 unknown first-alternative/reason transitions, and 181 chord-identity transitions. Thus “just bass flicker” is false. The trace retains full ordered alternatives and evidence, although the production merge identity currently only compares the first unknown alternative. These counts describe the **pre-demotion production representation**; they do not prove how many complete semantically faithful finalized events remain.

Harmony is never reached in the two note-cap cases. There is no invented harmony inventory for them or for the DI suffix beyond its cap. Whether finalization safely reduces DI below3,000 remains open. [Raw diagnostic commands](../target/note-events/diagnostics/runs.json), [trace analysis](../validation/note-events/summarize.py).

### Truth limits and competing explanations

[Full-source pickup-label comparison](../target/note-events/truth-diagnostics.json) preserves extra/lost pitch frames and per-MIDI counts from confirmed traces. It is explicitly diagnostic, not a valid partial product output or a new completed accuracy score. False pitches, true attacks, fit/admission omissions, current-support rejection, silence and route changes must be considered separately. Detector `Absent` is a measured projection decision, **not proof of physical absence**. Remaining fit/support causes are supplemented below; these traces do not uniquely identify the upstream spectral/ownership reason for every decision.

Guitar-TECHS pickup MIDI timing, brief labels, unison overlap, missing EOF offs, room tails and reference-empty noise are documented uncertainties. Counts against those labels establish agreement/disagreement, not human acoustic adjudication. No label timing shift was selected. Nothing here licenses deleting true notes to make counts fit.

## Frozen independent CC0 acoustic DEV controls

[Manifest and physical events](../validation/note-events/controls.json), [generator](../validation/note-events/controls.py), [CC0 dedication](../validation/note-events/LICENSE). Exact manifest SHA256:

`54a2021223d8a2a810ae0e1183b24016e29fc15b4cf3e7474958293d01f62ee8`

Eight deterministic 24 kHz f32le controls total616 seconds. PCM hashes, physical excitation intervals, synthesis parameters, generator hash and freeze time are in the manifest, written **before baseline inference**. Individual PCM is in ignored `target/note-events/pcm`. Do not regenerate over this freeze. Construction truth is independent of detector outputs. No product frame/oracle injection was used. Reuse these exact bytes and events for candidates; these are DEV, not unseen acceptance.

The renderer has eight partials with independent phase, harmonic damping, controlled brightness, mild vibrato, attack and release envelopes, gain below clipping, and seeded electronics noise. [Acoustic audit](../target/note-events/acoustic-audit.json) records sample counts, finiteness, peak and 20 ms RMS quantiles, and limited FFT probes. These are plausible controlled variations, not a calibrated physical model of all guitars or measured bounds across instruments.

- `decay_timbre`: two stable decaying notes with different harmonic tilt.
- `gap_vs_dropout`: a 7 ms attenuation during one physical note, versus a real400 ms release gap. The attenuation is acoustic input corruption, not a physical note-off or detector override.
- `adjacent_reattack`: physically re-excited same pitch at1.8 s without a silent gap, plus a later real gap. Truth retains adjacency.
- `late_voice`: lower note sustains while an upper octave attacks later and releases earlier. It asserts events from known construction, not source count for identical-waveform decompositions.
- `chord_bass_silence`: staggered bass attack/release, a chord change and silence.
- `palm_attacks`: 32 short damped physical attacks across two registers, preserving every gap.
- `noise_negative`: deterministic audible broadband noise, no physical notes.
- `long_stable`:552 seconds,24 long decays, quiet gaps, then a dedicated noise-only span and quiet tail. Equal duration completes successfully: duration alone is insufficient to explain the real failures.

### Actual baseline scores

Whole-source unshifted20 ms frame centers; all tails, attacks and empty spans retained. Existing `validation/real-audio/score.py` is imported unchanged for original stream/routing/event denominators. Union exact MIDI/PC use the **same nonempty-reference-frame denominator**; extra/lost are note-cell counts. Event matching is exact MIDI, maximum one-to-one, onset<=50 ms, offset<=max(50 ms,20% reference duration). Only overlapping same-MIDI events merge; adjacent ones remain distinct. Set-union frame continuity must not be confused with this existing event convention.

| Control | Exact MIDI / nonempty | Exact PC | Extra / lost note cells | Union onset TP / pred / ref | Onset+offset TP |
| --- | ---: | ---: | ---: | ---: | ---: |
| decay_timbre | 370/370 |370|0/0|2/2/2|2|
| gap_vs_dropout |330/330|330|0/0|2/2/2|2|
| adjacent_reattack |235/235|235|0/0|3/4/3|3|
| late_voice |259/400|393|36/112|1/9/2|0|
| chord_bass_silence |217/370|367|50/106|7/16/7|6|
| palm_attacks |249/260|249|9/11|32/48/32|18|
| noise_negative |0/0|0|0/0|0/0/0|0|
| long_stable |21600/21600|21600|0/0|24/24/24|24|

The noise control's zero nonempty denominator is undefined for exact-set accuracy, not0% or100%. It emits no notes. Palm onset recall alone hides16 extra events and14 unmatched offsets; late-voice PC agreement hides register errors and missing note cells. Adjacent-reattack frame agreement does not excuse its extra event. These failures are retained unchanged; no controls/labels were adjusted after prediction.

[Full scores including separate routes and wrong-stream/duplicate frames](../target/note-events/baseline/scores.json), [commands and hashes](../target/note-events/baseline/runs.json), [scorer/binary freeze](../target/note-events/baseline/freeze.json). Nine scorer selfchecks pass: overlap versus adjacency, unison indistinguishability, one prediction cannot match two attacks, exact MIDI versus octave, onset acceptance/rejection, offset acceptance/rejection, and half-open activity at adjacent boundaries. [Evaluator](../validation/note-events/evaluate.py).

## Builder and root handoff

Astra's read-only `docs/rust-event-stability-review.md` agrees with these narrower mechanisms; its architectural hypotheses are not promoted to measured causes. Root owns the live adjacent-reattack merge repair separately. The core builder must preserve this frozen control set and reconcile the support supplement below before choosing a repair. In particular, the palm mic's vast union-event excess cannot be repaired solely by suppressing serialization route flips.

Keep all caps and failure behavior. Do not achieve success by truncating, cropping, discarding attacks, raising limits, inventing silence/unknown, sticky false mono routing, duplicating across streams, bridging true absence, weakening labels or changing scorers. A genuine route change still needs a wire boundary. A real reattack may increase event counts. Safer finalization still must preserve bass/null, reasons and all meaningful ordered alternatives. A postprocessor cannot recover a voice never admitted.

For an independently frozen candidate, run from repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/note-events/evaluate.py /absolute/frozen/candidate/analyze-pcm target/note-events/candidate-NEW
```

It verifies frozen manifest/PCM identities, runs all eight full controls once with original options into a new directory, records failures honestly, and scores only completed outputs. Compare original stream scores, union events, exact MIDI/PC, and gained/lost true and extra note cells, not event count alone. The three original full failures also remain required; `reproduce.run` accepts the same read-only manifest case objects and a new destination. Never rerun scripts over prior evidence. `controls.py` and `instrument.py` intentionally refuse existing output directories.

This package does not run candidate adoption suites, WASM, live/browser journeys or cancellation. Original resource gates remain compute p95<=500 ms and event delay p95<=1.5 s (distinct), real cancel<=250 ms, refinement<=120 s. Existing musical failures and rejected v4/Basic Pitch decisions remain in force. Final source/artifact generation and broader independently assigned candidate validation belong to root.

## Completed support-path supplement

A second passive diagnostic freeze adds `pre_support_fit` MIDI sets immediately before current-support filtering and logs each **actual cached current-support call**, before its unchanged two-hop uncertainty promotion. It never recomputes a fit, substitutes preceding notes, changes a decision or alters a limit. [Full cumulative source diff](../target/note-events/support-instrumentation.diff), [source inventory](../target/note-events/support-source-inventory.json), [binary association](../target/note-events/support-build-association.json), [commands](../target/note-events/support-diagnostics/runs.json), [source modifier](../validation/note-events/support_instrument.py).

All three short complete outputs again exactly match baseline. All three full-source failures again exit3 without output. More strongly, after excluding the extra observation rows, **every original raw/median/confirmed/harmony/cap diagnostic row equals the first diagnostic pass**, for every failed source. This is actual end-to-end existing-path instrumentation, not a detector with different tuning/preceding fits. This pass logs 184,272 / 235,076 / 244,717 finite rows, about21 /29 /28 MB respectively, with no PCM.

[Supplemental attribution](../target/note-events/support-mechanisms.json) assigns each final detected union-run end except source EOF to the earliest applicable observable category: silence; post-median physical confirmation; median removal; nontonal; omission from pre-support fit; support rejection; mono override. Categories reflect this explicit precedence, not uniquely proved acoustic causality.

| End observation | Single-note mic | Palm DI | Palm mic |
| --- | ---: | ---: | ---: |
| Not selected by pre-support fitter |2,936|2,304|7,780|
| Of those: current support confirmed |2,271|2,158|6,306|
| Of those: current support absent |588|75|1,228|
| Of those: current support uncertain |77|71|246|
| Raw present, removed by median |485|529|1,367|
| Nontonal at raw stage |306|148|525|
| Selected, then removed by singleton override |34|754|1|
| Selected, rejected as support absent |7|4|9|
| Selected, uncertainty not promoted |1|0|11|
| Silence |0|8|0|

The three “of those” rows partition the fitter-omission row; do not add them again to total ends. No final-run end in these traces is attributable to three-hop deletion under this precedence, although that pass deletes thousands of other pitch cells. The earlier absence-mask table asks a different question at the final boundary and consequently overlaps fitter omissions.

**Proved:** route-only serialization splits exist; many remaining detected pitch runs end at fitter omission despite confirmed current-band support; median and singleton decisions also contribute; DI harmony overflows amid mixed identity/bass changes. **Not proved:** that each omitted pitch was physically real; that its confirmed band still has independent ownership; that retaining it is safe; which greedy fit/temporal admission condition caused each omission; that repeated detections of different pitches are all fragments of one true note. Shared partials can support false hypotheses. These observations require root to reconcile admission/ownership and continuation before prescribing a segmentation-only fix. Do not reinsert all locally confirmed omitted pitches.

Full-source label disagreement counts additionally show **22,940 /43,603 /61,350 extra note-cells** and **1,212 /121 /381 lost note-cells** against existing pickup truth. Empty-label emitting frames are3,817/4,945,21,577/23,874,21,389/23,875. These are imperfect-label diagnostics from full traces, not adjudicated false-pitch totals and not completion scores. False-note hypotheses remain a serious competing mechanism, especially for palm mute. No reduction of those counts automatically proves better physical transcription.

Final verification rechecks frozen binary/source/input/control identities, compatibility, statuses, absence of partial result files, scorer selfchecks and evidence inventory. All owned subprocesses finished; no servers or child agents were started. **All tester ownership is released**: `validation/note-events/**`, this report and `target/note-events/**`. Product/core/Cargo/generated ownership was never taken. The exact control manifest hash remains `54a2021223d8a2a810ae0e1183b24016e29fc15b4cf3e7474958293d01f62ee8`.
