# Independent HOST/CONTAINER BUILD review — PASS

Narrow packaging and exact-byte inheritance scope only. Independent Sol6.1 xhigh review, no children, product edits, adoption, commit/push/deploy or manual QA. Musical recognition remains **FAILED**; the three native event-cap failures and earlier timing/cancellation/build failures remain recorded.

## Findings and causal review

**No blocking product finding in this scope.** Both220-file candidate/parent inventories and the exact patch hashes supplied in the brief verify. The reconstructed diff is exactly six added lines in `scripts/wasm-build.mjs` plus the normally generated manifest's source association/helper digest. All numerical Rust, worker/UI, registration constants, guards, raw/reference pins and other sources are unchanged. [Input audit](../target/portable-container-independent/inputs-before.json), [observations](../target/portable-container-independent/review-observations.json).

At [wasm-build.mjs:83](../validation/portable-container-repro/source/scripts/wasm-build.mjs), assignments after `...process.env` override ambient `WBG_VERSION` and `GIT_CEILING_DIRECTORIES`. The pin intentionally preserves opaque already-tested metadata; `ed6507981` is this project's ancestor Git HEAD prefix, **not an upstream wasm-bindgen revision**. Dependency `wasm-bindgen-shared0.2.100/build.rs:10–19` invokes Git and may override the inherited value via `cargo:rustc-env`. Its `src/lib.rs:233` consumes that value with `option_env!`. The resolved Cargo-home ceiling blocks that ancestor discovery: fresh independent Git calls actually find `ed6507981fb61804098be7bfc6d955bdcf2cae37` without the ceiling and exit128 with it. This is a fresh target/ordinary registry-layout proof; it does not promise arbitrary Git overrides or stale build-script-cache compatibility. Strict raw verification still rejects byte drift.

I independently parsed the actual old raw binaries, rather than relying on the explanation: all14 section entries reconcile; only custom `__wasm_bindgen_unstable` differs. Both program records (72/111bytes) match; only their JSON version strings change from `0.2.100` to `0.2.100 (ed6507981)`. Code/data and every other complete section match. The numeric helper at [wasm-portable-metadata.mjs:57](../validation/portable-container-repro/source/scripts/wasm-portable-metadata.mjs) retains those custom sections, removing only the reference-types feature entry; executing it reproduces the old differing numeric hashes while non-custom hashes remain identical. Thus the previous report's assertion that the numeric mismatch disproved metadata-only drift was incorrect; that protected report remains untouched. The builder's one-variable Dockerfile adds only `WBG_VERSION` to the original wasm stage and its retained actual log passes the original strict gate with the frozen raw hash. [Independent raw/header/Git audit](../target/portable-container-independent/causality-audit.json), [numeric-helper/host manifest audit](../target/portable-container-independent/host-identity.json).

Strict checks remain at [wasm-build.mjs:101](../validation/portable-container-repro/source/scripts/wasm-build.mjs) (raw),106(reference),110(source stability),161(all generated artifacts). Unchanged [wasm-portable-build.mjs:30](../validation/portable-container-repro/source/scripts/wasm-portable-build.mjs),32,40,44,47 enforce raw/numeric/numeric ABI/Asyncify/access inventory. Unchanged [wasm-verify.mjs:82](../validation/portable-container-repro/source/scripts/wasm-verify.mjs) enforces source/tool association and each artifact. No expected hashes, verifier rules, guards or manifest contents were hand-edited.

## Fresh builds and identities — PASS

One normal HOST `node scripts/wasm-build.mjs --check` ran with pinned Node24.22.2, direct Rust1.89.0 cargo/rustc/rustdoc, bindgen0.2.100 and Binaryen125. Ordinary owned source, Cargo registry, fresh target, HOME/cache/npm/temp paths; no checkout/worktree or inherited build output. All ten artifacts match the parent. The normal manifest schema was independently reconstructed from actual engine-info, current tools/source identity and file digests and compared **byte-for-byte**, without writing the generated manifest. [Host command/logs](../target/portable-container-independent/host-check/), [identity](../target/portable-container-independent/host-identity.json).

The actual unchanged [Dockerfile](../validation/portable-container-independent/docker-context/Dockerfile) full build passes using `--no-cache-filter wasm-builder,rust-builder,node-builder`. The retained full log shows all three compile RUN steps executed fresh (WASM#27, native#20, Node#37); installation layers may cache. Only the exact220input files enter the ordinary context. A separate appended scratch export reads the just-built WASM stage through cache; it is explicitly **cached byte extraction**, not another fresh build. Actual extracted raw, all ten artifacts, and manifest match exactly. [Full build](../target/portable-container-independent/full-image/), [cached export](../target/portable-container-independent/extract-built-bytes/), [complete artifact hashes/fresh-stage audit](../target/portable-container-independent/build-inheritance.json).

| Identity | SHA256 |
| --- | --- |
| Candidate inventory | `01ee9b4939f29f3874b1d1c431d1ef05c4c86bf04bad4a57b87a728d67ae9a47` |
| Parent inventory | `c0e4f3035548fde29b56016b2e31ffc94253ac2bf80705c2e1fa4e217f6f0bd4` |
| Exact minimal patch | `560cd65c2f78d74f9f5d5b6b8c8a065b32c9217f4318ebf5f44072011dfc6805` |
| Source association | `72fc751b600cdb5e18bad1a7103527ed6c45ba0a0bf2e67e72ce9df39623b210` |
| Raw HOST and CONTAINER WASM | `4e8d5b329269b59f853962982a4cd73fd0ca3334497716be6ad531632b0d5870` |
| Reference WASM | `a2be0bfd51b2cd28d543d272bfc0f55648626781aeda7d72ca9ecf8f8f806cf7` |
| Portable WASM | `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b` |
| Manifest | `8ca6f29a1c09f568ca17f81e72675c6e247cb589d474898e04903e324d613b70` |
| Actual image/index | `sha256:c83b35ac11e159de5bde42400b9a3a98ca27ed25e2133235ad546e607c051bc6` |

Exact artifact inheritance carries the existing [independent frequency review's](rust-portable-frequency-independent.md) bounded safety/control/numerical/edge/large-input/Node-WPE-cost/mounted cancellation/CPU/audio/persistence proofs forward. Those campaigns were **not rerun** or expanded. This repair closes the prior packaging blocker on this new candidate; it does not rewrite the old failed build or imply musical approval.

## Actual isolated packaged runtime — PASS

The actual image ran as `node`/UID1000, Node24.22.2, no mounts, one published port `127.0.0.1:32771→4173`. Rust5210 stayed private on container loopback. Health200/`ok`, runtime portable WASM exact. Supported **development browser-only storage** (`NODE_ENV=development`), no `DATABASE_URL` or production credentials; no production/daily-driver/sibling/database access. [Sanitized inspect](../target/portable-container-independent/docker-inspect.json), [runtime listeners/module](../target/portable-container-independent/docker-runtime.json), [container log](../target/portable-container-independent/docker-container.log).

A separate real API job POST202/PUT202 reaches native Rust success, actual result/63feature frames and exact decoded PCM hash `d5b3a0cbd8b3a1f6e191cafd76ae07348f03c3ce5adc84ee7d51849eaf3b8274`. Full GET200 returns all240044expected WAV bytes; HEAD200 has empty body/exact length; Range206 returns exact bytes0–43/content-range. DELETE202 marks canceled and refuses result/features/audio with409. A separate upload/cancel/delete job reaches canceled. API checks own their lifecycle, avoiding the old post-UI-finally-DELETE harness error. [PCM/HEAD/Range](../target/portable-container-independent/docker-native-api.json), [API lifecycle](../target/portable-container-independent/docker-api-job-lifecycle.json), [cancel/delete](../target/portable-container-independent/docker-cancel-delete.json).

Real pinned Chromium143.0.7499.4 ran the existing upload/Save/reload/Open/playback/seek/manual timing/lyrics/reattachment/replacement/mobile/tuner assertions, preserving their original checks in the corrected harness. Matching PCM restores playback and manual timing/lyrics; same-name/same-size changed PCM invalidates them. Actual browser result/features/audio200 and cleanup DELETE202 are recorded; no page errors. Observed upload journey2519ms is incidental, **not a timing gate**. No YouTube acquisition or manual QA. [Harness plan/adaptation](../target/portable-container-independent/runtime-harness-plan.json), [executed harness](../validation/portable-container-independent/docker-e2e.mjs), [browser network](../target/portable-container-independent/docker-browser-api.json), [journey](../target/portable-container-independent/docker-journey.json), [actual run](../target/portable-container-independent/container-runtime/).

## Native evidence audit — PASS within path-equivalent scope

Rehashed both the builder's controlled remapped executable and original frozen executable: full2452488bytes match `7007da35f9bdfe8e623a1fa5c9639da6e8f1f91ad194be7af6f088b0f4365621`. Inspected protocol, actual wrapper, all63final rustc argv records (55compile rows), and successful fresh build log. Every final invocation appends exactly the three owned source/Cargo-home/target→original-builder mappings. No numerical/source/tool change or output rewrite. No new native rebuild was needed. Independently rehashed the original default binary too: `b667bd7f81a939b838f3b1110a8450e032c05deca73656c8e3efa02c366d72b1`; its default-path mismatch remains. Host/container ELF equality is not imposed. [Audit with file hashes and mappings](../target/portable-container-independent/native-provenance-audit.json).

An extra read-only diagnostic assertion wrongly expected Cargo's fingerprint `rustflags` to contain flags appended later by the compiler wrapper. It failed with exit1 and is preserved; that fingerprint correctly records Cargo's empty supplied flags, while the actual final compiler argv records the wrapper's additions. The full binary/argv audit already passed. No product edit, extra rebuild, acceptance retry or relaxed gate resulted. Builder/earlier independent failures also remain pinned and unchanged. [Preserved assertion](../target/portable-container-independent/fingerprint-assertion-failure.json), [failure ledger](../target/portable-container-independent/failure-ledger.json).

## Preservation and release

Final check verifies **13610protected input/tool pins**, both220-file frozen source inventories, candidate patch, and both ordinary owned source/context copies. Only authorized `target/portable-container-independent/**`, `validation/portable-container-independent/**`, and this report were written. Owned container/browser/processes are gone, profile count0, port32771connection refused; only an empty owned Pulse scratch directory was removed. Owned image/cache/evidence remain; nothing unrelated was stopped or cleaned. [Verification](../target/portable-container-independent/verification.json), [exact command/UTC index](../target/portable-container-independent/commands.json), [frozen evidence hashes](../target/portable-container-independent/evidence-inventory.json).

Actual execution commands, all from repository cwd except the recorded host working directory:

```text
python3 validation/portable-container-independent/prepare.py
python3 validation/portable-container-independent/build.py
python3 validation/portable-container-independent/audit.py
python3 validation/portable-container-independent/execute.py host-identity . .tools/node-v24.22.2-linux-x64/bin/node validation/portable-container-independent/identity.mjs
python3 validation/portable-container-independent/execute.py extract-built-bytes . docker build --progress=plain --target independent-byte-export --output type=local,dest=target/portable-container-independent/container-bytes -f target/portable-container-independent/Dockerfile.byte-export target/portable-container-independent/docker-context
python3 validation/portable-container-independent/execute.py container-runtime . .tools/node-v24.22.2-linux-x64/bin/node validation/portable-container-independent/docker-run.mjs
python3 validation/portable-container-independent/closeout.py
```

`build.py` executes the single fresh host check followed by the single full unchanged-Dockerfile build, each through the owned runner. Full argv/safe explicit environment/cwd/PID/UTC/status/stdout/stderr are retained per named command. Small read-only audits/source adaptations and the preserved diagnostic assertion are described above. Named outputs refuse overwrite.

**Heavy execution released 2026-11-01T02:07:11.772238+00:00 UTC.** No further tests/polling after this release. [Release record](../target/portable-container-independent/heavy-release.json). Root owns any integration; no adoption or broad music approval is authorized by this PASS.
