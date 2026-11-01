# Opus architecture proposal — round 1 (for Astra challenge)

2026-10-31. Author: Opus 5.5 architecture lead. Status: **proposal, not decision.** The joint decision lives in `docs/rust-opus-astra-plan.md` after Astra's challenge.

Active engine stays rust-dsp-3.1 (source `f75b55eb…`, native `d3bec4e4…`, WASM `c9217873…`). Nothing here claims musical accuracy.

## What I looked at

Reports: rust-architecture, rust-live-architecture, wasm-runtime-handoff (ROOT appendices), live-reattack-fix, post-event-recognition-review, gaps-reference-implementation, event-stability-implementation, note-event-validation (incl. support supplement), guitar-techs-validation, learned-recognition, recognition-strategy-review, temporal-review corrections.

Code: `crates/fretbloom-analysis/src/{lib,segments,config}.rs`, `src/audio/{analysisAdapter,analysisClient,youtubeAnalysis,songAnalysis,songAnalysis.worker,pitch}.ts`, `src/components/{SongbookPlayer,AudioAnalysisPanel,YouTubeAnalysisPanel,useSongPlayback}.tsx`, `server/youtube.ts`.

## Facts that shape the proposal

1. **The product is a play-along app, not a transcription app.** README: the user pastes a chord sheet; the app aligns the sheet to the recording and lights up the sounding chord. Alignment (`songAlignment.ts`) uses the Rust per-frame alignment features (chroma-like frames) and the sheet's chord targets. That is a *constrained* problem: pick among the sheet's chords. Free transcription (events, chord names) is secondary display.
2. **The recognition research track has failed four times in a row** (joint v4, Basic Pitch, 3.2, GAPS). Each failure was honest and well documented. Another model or threshold round without a new causal hypothesis is a shopping loop.
3. **The three 552 s Guitar-TECHS whole-file failures are fragmentation, not real density.** `P1_singlenotes_allsinglenotes` has 142 source notes and still exceeds `MAX_NOTES = 4000`; palm-mute has 148 source notes and exceeds `MAX_HARMONY = 3000`. That is ~30× over-segmentation. Raising caps would only ship garbage. The caps are doing their job as pathology detectors.
4. **But a cap hit today throws away everything.** `segments.rs:135/204` and the 1 MiB JSON check in `lib.rs` return `LimitExceeded`; the user gets no result at all, including the alignment features, which do not depend on the event lists.
5. **Two YouTube acquisitions per song.** Analysis uses the Rust job (`/api/analysis/v1`, job `/audio` gives same-PCM playback). The blocked-video playback fallback in `useSongPlayback.ts` separately calls `loadYouTubeAudio` → Node `/api/youtube-audio/` → a second download. Two downloads double bot-block exposure and can play different audio than what was analyzed. (Needs verification: whether the Node route is the only path when no Rust backend is configured, e.g. Netlify.)
6. **Dead legacy recognizer code.** `songAnalysis.worker.ts` has no importer. `analyzeYouTube`, `analyzeSongFile`, `analyzeSamples` appear used only by tests and the dead worker. `chordRecognition.ts` is still imported by `songAlignment.ts`, so it is not entirely dead. (Needs verification before deletion.)
7. **Mic play-along mode** (`SongbookPlayer.tsx` ~L430) uses a crude JS `chordMatchScore` on main-thread chroma with fixed 0.58/700 ms thresholds, independent of Rust/WASM. Not a current defect report, just an observation.

## Options, prioritized

### O1 — Make "sheet-informed" the primary musical contract (documentation/contract, no code now)

Three tiers, written into the plan:
- **Tier A, sheet-informed:** "which of *your sheet's* chords is sounding, and when do changes happen". This is what the product sells; it is tractable because the hypothesis set is small and comes from the user.
- **Tier B, free estimate:** events and chord names, labeled provisional with known limits; honest unknown/equivalent names.
- **Tier C, research:** better note evidence. Gated by causal hypotheses, not model shopping.

Benefit: stops treating open polyphonic transcription of arbitrary YouTube mixes as the acceptance bar for the whole app. Objection: Tier A quality has its own unmeasured accuracy; it must get its own versioned criteria later, not borrowed success from Tier B scores.

### O2 — Partial results on event-limit overflow (core + wire, Sol package)

When note/harmony/JSON limits are hit, return a result that keeps duration, tuning, warnings and **alignment features**, with event lists explicitly marked unavailable plus a reason (`eventLimit`), instead of failing the whole run. Caps stay where they are. UI shows "chords from this recording are unavailable (too many unstable events); sheet sync still works".

Benefit: the three long Guitar-TECHS files (and real long songs that fragment) still get sheet sync and playback. Cost/risk: changes core source → source hash → WASM regen + native/WASM parity + browser check; wire schema v1 → needs a versioned additive change, Node gateway validation, TS validation, saved-session (IndexedDB) compatibility. Validation must keep the old failure statuses: an incomplete result is **not** an empty successful transcription for scoring.

Open question for Astra: is the alignment computed purely from features (no event lists)? If alignment also needs events, O2 is weaker.

### O3 — One YouTube acquisition + dead code removal (TS/Node, Sol package)

- Playback fallback reuses the Rust job's same-PCM `/audio` when the analysis job exists; only falls back to Node `/api/youtube-audio/` when the Rust backend is not configured.
- Delete verified-dead legacy recognizer code (`songAnalysis.worker.ts`, `analyzeYouTube`, and whatever of `songAnalysis.ts` only the dead path uses) and their tests. Keep what `songAlignment.ts` needs.

Benefit: fewer YouTube blocks, playback = analyzed audio, less code. Low risk, no core change.

### O4 — Core event layer redesign (research, NOT this round)

Unified note stream (route as a per-segment attribute, not two streams) plus per-pitch state decoding driven by soft salience and onset evidence instead of greedy hard fitter decisions. This is the likely real fix for fragmentation, but 3.2 already failed at a related scope and the traces do not yet identify which fitter/admission decision causes each omission. Requires a causal trace first. I propose deferring it.

### O5 — Refactor large files (ingest.worker 1137 lines, LiveListen 1096) — reject for now

They work and have browser evidence on frozen builds. Refactoring without a defect risks invalidating that evidence. Revisit only for a concrete defect.

## Recommendation for this round

O1 as contract text, O2 and O3 as two Sol 6.1 xhigh packages with disjoint files, plus an independent Sol 6.1 high tester. O4 stays research with a precondition. O5 rejected.

## Assumptions I want challenged

- That sheet alignment is the real user value and is feature-only.
- That partial results are worth a core/WASM regeneration cycle.
- That the Node YouTube route is redundant whenever the Rust backend is present.
- That nothing higher-value is hiding in server/deploy/live code (error recovery, resource limits, packaging).
- That deferring O4 is right rather than cowardly.
