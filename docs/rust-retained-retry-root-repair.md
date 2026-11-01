# Cancel during loading: root repair

The independent tester found that Cancel during restore marked the action as a
canceled refinement even though no refinement request had been sent. Restore
cancellation disposes that runtime. The next Refine click then attempted a
retained retry against the disposed runtime and failed.

Root fixed the finding in an isolated copy. The caller now records whether this
action requested refinement. Only cancellation after that point enables retained
retry; cancellation while loading leaves the ordinary fresh-restore path enabled.
The worker release gate, cancellation routing, numerical code and generated
artifacts are unchanged. The active application and production were not edited.

The new caller-state test fails on the frozen parent and passes after the repair.
It cancels during restore, checks that results and saved state are untouched,
then runs the next action and requires a fresh restore and successful refinement.
The existing test still requires an admitted canceled attempt to reuse its
recording without another restore.

Validation:

- All 36 focused tests across six files pass.
- Normal build passes, including strict TypeScript and WASM source verification.
- Normal lint checks 145 files: zero errors, 13 existing warnings.
- The independent tester's mounted early-cancel reproduction passes against the
  repaired normal production build: actual React, IndexedDB, workers and WASM;
  one genuine successful restore reply is withheld to exercise Cancel while
  loading. The next click sends an ordinary refinement in a fresh generation,
  completes successfully, produces no alert, and preserves the saved metadata.

Commands, from the repository root:

```sh
python3 validation/retained-retry-root-repair/run.py red node node_modules/vitest/vitest.mjs run --config ../vitest.config.ts src/components/LiveListen.retained.test.ts
python3 validation/retained-retry-root-repair/run.py green node node_modules/vitest/vitest.mjs run --config ../vitest.config.ts
python3 validation/retained-retry-root-repair/run.py build npm run build -- --outDir /home/xtra/code/personal_projects/fretbloom-song-audit/target/retained-retry-root-repair/dist-normal
python3 validation/retained-retry-root-repair/run.py mounted-early node ../mounted.mjs early fixed
python3 validation/retained-retry-root-repair/run.py lint npm run lint
```

The runner uses pinned Node 24.22.2 and private output/cache paths. The recorded
red run preceded the source fix. Output names refuse overwrite. The mounted
harness differs from the independent replay only in its owned path names;
its existing delayed-delivery limitation remains: delivery uses the current
callback, not a retained old callback. This is the reported loading-cancel
reproduction, not a new stale-callback proof or CPU benchmark.

[Identity and exact hashes](../target/retained-retry-root-repair/identity.json),
[two-file repair](../target/retained-retry-root-repair/repair.patch),
[source inventory](../target/retained-retry-root-repair/source-inventory.json),
[browser result](../target/retained-retry-root-repair/mounted-fixed/result.json),
[command ledger](../target/retained-retry-root-repair/commands.jsonl).

Inventory SHA256: `8a030e14d84c4e8199920a96be104cbc04ea28afec10d56ffc9ad741391c2595`.
Repair SHA256: `304f4427ab18afe249b089d15b4a132971445594bd38c910d6bfa7394fee5768`.
All 220 parent entries remain unchanged. The new inventory differs in only
LiveListen.tsx and its caller test. WASM source association remains `97dc9733…`
because these component paths are outside the numerical/worker association;
portable WASM remains `8aab705e…`. No manifest or verifier was edited.

The independent busy retry/CPU/scoped-buffer/persistence passes remain evidence
for the unchanged worker path, with their stated scopes. Root did not repeat
that full campaign. Queued genuine-release cancellation and a separate mounted
repeated-click control remain unexecuted beyond the existing focused controls.
This root repair does not claim a second independent review or full adoption.
Prior Node/WPE speed failures and musical nonacceptance remain open.

[Heavy execution released](../target/retained-retry-root-repair/heavy-release.json)
at 2026-11-01T00:32:31.595572+00:00. The browser task census is empty, its server
is closed and profile removed; all logged build/test processes finished.
