# Independent live-cost validation: INCOMPLETE
UTC: 2026-10-31T19:59:55.170578+00:00. Exact rust-dsp-3.1 speedup only; no recognition improvement claimed. Existing recognition failures remain baseline behavior.

Protocol frozen before candidate execution: [manifest](../validation/live-cost/manifest.json), SHA-256 `1e75baa73d34fda744df4ba9cf19e8fd72ca5c36c3582718eebe31ed45ec9df9`; UTC and hash also retained in [manifest.sha256](../validation/live-cost/manifest.sha256). Three blocks, alternating engine order, six windows, 3 warmups +15 retained samples, interpolated p95, bridge copies/JSON included, module initialization and file I/O excluded. No outlier deletion or timing extensions. No owned build/native analysis/browser overlapped cost timing. Other desktop processes remained; load is evidence, not grounds to discard a row.

Verdict reason: exact native/WASM parity and all cost gates passed. Browser cancellation API returns promptly and no late result was observed, but nested analysis-worker targets remained at the 250 ms census on BOTH baseline and candidate. Worker extinction within that deadline is not certified; CDP target presence alone does not prove continued DSP execution. This is a shared lifecycle validation gap, not evidence of a candidate numerical regression. Full adoption approval is withheld.


## Identities and association

- baseline_source: `f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`
- baseline_native: `d3bec4e476dc4d3c48563b5bc6c6d712f0f0e6e3180e221f9077281bdade97f8`
- baseline_wasm: `c9217873255d58542203c073db3863426119b27354e324f6ea06ce1b4e977d61`
- candidate_source: `d89083935142dd7cc8e21e1c57a08d7b21f39f3bf5d9d2d5d697fc86bbb5f6c4`
- native: `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`
- patch_sha256: `e946722e90b298bbe154bfa9d8160712e7b9f649e2bdbaf88ff35ee0bfea9555`
- candidate fretbloom_wasm.d.ts: `826fabf909bdf0e89d869aaec611c4b00bef748fe94dc7b881da06d26023da10`
- candidate fretbloom_wasm.js: `5d9f2ed959ec33aa08bf5d40720ebd0759e2761d4e26e0e21e03b2af62fd5a41`
- candidate fretbloom_wasm_bg.wasm: `7b40ba5ce7fb9018a510c8ddb063304839a9d28abf58675953cbd3093fb23e73`
- candidate fretbloom_wasm_bg.wasm.d.ts: `8fb535b7d0a88b698f4b84cb1ce417e57e1ee0e06162177e34074ef37a664529`

Active canonical source inventory and baseline binaries matched. Patch applied to a fresh active crates/workspace copy; every frozen source file matched. Native and WASM independently rebuilt with Rust 1.89.0, locked/offline release, wasm-bindgen 0.2.100, target-scoped `--max-memory=134217728` and the two pinned path remaps. Native, WASM and glue reproduce the frozen bytes exactly. [Association](../target/live-cost-test/association.json), [rebuild](../target/live-cost-test/rebuild.json), [commands/environment](../target/live-cost-test/commands.jsonl).


## Source review and focused checks
I read the production changes. The original literal cent gates remain after guarded rejection prefilters; original quotients, iteration/tie order and float accumulation order remain. Bounds add 0.5 cent and round outward; exceptional operands fall back. The cache preserves original j order and first delta>4 break, in-place updates, four passes and callback positions. Cache is bounded to 552 anchors × 34 entries per row, otherwise original-scan fallback. Peak-floor selection retains total_cmp rank and the 44-entry neighborhood; evidence ratio sorting remains. Shared transform preserves preparation/FFT arithmetic. No changed admission threshold/cap/iteration count, removed cancellation checkpoint, new unsafe or recording-length cache found.
Embedded original functions were independently compared with active source (only names, whitespace and trailing commas normalized): all nine match. Rebuilt release tests: 44 passed, 4 ignored; includes paired internal to_bits/history/fit/transform checks and cancellation/progress ordinals. The separately run allocation test passed: old 35,328B, new 357,696B, extra 322,368B; zero retained delta after 64 calls. Independent native and standalone WASM gate probes: 57,792 checks each, zero false rejection. [Source audit](../target/live-cost-test/source-audit.json), [test log](../target/live-cost-test/test.log), [allocation log](../target/live-cost-test/memory.log), [probe](../target/live-cost-test/probe.json).


## Native and WASM parity

| Suite | Coverage | Result |
|---|---:|---|
| synthetic original | 153 | identical |
| real GuitarSet DEV | 3 | identical |
| supplemental | 12 | identical |
| joint20 ×3 modes | 60 | identical |
| whole Guitar-TECHS | 28 | identical |
| upstream-round2 | 335 | identical |
| acoustic controls | 171 | identical |
| cost coverage entries | 4 | identical |
| native boundary/options/error cases | 440 | identical |
| WASM boundary/options/bridge errors | 424 | identical |

DEV successful full output JSON counts: `{'joint20': 60, 'real': 3, 'guitar28': 25, 'extended': 12, 'synthetic': 153}`; every retained raw output/stdout/stderr and decoded PCM matched. All expected success calls exit 0; failures retain exact exit/stderr/stdout and no output. Controls: 513 coverage entries, 342 unique input/options cases after hash deduplication; 9 baseline cases independently reproduced (including the 480 s control), then retained builder baseline files verified against their recorded hashes before reuse. Candidate executed on every unique control. Native boundaries: 439 paired cases plus over 600 s error. All three modes, both spellings, references 432/440/446, signed zero/silence, seeded noise, clipped and six-voice signals, many-peak PCM, empty/1/short and ±1 around 480/1024/4096/8192, invalid options/sample rates and nonfinite PCM included. WASM: 424 paired cases including over 300 s/oversized options/invalid JSON. Full WASM output strings matched for all six timed windows.
Original scorer results match after removing only run identity/path/timing metadata. Full output JSON comparisons are byte comparisons without normalization. Note-event and Guitar-TECHS metrics are both included in guitar28 runs. Synthetic scores/predictions and real/extended/joint reports are compared. [DEV comparison](../target/live-cost-test/dev-comparison.json), [controls](../target/live-cost-test/controls.json), [native boundaries](../target/live-cost-test/boundaries.json), [WASM boundaries](../target/live-cost-test/wasm-boundaries.json).
Raw differences: `[]`. Scorer differences: `[]`. Controls/boundary differences: 0.

Expected cap failures (whole inputs, not crops):

- baseline: `P1_singlenotes_allsinglenotes_micamp`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many note events`.
- baseline: `P1_techniques_PalmMute_directinput`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many harmony events`.
- baseline: `P1_techniques_PalmMute_micamp`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many note events`.
- candidate: `P1_singlenotes_allsinglenotes_micamp`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many note events`.
- candidate: `P1_techniques_PalmMute_directinput`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many harmony events`.
- candidate: `P1_techniques_PalmMute_micamp`: exit 3, output_exists=False, stderr `analysis limit exceeded: too many note events`.

Native/WASM cross-backend comparisons are retained separately: [all differing JSON paths/values](../target/live-cost-test/cross-backend.json). Pre-existing cross-backend differences are not within-backend regressions.


## Actual WASM cost
Pinned Node v24.22.2, 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz, {'platform': 'linux', 'release': '7.0.0-42-generic', 'arch': 'x64'}. This device/OS only; no browser latency or event-delay claim. Every row retains all 15 raw samples and process/linear memory in [raw cost](../target/live-cost-test/wasm-cost.json).

| Block | Window | Engine | Median ms | p95 ms | Max ms | Load before → after |
|---|---|---|---:|---:|---:|---|
| 1 | sideband | baseline | 471.55 | 480.15 | 480.40 | `0.99 1.65 2.41 1/3129 194695` → `0.99 1.62 2.39 1/3130 194704` |
| 1 | dense | baseline | 137.57 | 140.09 | 142.21 | `0.99 1.62 2.39 1/3130 194704` → `0.99 1.62 2.39 1/3131 194706` |
| 1 | real-solo | baseline | 254.67 | 257.00 | 260.98 | `0.99 1.62 2.39 1/3131 194706` → `0.99 1.61 2.39 1/3133 194715` |
| 1 | real-comp | baseline | 161.45 | 167.38 | 168.30 | `0.99 1.61 2.39 1/3133 194715` → `0.99 1.60 2.38 1/3138 194736` |
| 1 | noise | baseline | 140.33 | 145.98 | 147.80 | `0.99 1.60 2.38 1/3138 194736` → `0.99 1.60 2.38 1/3137 194742` |
| 1 | dense-boundary | baseline | 58.80 | 72.06 | 76.26 | `0.99 1.60 2.38 1/3137 194742` → `0.99 1.60 2.38 3/3137 194742` |
| 1 | sideband | candidate | 259.98 | 263.84 | 266.41 | `0.99 1.60 2.38 1/3137 194742` → `1.00 1.59 2.37 1/3130 194744` |
| 1 | dense | candidate | 103.89 | 104.46 | 104.90 | `1.00 1.59 2.37 1/3130 194744` → `1.00 1.58 2.36 1/3123 194744` |
| 1 | real-solo | candidate | 157.35 | 160.89 | 162.21 | `1.00 1.58 2.36 1/3123 194744` → `1.00 1.58 2.36 1/3123 194745` |
| 1 | real-comp | candidate | 106.55 | 110.10 | 111.02 | `1.00 1.58 2.36 2/3123 194745` → `1.00 1.57 2.36 1/3122 194746` |
| 1 | noise | candidate | 80.80 | 81.70 | 82.73 | `1.00 1.57 2.36 1/3122 194746` → `1.00 1.57 2.36 2/3127 194752` |
| 1 | dense-boundary | candidate | 54.60 | 55.94 | 56.00 | `1.00 1.57 2.36 2/3127 194752` → `1.00 1.57 2.36 2/3127 194753` |
| 2 | sideband | candidate | 257.34 | 261.37 | 266.19 | `1.00 1.57 2.36 1/3127 194753` → `1.00 1.56 2.35 1/3125 194754` |
| 2 | dense | candidate | 103.58 | 107.08 | 108.91 | `1.00 1.56 2.35 1/3125 194754` → `1.00 1.56 2.35 1/3125 194755` |
| 2 | real-solo | candidate | 156.83 | 160.99 | 165.05 | `1.00 1.56 2.35 1/3125 194755` → `1.00 1.55 2.34 1/3131 194763` |
| 2 | real-comp | candidate | 105.45 | 107.60 | 107.74 | `1.00 1.55 2.34 1/3131 194763` → `1.00 1.55 2.34 1/3126 194764` |
| 2 | noise | candidate | 81.35 | 84.67 | 85.67 | `1.00 1.55 2.34 1/3126 194764` → `1.00 1.54 2.33 1/3135 194777` |
| 2 | dense-boundary | candidate | 55.71 | 58.14 | 60.14 | `1.00 1.54 2.33 1/3135 194777` → `1.00 1.54 2.33 1/3134 194784` |
| 2 | sideband | baseline | 482.25 | 514.95 | 523.74 | `1.00 1.54 2.33 1/3134 194784` → `1.00 1.53 2.32 1/3126 194797` |
| 2 | dense | baseline | 142.52 | 153.69 | 162.06 | `1.00 1.53 2.32 1/3126 194797` → `1.00 1.53 2.32 2/3128 194801` |
| 2 | real-solo | baseline | 259.05 | 267.30 | 269.96 | `1.00 1.53 2.32 3/3128 194801` → `1.00 1.52 2.31 1/3126 194803` |
| 2 | real-comp | baseline | 165.33 | 192.42 | 234.99 | `1.00 1.52 2.31 1/3126 194803` → `1.00 1.51 2.30 2/3126 194805` |
| 2 | noise | baseline | 137.34 | 139.18 | 139.69 | `1.00 1.51 2.30 1/3126 194805` → `1.00 1.51 2.30 1/3123 194806` |
| 2 | dense-boundary | baseline | 56.94 | 59.83 | 60.06 | `1.00 1.51 2.30 1/3123 194806` → `1.00 1.51 2.30 2/3123 194807` |
| 3 | sideband | baseline | 480.35 | 498.18 | 498.76 | `1.00 1.51 2.30 1/3123 194807` → `1.00 1.49 2.29 2/3138 194837` |
| 3 | dense | baseline | 141.87 | 146.69 | 151.31 | `1.00 1.49 2.29 2/3138 194837` → `1.00 1.48 2.28 1/3137 194842` |
| 3 | real-solo | baseline | 259.83 | 264.69 | 265.94 | `1.00 1.48 2.28 1/3137 194842` → `1.00 1.47 2.28 1/3125 194846` |
| 3 | real-comp | baseline | 164.33 | 170.40 | 171.70 | `1.00 1.47 2.28 1/3125 194846` → `1.00 1.47 2.28 1/3128 194850` |
| 3 | noise | baseline | 137.68 | 141.71 | 143.99 | `1.00 1.47 2.28 1/3128 194850` → `1.00 1.47 2.27 1/3128 194851` |
| 3 | dense-boundary | baseline | 56.79 | 57.19 | 57.45 | `1.00 1.47 2.27 1/3128 194851` → `1.00 1.47 2.27 1/3128 194851` |
| 3 | sideband | candidate | 256.52 | 260.52 | 266.18 | `1.00 1.47 2.27 1/3128 194851` → `1.00 1.46 2.26 2/3126 194853` |
| 3 | dense | candidate | 103.14 | 103.38 | 103.53 | `1.00 1.46 2.26 2/3126 194853` → `1.00 1.46 2.26 1/3125 194853` |
| 3 | real-solo | candidate | 156.32 | 160.71 | 164.11 | `1.00 1.46 2.26 1/3125 194853` → `1.00 1.45 2.25 1/3120 194854` |
| 3 | real-comp | candidate | 105.06 | 108.87 | 111.99 | `1.00 1.45 2.25 1/3120 194854` → `1.00 1.45 2.25 2/3127 194862` |
| 3 | noise | candidate | 78.94 | 80.49 | 81.08 | `1.00 1.45 2.25 3/3127 194862` → `1.00 1.45 2.25 1/3126 194862` |
| 3 | dense-boundary | candidate | 53.95 | 55.17 | 56.59 | `1.00 1.45 2.25 1/3126 194862` → `1.00 1.44 2.25 3/3133 194869` |

Gate failures/slower paired p95 rows: `[]`. All blocks retained; none excused as contamination. Peak Node WASM linear memory: 3,670,016B (limit 134,217,728B).


## Real browser workers and 300 s refinement
- baseline: passed, 5 cycles; active worker census, no genuine note-evidence substitution, closed AudioContexts and terminated workers after each cycle; restored-metadata cancellation/hash checks passed. Status-reported peak WASM 3,276,800B; owned JS 1,875,968B. Browser 143.0.7499.4.
- candidate: passed, 5 cycles; active worker census, no genuine note-evidence substitution, closed AudioContexts and terminated workers after each cycle; restored-metadata cancellation/hash checks passed. Status-reported peak WASM 3,276,800B; owned JS 1,875,968B. Browser 143.0.7499.4.
- 300 s baseline: passed; 
  - cancel=True: refineMs=None, cancelMs=0.30000000074505806; workers before/after 0/2, destroyed target count 2.
  - cancel=False: refineMs=6502.200000001118, cancelMs=None; workers before/after 0/0, destroyed target count 2.
- 300 s candidate: passed; 
  - cancel=True: refineMs=None, cancelMs=0.2999999988824129; workers before/after 0/2, destroyed target count 2.
  - cancel=False: refineMs=6130.0999999996275, cancelMs=None; workers before/after 0/0, destroyed target count 2.
300s baseline status-reported maxima: WASM 1,179,648B; owned JS 87,514,112B.
300s candidate status-reported maxima: WASM 1,179,648B; owned JS 87,514,112B.
Initial 150 ms post-disposal census failed for both engines; all evidence is retained in [initial300s trial](../target/live-cost-test/staged-initial.json). A frozen follow-up extended only the cleanup observation and allowed the previously skipped full refinement to execute: all targets were gone by 1150 ms after disposal for both. A separate frozen cancellation follow-up measured before disposal: analysis-worker targets remained at 251.4 ms baseline /251.5 ms candidate after abort. These were not deleted or excused. [Cancellation census](../target/live-cost-test/cancellation.json), [follow-up declarations](../validation/live-cost/cancellation-followup.json).

[Browser evidence](../target/live-cost-test/browser.json), [300s evidence](../target/live-cost-test/staged.json). Five-cycle fixtures use paced real WebAudio/worklet→ingestion worker→analysis worker→candidate WASM.300s check stages retained PCM via real restore/hash validation, then real refinement; it is not 300 s of microphone playback. Cancellation is triggered 100 ms after refine dispatch; actual DSP start is not independently timestamped. API latency, eventual destroyed targets, unchanged API snapshot and absence of a refined event during the late-result observation are recorded. This does not establish worker extinction within 250 ms. Main-thread CDP heap and runtime memory census are observations, not a full browser-native allocation meter. No physical microphone track test; source/AudioBuffer and browser-native overhead are outside the owned-JS census.
The 300s status samples retain the initialization WASM size and do not measure its full-analysis high-water. Successful worker replies passed the existing 128 MiB guard and the linked memory maximum; full 300 s linear-memory peak was not independently sampled. Owned JS status high-water 87,514,112B is below 96 MiB. Browser-native memory is not certified.


## Executed scope, limitations and commands
Native full DEV and all 28 whole Guitar-TECHS executed on both supplied binaries. Rebuilds use owned targets. Focused internal bit/cancellation tests executed natively; WASM standalone gate probes and complete external bridge parity executed. Independent per-item native timing variants were not rebuilt or timed; builder attribution remains preliminary and is not used for the acceptance cost gate. No accuracy claim, adoption, publication, production/database/default-preview use, install or src/generated mutation occurred. All owned servers and browsers close in finally blocks. [Closeout](../target/live-cost-test/closeout.json) confirms no owned test processes remain, unchanged active sources/WASM and unchanged frozen inventory.
Run from repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/prepare.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/build.py native wasm bindgen test
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/dev.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/controls.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/boundaries.py
python3 validation/live-cost/contexts.py
python3 validation/live-cost/source-audit.py
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/probe.py
python3 validation/live-cost/size-errors.py
.tools/node-v24.22.2-linux-x64/bin/node validation/live-cost/wasm-parity.mjs
target/live-cost-test/build/release/deps/fretbloom_analysis-dc402af1ea18950a --ignored memory_high_water_and_repeated_retention --nocapture
.tools/node-v24.22.2-linux-x64/bin/node validation/live-cost/browser.mjs
# Only after all prior owned work completed:
PYTHONDONTWRITEBYTECODE=1 python3 validation/live-cost/finish.py
.tools/node-v24.22.2-linux-x64/bin/node validation/live-cost/staged.mjs # declared cleanup/full-refine follow-up
.tools/node-v24.22.2-linux-x64/bin/node validation/live-cost/cancellation.mjs # declared pre-dispose cancellation census
python3 validation/live-cost/report.py
```
Individual run commands, stdout/stderr and full output are retained under target/live-cost-test. Preparation and context scripts create fresh paths and intentionally are not rerunnable in place.
