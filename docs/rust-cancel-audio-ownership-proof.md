# Bounded capture and audio ownership execution

Independent Sol6.1 xhigh executor; no children, followups, watchers or schedules. 2026-10-31 UTC. **Six browser/DSP attempts completed the authorized package. Adoption remains NO-GO.** There is a useful WPE capture pass, a scoped maximum export/play/Save memory bound, a real retry CPU-stop pass, and an explicitly unresolved retry memory interval. No product defect or actual buffer-cap violation was established; no product patch is proposed.

Writes are confined to `validation/cancel-audio-ownership-proof/**`, `target/cancel-audio-ownership-proof/**`, and this report. Active/frozen source, generated assets, default dist/preview, sibling checkout, previous evidence/harnesses, corpus/scorer/labels/holdout and production/DB stayed read-only. Only fresh owned loopback browser IndexedDB was written. No install, credentials, commit, push, deploy, WASM regeneration, Rust parity repetition, performance profiles or acceptance reruns occurred.

## Authority, bindings and build

The genuine root grant is `target/cancel-audio-proof-root-grant.json`, SHA256 **76b61b330742466a3864130a81a17073f75915c576b45115c6add12df70b6e22**. Both required root reviews were read fully before preparation, followed by the repaired-browser report, frozen runtime/ingestion/analysis/worklet/resampler/verification/WAV/storage source and actual retained harnesses/joins. The diagnosing-bugs skill supplied the bounded observation method; its general repeat/minimization advice was superseded by the user's explicit once-per-case limit.

[Initial binding amendment](../target/cancel-audio-ownership-proof/binding-amendment.json), [executor scope release](../target/cancel-audio-ownership-proof/scope-release.json), [corrected observation release](../target/cancel-audio-ownership-proof/scope-release-v2.json), and [maximum release](../target/cancel-audio-ownership-proof/scope-release-maximum-v2.json) were frozen before the executions they govern. Case plans are individual `case-*.json` files. Some base plans name the original parent release; the actual v2 executor gates its own frozen v2 amendment, which prospectively names those base cases. No previous grant or preparation was modified.

Candidate identity/inventory remain **dc7dc27eb63bf03c384ae7bf1a5466eaad946d9819a4c5b8fc8e4db4a7a64bed / 56ba0c4169ee9c2180f07056403b0f83cec0dda0974b3d1b3b810442c26806dc**, source association **646cbb9a09577a7362548c416959a2f5caf7dd4f13f94002f31ceb4955ef9f69**, portable WASM **8aab705ee1f1929f1d3d3bcc8513a5971d8699d7bce68ac983e116d95254c05e**, rust-dsp-3.1/bridge2/schema1. Previously closed 424 exact-byte cases, new-binary safety and reproducibility were consumed, not rerun.

Pinned Node **24.22.2**, executable SHA256 **904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52**. Browser launches use Chromium143 rev1200 **143.0.7499.4**, Firefox155 rev1543 **155.0**, and private-library Linux WPE2359/reported **26.0**, not Safari. Exact commands, executable paths, environments, process IDs and source maps are in [pins](../target/cancel-audio-ownership-proof/pins.json), per-run `launch.json` and [final verification](../target/cancel-audio-ownership-proof/final-verification.json).

**Normal verifier, normal `tsc -b`, normal Vite production build and all three harness builds passed.** The build plugin asserts exact original source hashes and every observation replacement; 30 common hooks and one additional maximum verification-constructor hook bound successfully. Detailed boundary/network/census observations can affect scheduling and are diagnostic only. They do not change product numerical calls, waits, timeout values, transfer lists or WASM. No additional tests or broad matrix ran.

All source copies are ordinary owned copies. Cache-bearing `node_modules` parents, `.vite`/temporary build output, HOME/XDG/Cargo/temps and browser profiles are owned; dependency leaves are read-only aliases, never a whole shared writable `node_modules` symlink.

## The six attempts

Each case ran once; no seventh verification-abort attempt was used. Timer budget is 75,000 ms after navigation commit for paced diagnostics; measured totals below include launch/setup before that timer. Product timeouts were unchanged. Checkpoints were persisted as `marks.jsonl` while running, including watchdog pending-state snapshots, rather than held until completion.

| Case | Result and actual elapsed before cleanup |
|---|---|
| Firefox155 automatic | INCOMPLETE, 75,932 ms. 2,880,000-byte body complete; one retained source-bound pre-resume request; resume never reaches the next source checkpoint. First observation adaptation missed the exact resume hook, so context/activation remain unobserved and its `fetch-body` pending label is stale. |
| WPE2359 automatic | INCOMPLETE, 75,289 ms. Body complete, attach acknowledged; `resume()` remains pending, context `interrupted`, clock 0, zero PCM/credit/ended events. |
| Firefox155 trusted click | INCOMPLETE, 75,921 ms. Real `isTrusted:true`, activation true; resume and source start called synchronously in handler. Resume remains pending, context `suspended`, clock 0, zero PCM/credit/ended events. |
| WPE2359 trusted click | **PASS for named paced capture/Stop/export**, 30,944 ms. Resume settles, context `running` at 0.032 s; first PCM and credit at 0.085333 s; source ends at 30 s; genuine notes before Stop, real end-barrier acknowledgement, exact 720,256 observed/stored samples and 2,881,024 exported bytes; context closes. |
| Chromium143 maximum injected PCM | **Functional PASS**, 50,479 ms. Exactly 7,200,000 samples/28,800,000-byte stopped export, genuine array→Blob, WAV/play, release, Save verification/IDB write, playback rebuild, prior-session release, separate IDB load/verification/play/delete. |
| Chromium143 immediate cancel/retry | **Functional PASS; CPU-stop PASS; memory INCOMPLETE**, 21,840 ms. Actual busy Rust call canceled; replacement starts immediately; caller PCM reference preserved across both generations; fresh 300s refinement succeeds. |

Raw results, marks, requests and censuses remain under [runs](../target/cancel-audio-ownership-proof/runs/). The clicked WPE result localizes a harness activation/order difference under these launch policies; it does not pass the old automatic case or establish physical microphone/tab capture. Firefox remains stalled after trusted activation; an autoplay-only explanation is not established. No further engine attempts or speculative environment/product fixes were made.

The automatic versus clicked policies and input are unchanged: Chromium has `--autoplay-policy=no-user-gesture-required`; Firefox has the retained autoplay-default/blocking-policy preferences 0 and JSPI preference false; WPE has no new autoplay preference. No WebAssembly API was removed/replaced. Passive periodic context marks are the activation evidence for automatic WPE; watchdog `page.evaluate` snapshots can themselves report active activation and are not used to infer prior user activation.

These are built-product API/graph tests. The maximum test uses explicit accelerated PCM injection with real ingestion/resampling/canonical storage, not five-minute real-time capture or React-control coverage. Every 65,536 injected frames waits on a genuine live result when needed to keep the accelerated fixture from triggering the product live-lag health check. No artificial sleep, engine reply, compute work or production timeout adjustment is involved.

## Finite ownership proof

[Prospective worksheet](../target/cancel-audio-ownership-proof/ownership-worksheet.json) precedes runtime. P=28,800,000, R=983,040, Q=131,072, E=R+Q=1,114,112, W=14,400,044 bytes; cap=100,663,296 bytes. Recording chunk/ring extents, actual block bounds, decision/downmix/resampler temporaries, 65,536-byte restore scratch and 262,144-byte WAV reads are source-bounded. Stopped phases no longer own capture resampler/decision roots. Queued extent metadata is not another PCM allocation.

[Finite joins](../target/cancel-audio-ownership-proof/finite-joins.json) bridge the weak backing-ID realm to the source owner once, use the actual posted/received values and exact session/generation/request tuple, and observe sender byteLength 0 after transfer. **333 maximum-case transfers and both retry transfers join without a missing backing/detachment match.** No cross-realm alias was inferred from size or hash, and no killed-realm batch loss was made into a free. There were no recorded observation-loss requests.

The maximum export array backing ends `:335`, its constructed immutable Blob `:336` in ingestion owner `f4b98fd0-7a5b-4729-bd83-372214dd3967`. The actual RPC reply for session `6b4623d2-e039-4807-92be-57139a4b89fb`, generation1, request4 carries that Blob. The main reply, facade cache and caller are directly joined to main Blob `4789f321-a331-444b-9a27-b32da0a92f05:2`, with an explicit same-reference check.

Two verification instances (Save and later IDB-load verification) each have one actual dedicated Worker constructor object, that object's single Blob post, the unique one-shot receive/read/backing identity and reply before the next instance. The main Save Blob is the exported `:2`; later IDB-loaded main Blob is distinct `:9`, never deduplicated against export. The constructor hook's `url` field was Vite-inlined to a raw-source data URI, **not the loaded worker URL**; it is ignored for runtime source identity. Actual worker `import.meta.url`, fetched compiled bundle and the reviewed dedicated constructor site supply source identity. The precise route/source/read tuples are retained in [ownership verdicts](../target/cancel-audio-ownership-proof/ownership-verdicts.json).

Playback releases src/URL/audio roots and the helper returns without retaining the WAV before Save verification begins. Each WAV array and new WAV Blob are counted separately at construction; URLs are aliases to that same Blob. Verification's full read has no retained root after `checkPcmIntegrity` returns before its reply; this does not rely on worker termination or GC. The `old-session-roots-released` mark is not itself a free: the cached local remains in the try block until block exit. The IDB load occurs after that block and its finally have exited. A possible old canonical reservation is still carried through the later load/play branch; there is no new canonical runtime there.

For added conservatism, the maximum proof carries **one extra R-sized possible last live analysis input through the whole case**, even after its successful callbacks, rather than assume an unobserved instantaneous free. It also keeps canonical P through disposal; it never releases that reservation at terminate-return.

| Exercised maximum phase | Conservative bytes, including that extra R |
|---|---:|
| Capture, including small fixture/input/scratch | 31,297,016 |
| Stopped export array + constructed Blob | 88,497,184 |
| Save or IDB-load verification read | 88,497,184 |
| WAV array + distinct new WAV Blob | **88,497,240** |

**Maximum single-path memory: scoped PASS**, conservative bound 88,497,240 < 100,663,296. This is source maxima plus actual finite boundary/reference joins, not a sampled native peak, cumulative allocation count, universal GC certificate, all UI routes or all interleavings. No full-sized fixture was retained during injection: the 245,760-byte seed and at most an 8,192-byte injected block are separately included in capture.

### Retry ownership interval remains incomplete

Handler epoch **1793490553637**. Old analysis owner `88683bf9-1edf-495d-aaf0-587c42392f44` joins actual OS identity **771796/771878/2644793**; old ingestion owner `ebbaf1d4-1b6d-44b9-9073-775bd1604462` joins the unique initial DedicatedWorker **771796/771871/2644791**. Their IDs share the same explicit source/backing identity bridge; no independent unjoined ID namespace remains.

- Old analysis last complete presence interval: **+82..85 ms**. First complete missing census: **+87..90 ms**; no reappearance, no presence after the 250ms gate, observation through **+19,471 ms**, actual pre-handler CPU growth **4 ticks** over three complete observations. Whole-worker CPU-stop PASS, diagnostic profile; no per-phase timing/CPU attribution is claimed.
- Old ingestion last presence **+87..90 ms**; first complete missing census **+110..112 ms**, no reappearance. Neither terminate-return nor status0 is used as a free.
- Replacement dispatched **+2.8 ms**. New full Blob read requested **+81.5 ms**, resolves **+106.9 ms**. New canonical decoding begins **+621.9 ms**, after both old owners are missing, and new full refinement begins **+769.5 ms**.
- Main caller PCM `b3836d55-f8c4-45f2-a97a-0455dc04ab47:2` remains live and directly identical to both generation caches. The harness-only full hash-read helper returns before first restore; it is not silently omitted as a retained P.

**Missing link:** during the pending read at +81.5..90 ms, old canonical P and transferred input P must still be conservatively reserved, alongside caller Blob P and the new requested read's uncertain extent. The conservative four-P + two-E + digest envelope is **117,428,256 bytes**, above the cap. The observed resolved-read phase after analysis disappearance is bounded by **88,628,256 bytes**. The record does not establish when the pending read's full application payload becomes owned before resolution, so it cannot close the <=96MiB bound for that interval. It also does **not** show four simultaneously visible/distinct full application payloads and is **not an actual cap FAIL**. No inference about native physical Blob sharing is used.

This is the precise unresolved interval, not a request for a broader allocation logger or another mandatory permission. No product change follows from the accounting uncertainty. These observed exits do not guarantee future retry ordering.

WASM is separate: maximum observed categorized linear backing **40,435,712 bytes**; exact module's already audited maximum **128MiB**, saved stack inside it once. WASM views are not added as JS PCM copies. Verification abort overlap and real production timeout were not attempted and remain INCOMPLETE/unexercised. No synthetic stall is CPU proof.

## Commands, retained first failures and cleanup

Run from `/home/xtra/code/personal_projects/fretbloom-song-audit`. Exact argv/cwd/whitelisted environment/UTC/status/stdout/stderr for all twelve build/browser commands are indexed in [commands.json](../target/cancel-audio-ownership-proof/commands.json). Executor prefix:

```text
/usr/bin/python3 validation/cancel-audio-ownership-proof/execute.py NAME CWD NODE SCRIPT [ARGS...]
NODE=/home/xtra/code/personal_projects/fretbloom-song-audit/.tools/node-v24.22.2-linux-x64/bin/node
```

Actual normal commands were `NODE scripts/wasm-verify.mjs`, `NODE node_modules/typescript/bin/tsc -b --pretty false`, and `NODE node_modules/vite/bin/vite.js build --outDir /home/xtra/code/personal_projects/fretbloom-song-audit/target/cancel-audio-ownership-proof/dist-normal --base /`, in the owned `normal` copy. Harness build entries were `validation/cancel-audio-ownership-proof/build.mjs`, `v2/build.mjs`, and `maximum/build-v2.mjs`. Browser entries/cases:

```text
validation/cancel-audio-ownership-proof/browser.mjs firefox155-auto
validation/cancel-audio-ownership-proof/v2/browser.mjs webkit2359-auto
validation/cancel-audio-ownership-proof/v2/browser.mjs firefox155-click
validation/cancel-audio-ownership-proof/v2/browser.mjs webkit2359-click
validation/cancel-audio-ownership-proof/maximum/browser-v2.mjs chromium143-maximum
validation/cancel-audio-ownership-proof/v2/browser.mjs chromium143-retry
```

`freeze.py CASE` (or the explicit frozen maximum/Firefox conditional plan) preceded each case. Static reductions used `/usr/bin/python3 validation/cancel-audio-ownership-proof/{joins.py,assess.py,closeout-v2.py}`; no new DSP runs.

All initial records remain. In particular:

1. First Firefox automatic binding missed the retained v6 pre-resume text and posted one checkpoint to the old unhandled endpoint; v1 source/build/release/timeout are intact. The conditional click was admitted from that exact source/request unresolved-resume join, not a fabricated suspended-state observation. New v2 exact text binding added resume/state/activation/clock and intermediate setup steps, and bounded watchdog snapshot evaluation to1s. No automatic Firefox rerun.
2. WPE automatic and Firefox clicked watchdogs remain INCOMPLETE; successful cleanup/exit0 is not functional success. The fixed old150s text was not reused; each new result reports its actual75s timer budget and elapsed.
3. An external Firefox cleanup script was invoked after its native case cleanup had already completed. The recorded PID was already absent; no process was killed. The mistaken suspected-watchdog-failure note and its explicit correction both remain, rather than rewriting the original record.
4. The first closeout verifier misidentified read-only `node_modules/playwright-core` aliases as profiles by following `is_dir()`. [Original failure](../target/cancel-audio-ownership-proof/closeout-first-failure.json) and original verifier remain. New `closeout-v2.py` excludes dependency aliases from actual profile detection. No browser/DSP case was repeated.

Normal verifier/type/build and all harness build statuses are PASS. Final closeout rehashes every frozen candidate entry, protected files and named review inputs, all four product source copies, retained tool/system/requested-browser maps, all frozen executor releases and all four built WASM files. Final external cleanup confirms six ports closed, zero owned execution/browser processes and zero direct/nested profiles. Closed owned Pulse temporary directories are removed after zero process/port/profile verification; their original cleanup records remain. Static library maps are checked, but exhaustive actual dlopen/native-helper closure is not certified.

Original WPE **557.8ms**, Node **557.2169716ms** and repaired diagnostic **537.39608ms** failures remain; nonreproducing later profiles do not erase them. Musical acceptance remains failed/unmet. No accepted compute-speed or adoption claim follows from these proofs.

Final verification: **220 candidate entries, 534 protected files, 65 named review inputs; four ×217 product files unchanged**. The static maps retain2247 tool/dependency,214 system-library and305/42/111 Chromium/Firefox/WPE entries. All four built WASM hashes match the exact candidate.

Heavy ownership released to root at **2026-10-31T23:52:56.988311+00:00 UTC**, after a fresh zero-owned-process/port/profile check. See [heavy release](../target/cancel-audio-ownership-proof/heavy-release.json), [findings](../target/cancel-audio-ownership-proof/findings.json), and [artifact hashes](../target/cancel-audio-ownership-proof/SHA256SUMS). No background work remains.
