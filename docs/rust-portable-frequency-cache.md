# Portable known-frequency cache — SCOPED_BUILDER_GATES_PASS_INDEPENDENT_ACCEPTANCE_PENDING

2026-11-01. Sol6.1 xhigh implementation executor; no children or manual QA. **One distinct optimization is implemented, measured, registered and frozen.** This is builder evidence, not independent acceptance or adoption. Numerical/musical recognition acceptance remains **FAILED**. Historical Node557.2169716ms and WPE557.8ms failures remain failed; no historical-spike explanation is claimed.

All writes are confined to `validation/portable-frequency-cache/**`, `target/portable-frequency-cache/**`, and this report. The ordinary disposable source copy starts from the retained-retry root repair, preserving pre-admission Cancel handling and canonical retained recording. No OrderedPeaks or ratio-gate changes, model/threshold/pass/peak-cap changes, installs, credentials, global configuration, Git operations, deployment, production/database or default build/preview access. Any browsers/IndexedDB/ports below belong only to disposable owned validation copies.

## Exact source and deliverable

[Complete identity/artifacts](../target/portable-frequency-cache/identity.json), [source inventory](../target/portable-frequency-cache/source-inventory.json), [applyable core + registration patch](../target/portable-frequency-cache/candidate.patch), [core-only patch](../target/portable-frequency-cache/core.patch), [registration-only patch](../target/portable-frequency-cache/registration.patch), [ordinary source](../validation/portable-frequency-cache/source). The complete patch was actually applied to separate owned copies of the three parent files and the resulting bytes compared exactly with the candidate.

| Item | SHA256 |
|---|---|
| Parent220 inventory | `8a030e14d84c4e8199920a96be104cbc04ea28afec10d56ffc9ad741391c2595` |
| Final220 inventory | `c0e4f3035548fde29b56016b2e31ffc94253ac2bf80705c2e1fa4e217f6f0bd4` |
| Core + registration patch | `08d8020adbbe3349527d4d8c500b20345a9b5b23170e6a5d6c0e10f2d0bb7ce9` |
| Native executable | `7007da35f9bdfe8e623a1fa5c9639da6e8f1f91ad194be7af6f088b0f4365621` |
| Raw Cargo WASM | `4e8d5b329269b59f853962982a4cd73fd0ca3334497716be6ad531632b0d5870` |
| Reference WASM | `a2be0bfd51b2cd28d543d272bfc0f55648626781aeda7d72ca9ecf8f8f806cf7` |
| Guarded portable WASM | `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b` |
| Final source association | `be51d5825397a9745af5f5b1ab37b34ee2f411951a845500e2e3f74f93f8d4a2` |

Parent association remains `97dc9733a444e6fc8c398f9ecd4414cb0e405359bc2a78a3deef604b6f518fd1`; parent portable/reference/native remain `8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e` / `b598830e145b1d89c0b36a62df5c17e499666df60614ed4f45ccbc663200abd1` / `832fb091d7b7a44ed6fd4a2e9aad29cc6f5ddce91d7e83304f9f3e0e5359f6aa`. Engine3.1, bridge2, schema1 unchanged. The normal pipeline alone wrote the generated manifest. Pre-registration inventory/association and native/core hashes are retained separately.

## Work removed, order and lifetime

Only `VoiceEvidence::observe` core code changes. A local `Vec<Option<f64>>`, indexed by known-slice position, is initialized after the original fundamental loop. Its entry is filled only after the original lower/upper MIDI exclusions, on the first reached frequency expression. The original f64 subtraction/addition/division/powf/multiplication evaluation order is preserved. Known pitches and the reference are immutable during an observation. Duplicate MIDI entries remain distinct by position; NaN values are valid cached `Some` values. Iterator order, any() short circuits, ties and all cancellation callback positions/order are unchanged. No cache is stored in VoiceEvidence or retained across observations. Wrapper checkpoint64 / budget50ms unchanged.

[Prospective protocol](../validation/portable-frequency-cache/protocol.json), [bounded instrumented source](../target/portable-frequency-cache/instrumented-voice_evidence.rs), [mechanism summary](../target/portable-frequency-cache/mechanism-summary.json). Each fixture has128observations. Actual old-expression opportunities and miss counts match every original diagnostic observation; every complete output matches. No instrumented elapsed time is used as performance evidence.

| Fixture | Original expression opportunities | Actual miss expressions | Removed |
|---|---:|---:|---:|
| sideband | 14603 | 542 | 14061 |
| dense | 160660 | 394 | 160266 |
| real-solo | 63152 | 481 | 62671 |
| real-comp | 4784 | 281 | 4503 |

The true production bound is six known pitches: fit admits at most six, later code only filters or replaces them with a singleton, and observe receives the previous frame notes. The function remains safe for longer seam slices without adding a cap. The native type-layout test measured16bytes per Option<f64> and24bytes per Vec header. The separate pinned wasm32 layout probe measured16bytes per entry and12bytes per vector header: requested payload at most96bytes, plus header and unmeasured allocator bookkeeping. This is **not** an allocation-free, allocator-capacity, reclamation, RSS or GC claim. The local Vec is dropped on ordinary Rust returns, including Rust cancellation returns; suspended/discarded instances follow the unchanged Asyncify disposal policy rather than a destructor/cleanup promise. Any actual busy-retry memory proof below counts whole old/new WASM high waters.

## Tests and new-module certification

**PASS:** full existing pinned locked/offline Rust core suite45passed/5ignored (known failed/disabled controls preserved); new observation lifetime/indexed duplicate-MIDI/changed reference/exceptional-value seam; original/state bit comparisons; existing cancellation ordinals/progress; explicit four frozen fixture bit controls; fmt check and clippy all targets `-D warnings`. Four native old/new spots match full bytes, status and streams. Four same-target parent/new reference WASM spots match full text bytes. Native versus WASM low-bit differences in the unchanged parent are not treated as candidate changes. [All command directories](../target/portable-frequency-cache), [core stdout](../target/portable-frequency-cache/core-tests/stdout.log), [frozen bit stdout](../target/portable-frequency-cache/frozen-bits/stdout.log), [native/reference spots](../target/portable-frequency-cache/reference-spot-data/result.json).

Fresh locked/offline Rust build captures raw exactly once. Unchanged metadata removal preserves every non-custom section byte; unchanged bindgen0.2.100, adapters, verified official Binaryen125, Asyncify arguments, guardWat and assembler derive both quarantine representations from that snapshot. [All intermediates/commands](../target/portable-frequency-cache/quarantine), [metadata proof](../target/portable-frequency-cache/quarantine/metadata-proof.json).

Independent decoder, as a separate implementation from the builder, freshly decodes **875 defined functions, 724680 instructions, 54238 memory instructions: 25226saved / 7738header / 21274ordinary; zero issues**. All 2576 cursor updates reconcile by function/signed delta with1270 contiguous complete frame groups and actual index widths. The v3 token proof preserves the original WAT token stream, including quoted data, and matches the exact set, function order and span of all **27804** assembled checker calls. No old count inheritance or invalid local-ordering assumption. [Binary](../target/portable-frequency-cache/binary/summary.json), [frame proof](../target/portable-frequency-cache/frame-proof-v1/result.json), [token/call-set reconciliation](../target/portable-frequency-cache/transform-reconciliation-v3.json).

Exact new checker876, setter875, start-unwind870/start-rewind872 bindings were decoded prospectively. Both starts reject configuration/header before dependent reads and check cursor before state/data writes. Exact checker/setter/control bodies, private zero-initialized globals, closed funcref303 table, no guest/table routes to controls, two imports, actual exports/declarations and single unshared wasm32 memory17..2048pages pass. Setter <=1MiB saved-stack / <=128MiB memory limits remain. Ordinary allocator disjointness remains a premise. This is bounded exact-module certification, not a proof of arbitrary traps or independent review.

**PASS:** all194core,28real-instance,16actual-entry controls; actual writer overflow and no post-trap guest cleanup; inventory/declarations/ABI; late-read mutant runtime eventual-trap oracle accepts it, but the unchanged fixture decoder rejects its unguarded load at function8/byte591 before checker600. All failed/mutant evidence retained. Only after these proofs were the exact raw/reference/numeric/transformed hashes and freshly derived count literals registered. Packaging audit reconstructs unchanged script semantics. Strict normal generation, verifier, fresh `--check`, normal npm build pass; all ten generated artifacts equal quarantine bytes. [Packaging audit](../target/portable-frequency-cache/packaging-audit.json), [normal reproduction](../target/portable-frequency-cache/normal-artifact-reproduction.json).

## Single early gate — PASS

[All96calls/complete output files/statuses](../target/portable-frequency-cache/early), [result](../target/portable-frequency-cache/early/result.json). Same four original fixtures, auto/440/sharps/24kHz;3warm+9retained alternating old/new pairs. Public analyze through settled Promise includes actual copies, RustJSON and unchanged scheduler. File/module setup and evidence writes excluded. All96 complete UTF8/status pairs exact; no retries, outlier removal or sample deletion. Advancement rule frozen before execution: geometric mean of four retained-median new/old ratios<=.98 and at least3lower medians, with mechanism proof.

| Fixture | Parent median ms | New median ms | Ratio |
|---|---:|---:|---:|
| sideband | 332.417522 | 290.643920 | 0.874333935 |
| dense | 116.055883 | 112.551410 | 0.969803573 |
| real-solo | 175.856204 | 175.950416 | 1.000535733 |
| real-comp | 117.009585 | 116.996315 | 0.999886590 |

Geometric ratio **0.9597013717**, three lower medians. Real-solo is slightly higher. This permits advancement; it is not a universal speedup, spike-cause explanation or500ms final acceptance.

## Conditional scopes and actual verdict

| Scope | Verdict |
|---|---|
| Full762DEV same-target raw/status equivalence | PASS |
| Original424edges +6large30/300allmodes | PASS |
| Final Node3blocks/six fixtures, all candidate p95<=500ms | PASS |
| Final actual WPE product worker, same blocks/fixtures/p95 | PASS |
| Actual busy cancellation/retry/CPU/scoped memory | PASS_SCOPED_BUSY_RETRY |
| Numerical/musical acceptance | FAILED unchanged |
| Adoption | NO; root independent acceptance required |

Full DEV preserves synthetic153, GuitarSet3, supplemental12, joint60, GuitarTECHS28, upstream335 and acoustic171. Native full outputs/status/stdout/stderr match frozen parent raw bytes, including the same3native event-cap failures. Portable complete output/error/status matches parent portable, with no normalization, tolerance, new labels, scorer/holdout/expected edits. **The unchanged portable300s wrapper refuses native-supported longer recordings; those same-target identical refusals are not claimed to be portable detector outputs.** [Plan/all associations](../target/portable-frequency-cache/dev-plan.json), [every raw result and streams](../target/portable-frequency-cache/dev-data-corrected), [result](../target/portable-frequency-cache/dev-data-corrected/result.json).

The original424case construction and frozen expected bytes/status plus six tiled-original-seed30/300s all-mode parent/new calls pass without changing the wrapper limits. [Every raw text/status](../target/portable-frequency-cache/edge-data).

Final timing protocol frozen after full DEV/edges, with original six fixtures, options, lifetimes, three alternating engine orders,3warm+15retained and linear `(n-1)*p` p95. Raw successful output text and attempt/sample records are saved for every warm/retained call. New code gate is distinct from historical failures. [Frozen protocol](../target/portable-frequency-cache/cost-protocol.json), [Node all972calls/raw files](../target/portable-frequency-cache/final-node-data), [Node distributions](../target/portable-frequency-cache/cost.json), [Node gates](../target/portable-frequency-cache/cost-gates.json).

| Block | Fixture | Node candidate p95 ms | <=500 |
|---|---|---:|---|
| 1 | sideband | 293.370909 | True |
| 1 | dense | 181.928815 | True |
| 1 | real-solo | 188.972026 | True |
| 1 | real-comp | 130.154664 | True |
| 1 | noise | 92.032745 | True |
| 1 | dense-boundary | 61.467401 | True |
| 2 | sideband | 285.100872 | True |
| 2 | dense | 127.834371 | True |
| 2 | real-solo | 180.886178 | True |
| 2 | real-comp | 116.600201 | True |
| 2 | noise | 91.277252 | True |
| 2 | dense-boundary | 61.327318 | True |
| 3 | sideband | 280.857582 | True |
| 3 | dense | 114.287188 | True |
| 3 | real-solo | 180.833973 | True |
| 3 | real-comp | 160.546105 | True |
| 3 | noise | 97.257543 | True |
| 3 | dense-boundary | 62.839210 | True |

WPE is Linux26/WebKit2359 with private Noble libraries, not Safari. The actual current product worker body is copied, adding only raw diagnostic text after computeMs; same payload parsing, output parsing, lifecycle/helper and scheduler. References use the same worker body with named old synchronous adapters; zero overhead is not a gate. All text/status and attempted calls, including failures, remain. [WPE rows/distributions/gates/cleanup](../target/portable-frequency-cache/final-wpe-corrected-data).

One actual mounted repaired-UI/new-WASM busy300s cancellation, immediate retained retry, Save/reload/Open/verified PCM/playback journey passes. This is disposable seeded local storage, not live capture or production. Actual DSP owner PID/TID/startTicks **1110031/1110066/3225526**, 7 pre-handler10ms CPU ticks; unique birth/source/readiness/raw-entry join; first complete absence by **55.5ms**, no reappearance/post250ms sighting through 13758.5ms. This is OS CPU-owner evidence independent of acknowledgements or API return.

One adoption; unchanged PCM; two full copies with exact fenced genuine helper-release before next copy and same canonical chunk backings. Scoped named stopped-retry app audio +2MiB metadata reserve = **89611264 <100663296bytes**; conservative sum old/new WASM high waters = **71499776 <134217728bytes**. No whole-app/nativeRSS/GC/arbitrary caller/initial restore/Save/verification/WAV/playback memory claim. [Actual busy analysis](../target/portable-frequency-cache/busy-analysis.json), [all marks/censuses/CPU/transport/cleanup](../target/portable-frequency-cache/mounted-busy).

## Retained setup failures and limits

[Failure ledger](../target/portable-frequency-cache/failure-ledger.json) preserves every nonzero command. No substantive failed gate was rerun to fit data. Setup corrections are dated and prospective in the owned validation directory:

- Initial focused build briefly overlapped instrumented-build setup; Cargo target lock serialized compilation. Restored uninstrumented focused/full/frozen controls ran afterward. No timing run overlapped.
- Native/reference spot attempt incorrectly asserted cross-target float equality; the unchanged parent already differed in low bits. Corrected same-target old/new checks pass; original failure retained.
- Reference spot log/data directory name collision failed before DSP; separate owned data path retained same assertions.
- Unused prior DEV-plan script assumed supplemental stream suffixes matched real streams. Original failed plan and missing-plan attempt retained; correction uses actual frozen filenames.
- WPE first failed before any analysis call: named historical references expose bridge1 but copied current worker checked2. Exact bridge1 checks were restored only in those reference wrappers; candidate bridge2/module/worker bundle and all criteria unchanged. Original zero-call failure and sources retained; corrected run uses a separate directory; Node not rerun. [Binding amendment](../target/portable-frequency-cache/wpe-binding-amendment.json).
- A no_std layout-only probe failed compilation because linking alloc needs an allocator; normal std layout-only exports measured16/12bytes without executing allocation. Both sources and the failed build remain.
- Full DEV case238 exposed an invalid native/portable-status assertion after parent/new exact portable equality had passed:552s native success versus identical parent/new portable LIMIT_EXCEEDED. The saved native/status/streams and both portable error files were verified offline; no completed DSP case was repeated. Continuation starts239, retains all earlier calls, preserves all762cases and native3cap failures. See [prospective correction](../validation/portable-frequency-cache/dev-status-correction.json).

No final metric is used to rewrite historical557.22Node/557.8WPE failures. Recognition failures and ignored tests remain failed/ignored, with no accuracy progress claim. Any conditional scope not run above inherits no pass from the old retained-retry module. Root independently decides acceptance/adoption.

## Reproduce and release

All executed phases use `python3 validation/portable-frequency-cache/execute.py NAME CWD COMMAND...`; each named target directory retains exact argv, isolated environment, UTC start/end, exit status, stdout and stderr. Commands refuse existing output directories. Canonical orchestration scripts:

```text
python3 validation/portable-frequency-cache/prepare.py
python3 validation/portable-frequency-cache/implement.py
python3 validation/portable-frequency-cache/mechanism.py
python3 validation/portable-frequency-cache/test-and-freeze.py
python3 validation/portable-frequency-cache/certify.py
python3 validation/portable-frequency-cache/controls.py
python3 validation/portable-frequency-cache/execute.py dev-plan-corrected . python3 validation/portable-frequency-cache/prepare-dev.py
python3 validation/portable-frequency-cache/execute.py full-dev-corrected . .tools/node-v24.22.2-linux-x64/bin/node validation/portable-frequency-cache/dev.mjs
python3 validation/portable-frequency-cache/execute.py full-dev-continuation . .tools/node-v24.22.2-linux-x64/bin/node validation/portable-frequency-cache/dev-resume.mjs
python3 validation/portable-frequency-cache/after-dev.py
python3 validation/portable-frequency-cache/final-run.py
python3 validation/portable-frequency-cache/wpe-correction.py
python3 validation/portable-frequency-cache/busy-run.py
python3 validation/portable-frequency-cache/closeout.py
python3 validation/portable-frequency-cache/write-report.py
```

Pinned Node24.22.2 SHA904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52; direct Rust1.89 cargo/rustc/rustdoc with owned CARGO_HOME before every invocation; locked/offline builds, owned targets/temp/dependency/cache paths. Existing bindgen/Binaryen aliases are read-only. Normal npm userconfig is an owned empty file; no personal npmconfig read. No install/bootstrap or global changes. [Tool pins](../target/portable-frequency-cache/tool-pins.json), [initial220 and protected evidence pins](../target/portable-frequency-cache/input-pins.json), [final preservation/source/cleanup verification](../target/portable-frequency-cache/final-verification.json).

**Exclusive heavy ownership released at 2026-11-01T01:26:55.210847+00:00 UTC.** [Actual release](../target/portable-frequency-cache/heavy-release.json). Zero remaining owned processes; all opened owned servers/profiles/ports are closed/removed as recorded. No heavy work follows; only report/evidence hash writes. Frozen source, artifacts, applyable patch and inventories remain for independent root review.
