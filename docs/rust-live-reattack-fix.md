# Live timeline preserves reported reattacks

Root follow-up to `rust-event-stability-review.md`, 2026-10-31. This fixes the
timeline's handling of already reported note boundaries. It does not add an
acoustic onset detector, resolve the Rust event-cap failures, or establish
musical acceptance.

## Change and ownership

Only `src/audio/live/rollingTimeline.ts`, its focused test file, and this report
are owned by this repair. The independent event tester retains
`validation/note-events/**`, `target/note-events/**`, and its report. Core Rust,
frozen binaries, corpora, scorers, protocol, generated assets and production are
unchanged.

Previously, adjacent same-pitch intervals merged regardless of whether the
engine had reported a new attack. The helper now retains each incoming event's
original start sample before window clipping and cell splitting. Clipped cells
can extend a previous interval; an actual original start remains a boundary.
The private origin field is removed before constructing output events and is not
serialized. Existing note IDs remain stable for continuations. A per-pitch tail
map replaces repeatedly searching the entire accumulated note history.

The change preserves original starts before, exactly at, and after the mutable
replacement cut, including nonzero segment and analysis-window offsets. It does
not revise settled coverage or bridge a release, missed interval or segment.
The existing per-stream limits are unchanged; preserving more genuine events
can still produce an honest cap error.

## Focused evidence

Before the implementation, six new cases failed: adjacent attacks in each note
stream; attacks before/on/after the replacement cut; and a reattacking voice
beside a held companion. Each incorrectly became one continuous interval.
The existing three held-note/gap/segment tests passed.

After the implementation, all ten focused cases pass, including a seventh new
case with a shifted analysis window and an assertion that private origin data
does not escape into output. One intermediate test lookup used floating-point
seconds equality and missed two IDs; using integer sample positions corrected
that harness lookup without changing its event-boundary assertions.

```sh
.tools/node-v24.22.2-linux-x64/bin/node node_modules/vitest/vitest.mjs run \
  src/audio/live/rollingTimeline.test.ts --exclude 'validation/**'
```

These are timeline tests with explicit `AnalysisResult` inputs. They demonstrate
preservation of supplied boundaries, not recovery of real plucks from PCM or a
new actual-browser/WASM journey. Existing held-note seam tests remain green.
Acoustic controls, the three full failed recordings and the subsequent core
repair remain independently owned and unfinished.

Source hashes after formatting:

- `rollingTimeline.ts`: `26be5b92fda63562ee9954e7008fbdf00098b5fbd096e79da619f6aa0e3a04f6`.
- `rollingTimeline.test.ts`: `888e6d526b767a0398a7f895730193edf682e98376d70044762df233c08baebe`.

The prior implementation hash recorded by Astra is
`4f36dd73a8b7cc027e45e4b73e5e682d26e741d1b8ce43997a4296e60ad30468`.

Normal pinned `npm run check:fast` passed lint/typecheck, three fixture checks
and **245 Vitest tests**, with seven expected opt-in/DB skips. Normal
`npm run build` passed existing WASM verification, TypeScript and Vite. The WASM
source association remains
`f75b55eba40080371a46f87b7c7362155b2bb22eac4e7aa6d3b973821d779ab9`;
the Rust/WASM detector was not regenerated. Logs are
`.tools/root-live-reattack-check.log` and `.tools/root-live-reattack-build.log`.
`git diff --check` also passed.

No commit, push, deployment, corpus modification or manual user QA occurred.
