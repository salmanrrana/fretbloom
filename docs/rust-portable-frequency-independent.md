# Independent frequency-cache review — NO-GO: local Docker packaging fails

Independent Sol6.1 xhigh reviewer/tester; no children, manual QA, product repairs, adoption, commit, push or deployment. The frozen cache candidate passed the executed host safety, numerical, timing and mounted UI scopes. **Do not integrate as an all-gates accepted candidate: the unchanged actual Dockerfile rejects its fresh WASM build.** Musical recognition acceptance remains FAILED.

## P1 — required container build cannot produce an image

The exact 220-file candidate was copied into an ordinary owned Docker context and checked against its inventory. The actual Dockerfile, unchanged, was built with fresh `wasm-builder`, `rust-builder`, and `node-builder` stages. It exits1 at [Dockerfile:22](../validation/portable-frequency-cache/source/Dockerfile), executing `cargo fetch --locked --target wasm32-unknown-unknown && node scripts/wasm-build.mjs --check`. The strict [wasm-build.mjs:95](../validation/portable-frequency-cache/source/scripts/wasm-build.mjs) check throws **Raw Cargo module identity drift**. No final image or runtime container was created.

A smaller owned probe retains the same wasm-tools base, COPY inputs, and actual strict command, appends read-only hashes after its failure, and returns the original exit1. It reproduces the failure. The probe is diagnostic evidence, not a repaired Dockerfile or a successful build.

| Identity | Expected / frozen host | Actual container |
| --- | --- | --- |
| Source association | `be51d5825397a9745af5f5b1ab37b34ee2f411951a845500e2e3f74f93f8d4a2` | `be51d5825397a9745af5f5b1ab37b34ee2f411951a845500e2e3f74f93f8d4a2` |
| Raw Cargo WASM | `4e8d5b329269b59f853962982a4cd73fd0ca3334497716be6ad531632b0d5870` | `91ee03e18f5c62cf2b734537eb89d514c7ce4fb37aff2da843c7c1380cb57a2e` |
| Metadata-stripped numeric input | `c170d7408449565a8e4df9d01e00c9f33d77bfdf1ce0220cdd4c779eafce56a8` | `cfece02fd556bf3d8c8c4b081de5e2fc51efb2053fecdd97cb4d8ef68747074d` |

Container Rust1.89 rustc SHA `c6ac0142c05a60b0f6c15e1a118bd5ac3bd04924cd6dc0c328f501c5f86e4142` and Cargo SHA `5b32bd53b8a08d8e206daed51f3fce40cdc0729038ff96bd0ca845596a2c1019` exactly match the pinned host tools. Node is24.22.2. The complete source-map comparison is empty: this is **not a demonstrated missing COPY or source-inventory mismatch**. Numeric-input bytes also differ, so the observed drift is not confined to custom-section metadata. The cause, numeric output equivalence, and safety of these container-produced bytes are **unproven**. Parent Docker behavior was not tested; no cache-specific regression cause is claimed. Do not replace hash literals merely to bypass this refusal.

[Original complete build command/stdout/stderr/status](../target/portable-frequency-independent/docker-build/), [red probe](../target/portable-frequency-independent/Dockerfile.red-probe), [red command/logs](../target/portable-frequency-independent/docker-red-probe/), [exact observation](../target/portable-frequency-independent/docker-red-observation.json), [probe plan](../target/portable-frequency-independent/docker-red-probe-plan.json).

Exact red reproduction from repository cwd, with the owned context preserved:

```sh
python3 validation/portable-frequency-independent/execute.py docker-red-replay . docker build --progress=plain --target wasm-builder --no-cache-filter wasm-builder -f target/portable-frequency-independent/docker-source-context/Dockerfile target/portable-frequency-independent/docker-source-context
```

This supplied replay is not another executed run. The original whole-image build and one smaller red diagnostic build are retained; neither became a pass. Root owns any fix/new candidate and its subsequent acceptance.

## Closed scopes on the exact frozen host candidate

| Scope | Independent result |
| --- | --- |
| Source/parent/tool/artifact identity and review | PASS. All220 candidate and220 parent entries matched before/after. Complete textual patch independently reconstructed exactly. Only cache core/new seam, two exact registration-literal changes and generated artifacts differ. |
| Normal native build | Build succeeds and selected exact native replay passes. **Exact native-byte reproduction remains unclosed:** default fresh SHA differs; see below. |
| Normal host WASM generation and fresh `--check` | PASS. Fresh Rust compile, normal pipeline, all ten artifacts and manifest reproduce exactly; quarantine derivation also matches all pinned intermediates. |
| Rust/build/lint/caller tests | PASS. Existing Rust45passed/5ignored; explicit frozen-bit control1passed separately; fmt and clippy `-D warnings`; strict TypeScript/normal production build;36tests across the intended six actual TS files;126explicit lint inputs,0errors/8warnings. No ancestor-ignored or duplicate validation test copies counted. |
| Actual new-module safety | PASS bounded contract.875defined functions/724680instructions/54238memory instructions;25226saved,7738header,21274ordinary; all2576cursor updates,1270contiguous frame groups and27804checker-call IDs/order/spans reconcile exactly. |
| Safety controls | PASS.194core,28real-instance,16actual entry controls; original R4 lower-cursor trap; real writer overflow and zero guest reentry after trap; actual ABI/declarations/private globals/closed303table/2imports/single unshared17..2048page memory. |
| Late-read mutant | Correctly rejected. Actual unguarded function8/byte591 load precedes checker600; decoder reports INCOMPLETE even though eventual-trap runtime oracle accepts the mutant. No unsupported shape waived. |
| All762 builder DEV raw associations | PASS independent audit of complete input/output/status/stdout/stderr, not summary booleans. Same native cap failures239/252/253; continuation238 retained; four native-success/portable-limit refusals remain correctly distinguished from portable detector outputs. |
| Prospective representative replay | PASS70cases:51synthetic auto including frozen phase/shared-harmonic controls,3GuitarSetDEV,12supplemental,3native-cap files and long native-success/portable-limit238. Frozen native and fresh native each match exact native baseline; parent/new portable each match within portable target. No cross-target float-equality acceptance. |
| Original edges/large inputs | PASS424original frozen byte/status/error cases plus6original seeded30/300s all-mode cases;430rows,0failures. No new labels/scoring/normalization/holdout. |
| Final Node and WPE cost | PASS one run per runtime,972calls each,54distributions and18candidate gates each;3blocks,3warm+15retained, original row order/state history/scheduler, linear p95, no retries/outlier removal. All complete outputs saved and independently re-audited. |
| Mounted busy cancellation/retry/persistence | PASS actual latest React/UI/worker/new WASM; identified OS DSP owner, genuine release-before-copy, unchanged canonical PCM, one adoption, Save/reload/Open/verified audio/playback, scoped budgets. |
| Root early-cancel repair / bounded click / stale reply | PASS normal uninstrumented build. Actual successful restore reply withheld before refine, then Cancel; successor ordinary refine admitted; actual captured old callback delivered while successor active; two same-task retry DOM clicks produce one successor refine. No alert, successful next action, saved metadata unchanged. |
| Required local Docker packaging | **FAIL above.** Runtime/nonroot/health/private backend/upload/result/playback/Range/existing e2e journey unrun after strict build failure. Prepared scripts are not acceptance evidence. |

Normal source review: the local `Vec<Option<f64>>` is indexed by known-slice position, initialized after the original fundamental loop, and populated only after the same MIDI exclusions. The original f64 expression order and `any()` iteration/short-circuit behavior remain. `Some(NaN)` is a cached value; duplicate MIDI entries do not alias. The cache is not a field and cannot persist across observations. Original reference methods are byte-identical; all other Rust source is unchanged. Production known length is bounded by six fit admissions, then filtering/singleton replacement before frame retention. Requested cache payload96bytes plus header is not an allocator capacity, reclamation, native RSS, GC or allocation-free claim. Cancellation callback locations/order and wrapper64-checkpoint/50ms policy are unchanged. Suspended instance disposal retains its prior scoped contract.

Independent decoder/proof harnesses were read before rebinding paths/roles and executing on independently regenerated candidate bytes. Exact controls/checker/setter were inspected; every saved access/cursor update/control read and complete checker-call set was reconciled. Actual module has zero table mutation/ref.func instructions. Ordinary Rust allocator disjointness remains a premise; this is exact supported-module certification, not a compiler theorem or arbitrary trap-site proof.

[Source review](../target/portable-frequency-independent/review-observations.json), [harness bindings](../target/portable-frequency-independent/harness-bindings.json), [decoder](../target/portable-frequency-independent/binary/summary.json), [access proof](../target/portable-frequency-independent/access-proof.json), [frame proof](../target/portable-frequency-independent/frame-proof-v1/result.json), [complete guard-set reconciliation](../target/portable-frequency-independent/transform-reconciliation-v3.json), [core](../target/portable-frequency-independent/core/results.json), [real controls](../target/portable-frequency-independent/real/results.json), [raw DEV audit](../target/portable-frequency-independent/dev-raw-audit.json), [selection frozen before execution](../target/portable-frequency-independent/prospective-dev-selection.json), [70case raw replay](../target/portable-frequency-independent/dev-sample-data/), [430edge/large rows and text](../target/portable-frequency-independent/edge-data/).

## Frozen identity and reproducibility limits

| Item | SHA256 |
| --- | --- |
| Candidate inventory | `c0e4f3035548fde29b56016b2e31ffc94253ac2bf80705c2e1fa4e217f6f0bd4` |
| Parent inventory | `8a030e14d84c4e8199920a96be104cbc04ea28afec10d56ffc9ad741391c2595` |
| Complete patch | `08d8020adbbe3349527d4d8c500b20345a9b5b23170e6a5d6c0e10f2d0bb7ce9` |
| Source association | `be51d5825397a9745af5f5b1ab37b34ee2f411951a845500e2e3f74f93f8d4a2` |
| Frozen native executable | `7007da35f9bdfe8e623a1fa5c9639da6e8f1f91ad194be7af6f088b0f4365621` |
| Raw host WASM | `4e8d5b329269b59f853962982a4cd73fd0ca3334497716be6ad531632b0d5870` |
| Reference WASM | `a2be0bfd51b2cd28d543d272bfc0f55648626781aeda7d72ca9ecf8f8f806cf7` |
| Portable WASM | `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b` |

Engine3.1/bridge2/schema1 remain unchanged. Host normal generation, fresh check and independently staged transformations reproduce the exact listed WASM bytes; all220owned source entries also match after execution.

**Native exact hash is not independently reproduced.** The ordinary fresh release build is `b667bd7f81a939b838f3b1110a8450e032c05deca73656c8e3efa02c366d72b1`, versus frozen `7007da35…`. Embedded Cargo-home paths differ in the binaries; path dependence is a plausible explanation, not a proved exclusive cause. Full expected numerical bytes/status/streams from both binaries matched all70selected cases. The initial strict exact-native assertion remains failed. One prospective path-equivalent compiler wrapper/build was prepared but **not executed** because the substantive Docker defect stopped further acceptance. Do not report exact-native reproduction as passed. [Reproduction record](../target/portable-frequency-independent/reproduction.json), [native string diff](../target/portable-frequency-independent/native-path-diff.txt), [native default build](../target/portable-frequency-independent/native-build/).

## New final timings

Every row uses all15retained values; all3warmups and complete raw results remain. WPE is WebKit2359 Linux26 with private Noble libraries, **not Safari**. Its measured boundary is the actual current product worker `computeMs` (including JSON parse/validation); Node is the public generated call through settlement. Historical synchronous references use exactly bridge1 adapters; candidate retains bridge2. The only candidate worker observer appends raw text after computeMs. No proc sampler or Docker/build overlap occurred during costs. Machine/load/process snapshots are retained.

| Block | Fixture | Node candidate p95 ms | WPE candidate p95 ms |
| --- | --- | ---: | ---: |
| 1 | sideband | 296.227129 | 304.900000 |
| 1 | dense | 133.632934 | 122.300000 |
| 1 | real-solo | 175.472252 | 199.900000 |
| 1 | real-comp | 128.269664 | 131.600000 |
| 1 | noise | 97.853002 | 113.500000 |
| 1 | dense-boundary | 64.221029 | 65.600000 |
| 2 | sideband | 479.491756 | 305.700000 |
| 2 | dense | 119.662277 | 126.300000 |
| 2 | real-solo | 201.294780 | 187.200000 |
| 2 | real-comp | 142.089622 | 129.000000 |
| 2 | noise | 109.078619 | 98.300000 |
| 2 | dense-boundary | 72.696909 | 69.800000 |
| 3 | sideband | 311.256446 | 309.100000 |
| 3 | dense | 115.087977 | 127.900000 |
| 3 | real-solo | 175.780307 | 187.500000 |
| 3 | real-comp | 121.831645 | 127.600000 |
| 3 | noise | 91.546123 | 98.600000 |
| 3 | dense-boundary | 63.260312 | 75.500000 |

All18candidate gates each are <=500ms. Maximum Node **479.491756ms**; WPE **309.100000ms**. The high Node block2 sideband samples remain intact. This run is bounded evidence for this machine/load, not a universal performance guarantee or an explanation of old spikes. Historical557.2169716ms Node and557.8ms WPE failures remain failed.

[Frozen protocol](../target/portable-frequency-independent/cost-protocol.json), [Node all972calls/text](../target/portable-frequency-independent/final-node-data/), [WPE all972calls/text](../target/portable-frequency-independent/final-wpe-corrected-data/), [independent raw/row/p95 recomputation](../target/portable-frequency-independent/cost-audit.json), [Node machine/load](../target/portable-frequency-independent/cost-machine-before.json), [WPE machine/load](../target/portable-frequency-independent/cost-machine-before-wpe.json).

## Actual CPU stop, retained audio and UI

Unique source/birth/readiness/raw-entry and real pre-handler CPU growth identify **1122360/1122396/3325684**; growth710ms ticks. First complete absence is **47.700ms** after Cancel, no reappearance/post250ms sighting through **14074.700ms**; maximum census4ms. This is independent of the ack/API return.

UI retry begins1.900ms after Cancel. Actual helper release reaches ingestion at36.100ms, **32.800ms before the next full copy**. Old OS owner is absent21.200ms before that copy. Exact child/key/request/equal-watermark and same-generation joins, the same440canonical chunk backings, two distinct full sender copies and actual detachment pass. Zero restore reads occur during retry; the later reload has its own genuine read. One UI adoption; genuine PCM SHA `aacd33386dd292c074ba01075db0935c108a0e7dc92c5548f4b5c1cd02c047fa` remains after Save/reload/Open. Playback advances with300s duration, readyState4 and no media error.

Named stopped-retry audio **89611264bytes** (including2MiB metadata reserve) <96MiB/100663296bytes. Conservative old+new WASM high waters **31064064+40435712=71499776bytes** <128MiB/134217728bytes. No allocator/native RSS/GC/whole-app/arbitrary caller or initial restore/Save/verification/WAV/playback memory claim.

[Busy assertions/calculations](../target/portable-frequency-independent/busy-analysis.json), [raw CPU/censuses/marks/transport](../target/portable-frequency-independent/mounted-busy/), [early-cancel repaired result](../target/portable-frequency-independent/mounted-early/result.json), [early real transport including captured stale callback](../target/portable-frequency-independent/mounted-early/transport.json), [observer plan/transforms](../target/portable-frequency-independent/harness-observer-plan.json). Screenshots are incidental debug files, not proof. Existing synthetic queued-cancel/stale-release/deadline controls passed; no separate genuine withheld-release queued-cancel mounted run is claimed.

## Commands, setup failures, stop and cleanup

All actual acceptance commands use the owned isolated runner (pinned Node24.22.2; direct Rust1.89 cargo/rustc/rustdoc; owned Cargo home/target/dependencies/cache/temp/HOME and empty npm userconfig). Verified bindgen0.2.100/Binaryen125 aliases are read-only. Every named run records full argv/cwd/environment/PID/UTC/exit/stdout/stderr. Container-only installs followed the unchanged Dockerfile; no host installs/settings/credentials were changed.

```sh
python3 validation/portable-frequency-independent/prepare.py
python3 validation/portable-frequency-independent/build-test.py
python3 validation/portable-frequency-independent/execute.py dev-raw-audit . python3 validation/portable-frequency-independent/audit-dev.py
python3 validation/portable-frequency-independent/certify.py
python3 validation/portable-frequency-independent/prepare-runtime.py
python3 validation/portable-frequency-independent/runtime-tests.py
python3 validation/portable-frequency-independent/numerical.py
python3 validation/portable-frequency-independent/cost-run.py
python3 validation/portable-frequency-independent/cost-run-v2.py
python3 validation/portable-frequency-independent/mounted-run.py
python3 validation/portable-frequency-independent/execute.py cost-raw-audit . python3 validation/portable-frequency-independent/audit-cost.py
python3 validation/portable-frequency-independent/docker-build.py
python3 validation/portable-frequency-independent/docker-build-v2.py
python3 validation/portable-frequency-independent/docker-red-probe.py
python3 validation/portable-frequency-independent/analyze-docker-red.py
python3 validation/portable-frequency-independent/closeout.py
```

The list indexes executed orchestration, not a sequential replay recipe; small prospective binding/amendment commands and chronological UTCs are in the actual logs and preserved scripts. Output directories intentionally refuse overwrite. `prepare-runtime.py` created the initial selection/runner; before its first execution the native-amendment added both frozen and fresh native calls.

Preserved non-passes: default native exact-hash assertion; zero-call cost source-binding assertion (expected boolean syntax versus real `choice(...,[1])`, corrected without changing worker/protocol/criteria); zero-build Docker context/log-directory name collision (separate owned names fixed before Docker ran); actual Docker failure; same strict red diagnostic Docker failure. An offline log parser initially assumed one diagnostic JSON occurrence; BuildKit repeated it in its error footer, and the parser now requires all occurrences identical. None of these is relabeled a new product pass. [Actual nonzero command ledger](../target/portable-frequency-independent/failure-ledger.json), [cost zero-call amendment](../target/portable-frequency-independent/cost-zero-call-binding-correction.json), [Docker zero-build amendment](../target/portable-frequency-independent/docker-zero-build-correction.json). The inherited safety config over-pinned an unrelated dormant DEV harness later amended before its own execution; its original bytes and the unchanged actually used safety dependencies are accounted for in [safety harness closeout](../target/portable-frequency-independent/safety-harness-closeout.json).

Bookends verified **10811protected pins** and **2321additional baseline/input pins**, all candidate/parent/tool/artifact identities, all220private source and Docker-context entries, the grant and final-cost pins. [Before](../target/portable-frequency-independent/inputs-before.json), [after/cleanup](../target/portable-frequency-independent/inputs-after.json), [command index](../target/portable-frequency-independent/commands.json). Counts describe file preservation, not test inflation.

Owned processes, runtime containers and profiles remaining: **zero**. All three opened owned ports refuse connections; WPE and both Chromium browser/server trees were closed, with cleanup censuses retained. Failed BuildKit runs finished; no final image/runtime container was created. Only their isolated build caches/context/evidence remain; no unrelated Docker cleanup was performed. Required container runtime/e2e checks and prepared additional native-remap build are explicitly unrun. No production/DB/default dist/preview, original candidate, corpora, labels, scorers, holdout or sibling checkout was modified.

**Heavy execution released at 2026-11-01T01:48:49.501145+00:00 UTC.** [Actual release](../target/portable-frequency-independent/heavy-release.json). Only report/evidence inventory writing followed. Root owns fixes, integration, and any future acceptance/commit/ship. No manual user QA requested.
