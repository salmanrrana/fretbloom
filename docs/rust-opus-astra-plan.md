# Opus × Astra joint decision record — round 1

2026-10-31. Opus 5.5 (architecture lead) proposed in `docs/rust-opus-architecture.md`; Astra xhigh challenged it in `docs/rust-astra-xhigh-architecture.md`. This record is the reconciled decision and the work assignment. Active engine stays rust-dsp-3.1 (source `f75b55eb…`, native `d3bec4e4…`, WASM `c9217873…`; Astra re-ran `scripts/wasm-verify.mjs`: PASS). Nothing here is a musical accuracy claim.

## What changed after the challenge

| Topic | Opus proposed | Astra's response | Decision |
| --- | --- | --- | --- |
| Biggest problem | Recognition/events; partial results on overflow | **Automatic song timing from 3.1 is thrown away today**: three hard-coded `rust-dsp-1` checks (`SongbookPlayer.tsx:192`, `AudioAnalysisPanel.tsx:140`, `songbook.ts:137`) reject every current result. Opus re-verified. | **Accept as top fix (P1).** This breaks the core play-along value with no detector involved. |
| Sheet-first contract (O1) | Make sheet-informed the primary contract; alignment is feature-only | Direction right, "feature-only" wrong: `alignRichAnalysis` needs harmony evidence for rich chords; features are built from confirmed notes, so detector defects reach them too. Sheetless follow and the tuner still matter. | **Accept, modified.** Write a versioned contract; rich chords keep their harmony dependency. The new quality test set is deferred and listed as unproved. |
| Fragmentation (fact 3) | ~30× over-segmentation explains cap failures | Rejected as causal: 142/148 are pickup-label counts, caps are per stream, harmony spans aren't comparable to note-ons; palm-mic has 9,694 union runs even without route splits. | **Astra is right.** Keep caps. Stop calling every overflow "unstable events". |
| Partial results (O2) | Implement now | Delivering it needs a new outcome type across core, jobs (failed artifacts are deleted, routes deny audio), WASM, client, both save stores. The 552 s files are over the browser limit anyway and are note drills, not demonstrated sheet-sync cases. | **Defer.** If done later, use Astra's shape (a): an explicit, versioned `alignment_only` outcome that old readers reject. Never empty arrays posing as success. |
| YouTube duplication (O3) | Two downloads per song; reuse job audio | Refuted for the success path: canonical Rust audio already feeds playback. The Node fallback runs only after failure, for unanalyzed songs, or Node-only setups, and job URLs are deleted after analysis. The legacy recognizer chain is unreachable but still referenced. | **Accept as cleanup only.** Delete the dead chain, keep the Node fallback, and bound the fallback's Blob read. |
| Event redesign (O4) | Defer until a causal trace exists | Strongest case against deferral: "trace first" without a spec is endless delay. Astra specified a bounded passive admission trace with kill/justify rules. | **Accept the trace now; the redesign stays deferred** and depends on its result. |
| Refactor (O5) | Reject because evidence exists | Reject a file-size refactor, but fix real state bugs: the mic consecutive-frame counter survives silence/gaps (`SongbookPlayer.tsx:476`, `PracticeChordMode.tsx:63`). Opus verified. | **Accept the narrow fix.** Thresholds unchanged. |

Opus's own concession: the original proposal undervalued checking the current save/playback path before architecture changes. That check found the highest-value defect.

## Accepted work

### Package A — product fixes (Sol 6.1 xhigh builder A)

1. **Engine compatibility policy.** Write one explicit supported-engine + alignment-version policy in a new module. 3.1 timing is saved, restored and played. Unsupported or unknown engines are still refused. Don't accept any `rust-dsp-*` string. PCM/sheet/source association checks stay separate and unchanged.
2. **Mic follow state fix.** Reset the consecutive-match counter on silence and missing frames in both Songbook and Practice. Cancel any pending advance when the target changes or listening stops. Same thresholds.
3. **Dead legacy recognizer removal.** Delete `songAnalysis.ts`, `songAnalysis.worker.ts`, `songAnalysis.test.ts`, plus `analyzeYouTube` with its cache/types and their tests. Remove `recognizeChords` and its decoder-only helpers from `chordRecognition.ts`. Keep `loadYouTubeAudio`, `songAnalysisTypes.ts`, `pitch.ts` and the helpers `songAlignment.ts` imports. Switch the two `songAlignment.test.ts` setups to explicit deterministic frame fixtures so alignment coverage survives.
4. **Bounded fallback read.** `loadYouTubeAudio` enforces 16 MiB while streaming, reusing the bounded reader pattern in `analysisClient.ts`. Test oversized chunked bodies and abort.
5. **Docs.** Fix stale README text (browser-worker extraction vs the Rust server path; static Netlify vs Node-only vs supervised full server capability). Add `docs/sheet-alignment-contract-v1.md` defining Tier A (ordered sheet placement + explicit refusal; separate triad / tab-note / rich scope), Tier B (provisional free estimates) and Tier C (research gated by causal evidence). Mark Tier A quality as unmeasured.

### Package B — admission trace v1 (Sol 6.1 xhigh builder B)

Passive diagnostic on **disposable copies** of the 3.1 core under its target directory, no active source edits, no WASM. Frozen selection before running. Bounded logs (256 MiB total), 110 s command deadline, baseline-identical outputs. Every selected omission gets a branch-level explanation or an explicit "unresolved". Pre-stated rule: a later per-pitch decoder prototype is justified only if true pitches are admitted with independent support before the state loss and reattack vs confounder can be told apart within the existing future-support bound. The downstream-decoder-as-main-fix idea is killed if the decisive pitches lack candidates or ownership upstream. A route-only repair for palm-mic is already ruled out.

### Independent test (Sol 6.1 high, separate operator, after A freezes)

End-to-end browser and runtime evidence for package A, using only its own new paths.

## Ownership (exclusive; no overlap)

| Owner | Writes |
| --- | --- |
| Opus (me) | `docs/rust-opus-architecture.md`, this file, `target/opus-architecture/**` |
| Builder A | new `src/audio/analysisCompatibility.ts` + `.test.ts`; `src/components/SongbookPlayer.tsx`, `AudioAnalysisPanel.tsx`, `PracticeChordMode.tsx`; new `src/audio/micMatchState.ts` + `.test.ts` (only if a shared helper is needed); `src/data/songbook.ts`, `songbook.test.ts`; delete `src/audio/songAnalysis.ts`, `songAnalysis.worker.ts`, `songAnalysis.test.ts`; edit `src/audio/youtubeAnalysis.ts`, `youtubeAnalysis.test.ts`, `chordRecognition.ts`, `chordRecognition.test.ts`, `songAlignment.test.ts`; new `src/audio/fixtures/alignmentFrames.ts`; `README.md`; new `docs/sheet-alignment-contract-v1.md`; new `docs/rust-sol-product-fixes.md`; `target/sol-product-fixes/**` |
| Builder B | new `validation/admission-trace-v1/**`, `target/admission-trace-v1/**`, new `docs/rust-admission-trace-v1.md` |
| Tester (later) | new `validation/songbook-runtime-v1/**`, `target/songbook-runtime-v1/**`, new `docs/rust-sol-product-validation.md` |

Frozen for everyone: `package.json`, `package-lock.json`, `Cargo.*`, `crates/**`, `src/generated/**`, `server/**`, all existing validation corpora/labels/scorers/results/snapshots/holdouts, existing e2e harnesses, other docs. If a builder needs a frozen file, it stops and reports.

## Rejected or deferred, with reasons

- **O2 partial results:** deferred. Cross-stack cost is large, value is not shown for sheet sync, and the cited files are outside browser scope.
- **Event-layer redesign:** deferred until trace v1 says yes.
- **Broad refactor of `ingest.worker.ts` / `LiveListen.tsx`:** rejected. There is no defect.
- **Raising caps, threshold tuning, new model trials:** rejected.
- **Deployment changes:** none. Repository config facts only; no hosted settings were inspected or changed.

## Still unproved after this round

- Real-song sheet alignment quality. There is no independent current PCM → Rust → alignment → player test set. The CCR fixture is detector-derived regression data, not truth. A versioned controlled set (Astra's 250 ms anchor proposal; refusal on incompatible sheets) is the next candidate package.
- Polyphonic note/chord accuracy, long-file completion, whole-browser memory peak and device coverage remain open. The ambitious recognition goal is **not** complete.

## Appendix — results so far (Opus, 2026-10-31)

**Package A (builder A):** done, source frozen (`target/sol-product-fixes/freeze.json`). Report: `docs/rust-sol-product-fixes.md`. Engine policy accepts exactly `rust-dsp-1` and `rust-dsp-3.1` with alignment v1; the test failed before the fix and passes after. Lint/typecheck/test (3 Node fixture tests + 260 Vitest passed, 7 opt-in skips)/build passed, `wasm:verify` PASS. Run on Node 24.22.1, not the 24.22.2 pin. No browser journeys yet; the independent tester owns them.

**Package B (admission trace v1):** done. Report: `docs/rust-admission-trace-v1.md`. The instrument reproduces baseline exactly (6 byte-identical outputs; the palm-mic failure is identical) with 36 MiB of logs. Verdict:
- **Killed:** a decoder working only on already admitted notes as the main fix. A true sustained voice (MIDI69) loses temporal ownership upstream, and the vibrato fragment comes from a missing fitted candidate (just outside the 45-cent window), before segmentation.
- **Not justified:** a per-pitch decoder / unified-ledger prototype. The true pluck reattack and the beating no-reattack control both give one continuous event; no existing predicate separates them within 0.32 s.
- **Route-only split confirmed** at the wire (same confirmed MIDI40, poly→mono via the singleton rule). That justifies at most an internal unified ledger later, not a v1 wire change.

**Consequence for the roadmap:** the next recognition work, if any, has to bring new **upstream** evidence: candidate generation that tolerates tuning drift/vibrato, ownership of shared partials, and a raw excitation (attack) signal that tells a re-pluck from beating. That needs its own predeclared controls. More downstream smoothing or segmentation is ruled out by evidence, not just by caution.

**Independent test (Sol 6.1 high):** done. Report: `docs/rust-sol-product-validation.md`. All 57 frozen hashes match before and after; `wasm:verify` PASS twice; lint/typecheck/test/build PASS in a disposable copy. Real browser journeys against a real native Rust 3.1 backend on loopback all PASS: upload → save → reload → reattach restores timing with no stale warning; missing audio, changed PCM, changed sheet and `rust-dsp-2` are refused; manual timing survives; zero `/api/youtube-audio` requests after Rust success (upload and a YouTube-shaped local downloader fixture); Songbook and Practice mic gap/consecutive/cancel behavior correct; no legacy worker asset. No product defect found.
Limits: Node 24.22.2 unavailable (ran 24.22.1); the Node fallback was proven with mocked media, not the real extractor; unsupported-engine rejection *with* verified reattached audio was not isolated in the rendered player; Blob URL revocation not instrumented. The tester fetched a static FFmpeg 7.0.2 build into `target/songbook-runtime-v1/` because local ffprobe was missing (hashes in `identities.json`; nothing installed system-wide). Root should not treat that binary as part of the product.

**Round 1 closed.** No children running. Ready for root review; nothing committed or deployed.
