# Root verification of Opus–Astra round 1

2026-10-31. The product handoff passes the checks below. Recognition accuracy
remains unaccepted. No product implementation, active engine, generated WASM,
original evidence, deployment, database or sibling checkout was changed here.

## Pinned Node and build

The project-local executable
`.tools/node-v24.22.2-linux-x64/bin/node --version` returns **v24.22.2**.
Earlier builders and the independent tester used 24.22.1 and did not find this
local installation. Their recorded runtime remains 24.22.1; this is a separate
verification on the required version, not a correction to their actual runs.

Using that executable and the npm CLI from the same installation, with its
`bin` first on PATH:

- `npm run check:fast`: pass; lint and type checking pass, three Node fixture
  tests and 260 Vitest tests pass. Seven existing opt-in tests were skipped
  (six live browser cases and one database case).
- `npm run build -- --outDir target/root-product-closeout/dist`: pass,
  including normal WASM source verification. Existing root `dist` was kept.
- All 57 product/audit/build hashes in `target/sol-product-fixes/freeze.json`
  match before and after. All three deleted legacy recognizer files stay absent.

Logs and expanded commands: `target/root-product-closeout/checks.json`,
`check-fast.log`, `build.log`, `freeze-before.json`, `freeze-after.json`.
The isolated build was used for the browser checks below.

## Unsupported engine with real reattached audio

Run from the repository root:

```sh
.tools/node-v24.22.2-linux-x64/bin/node validation/songbook-root-closeout/verify.mjs
```

The harness starts the independently built native Rust 3.1 service and a Vite
server for the isolated production build on unused loopback ports. It checks
the backend, media tools, gateway source and WASM manifest against the previous
tester's recorded hashes. Backend environment is an explicit allowlist; browser
requests to external origins are blocked. Nothing is installed system-wide.

**Supported control passes:** generated five-second WAV → real Rust analysis →
save → real audio playback. The current engine supplies automatic `[0.44]`
timing and one sheet chord is highlighted during playback.

**Unsupported engine passes:** reload, open the same song and reattach the same
WAV through real decoding and analysis. The test changes only `engineVersion`
in the two successful result/features HTTP responses to `rust-dsp-2`. PCM,
hash, features, notes and harmony are unchanged. The recording plays; the stale
engine warning and “no verified timing” message appear, with zero sounding
sheet steps and one selected practice step. This is an injected compatibility
negative, not an actual run of engine 2 or a recognition accuracy test.

Both runs have decoded PCM hash
`d5b3a0cbd8b3a1f6e191cafd76ae07348f03c3ce5adc84ee7d51849eaf3b8274`.
There are no page errors. Browser, local web server and backend are closed in
`finally`; backend exits 0. Evidence: `target/root-product-closeout/browser.json`
and `browser.log`. The harness passes focused lint.

The first harness attempt failed an incorrect storage assertion: fresh raw
storage retains the unsupported result's proposed automatic times. The player
refuses those times immediately, and existing load normalization strips them
when reading the song. This does not require raw persisted JSON to be rewritten
immediately. The corrected check asserts rendered playback behavior, warning
and unchanged PCM, and explicitly records the retained raw metadata. Initial
failure evidence is preserved in `initial-browser.json` and `initial-browser.log`.
No product or validator was weakened to make the test pass.

## Remaining work

This closes the exact Node-version and unsupported-engine-with-attached-audio
gaps from the previous product handoff. It does not prove public downloader
availability, real-song sheet alignment, overall musical accuracy, long-input
completion, whole-browser physical memory or broad device support. Current
recognition remains `rust-dsp-3.1`; failed research candidates are not adopted.
No commits, pushes or deployments were made.

## Portable runtime integration and final review fixes

The independent packaging review passed (`rust-portable-container-independent.md`).
Root integrated the reviewed runtime into the audit checkout, preserving all ten
generated artifacts. The copied three-file Vitest filter and local build-cache
paths were not adopted: the ordinary full application suite remains enabled.
Frozen validation copies are excluded from application discovery and lint.

The structured Sol review identified four concrete issues. Root reproduced both
Songbook issues with the real browser and Rust backend before fixing them:
numbered-tab steps were incorrectly gated by chord evidence, and the editor's
replacement upload was skipped when saved analysis existed. Numbered tabs now
use note evidence; explicit files bypass the saved-result opening shortcut.
Those direct-player checks preserved silence and opening a saved result without
a supplied file. They did not cover the parent component retaining an old file.
The same journey verifies that a changed recording invalidates old manual timing.

The feature parser also rejected valid original-amplitude RMS above one. A
red/green unit check and an actual amplitude-two float-WAV upload now confirm
that clipping warnings and those finite features survive the client boundary.
Negative and nonfinite values are still rejected. The fourth fix fetches locked
workspace dependencies during bootstrap, when the workspace is present. The
Docker tools-only stage has no manifest and its later stage already fetches.
An empty-cache offline build failed as expected; explicit locked fetch followed
by the normal offline WASM builder passed. The generated manifest was not edited
by hand. All ten generated artifacts remain byte-identical; the new source
association is `fd11c6c210a2e11cb941d8b5fe416175d639f188eb7962a81cb2762b80cadfdf`.

Current root checks pass: 273 JavaScript tests with seven opt-in skips, 61 Rust
tests with five opt-in ignores, Rust format/Clippy, and the normal application
build redirected into an isolated target directory. Five focused real-browser
checks pass. Rust's first run omitted the locally installed ffprobe path and
failed five media tests; that log is retained, followed by the passing run with
explicit existing FFmpeg paths. The browser harness's initial watcher-limit
setup failure is retained too; its own backend was stopped, and the corrected
harness disables watching the large audit tree.

Evidence and exact commands are in `target/portable-root-integration/`; the
repeatable browser check is `validation/songbook-regressions/run.mjs`. The first
autoreview request exceeded the engine input limit before running. The second
produced the four findings but used invalid absolute finding paths; its raw
advisory output was retained and root verified each finding. The structured
post-fix rerun and the user-requested Opus 5.5 xhigh review both found the parent
handoff defect below. Their original failed reports remain unchanged.
No production, database, daily-driver preview, commits or pushes were touched.
Musical acceptance remains failed; these changes do not improve recognition.

### Parent upload handoff

Opus reproduced the remaining P1 through the real `SongbookMode`: create A,
replace it with B, then Back/reopen silently analyzed A again. Root extended the
actual-parent test to Edit/Cancel and saved manual timing plus lyrics on B first.
Both paths reproduced A returning and B's timing and lyrics being removed.

The parent now releases the editor's file after an analysis result is handed
back and whenever the player is left for the list/editor or remote state is
reset. Saving also releases the editor's redundant file reference. The currently
mounted analysis panel still owns its selected file for a deliberate retry.
Both full-parent paths now pass: no new job, B's hash unchanged, manual timing
and lyrics unchanged. See `validation/songbook-regressions/parent/run.mjs` and
`target/portable-root-integration/parent-{red,green}/results.json`.

The source/WASM association remains `fd11c6c2…`; this is a parent UI change only.
The final structured Sol review returned no actionable findings
(`target/portable-root-integration/review-parent.json`). Opus independently
passed the parent flows, deliberate retry, replacement from the editor, and a
fresh Docker build and packaged browser journey. Its report is
`rust-portable-opus-parent-acceptance.md`; original failed reviews remain retained.
The earlier cold-cache command/environment gap is documented, without invented
timestamps, in `target/portable-root-integration/cold-cache-command-record.json`,
reconstructed from the actual root execution transcript.

### Commit preparation

The staged hook required formatting 26 authored files. The original bytes are
retained under `target/portable-root-integration/before-format/`. All 24 code
files have equal emitted JavaScript syntax trees after normalizing parentheses
and equivalent quoted property names; the JSON config has equal values. The
remaining README changes only align Markdown tables. See
`format-equivalence.json` and its executable comparison script in the same
evidence directory. No recognition or cancellation logic changed.

The normal builder regenerated source association
`936a656941a8a55f5573418c817a9be241999321edc7757b118b2d591df4112d`.
Nine of ten generated artifacts, including both WASM modules, remain
byte-identical to the independently reviewed set. Only
`portable/asyncify-runtime.js` differs: it
is the exact formatted authored helper covered by the syntax-tree comparison.
The generated manifest records the new helper hash. Generated bytes were not
hand-edited. Historical reports and generator output are excluded from automatic
formatting; authored code remains subject to the ordinary hook.

Python bytecode caches are now ignored and excluded from the commit. Opus's
remaining P3 concerns a canceled editor file being visible after an empty remote
discard; it causes no silent analysis and is not a release blocker. No physical
memory, production authentication/database, or musical acceptance claim follows
from the container check, which used local browser storage and development mode.

After formatting, the normal build and the exact-index `check:staged` both pass:
Prettier, lint (warnings only), TypeScript, 19 Node tests, and 254 Vitest tests
with seven opt-in skips across 40 test files. Logs are `build-formatted.log` and
`staged-check-formatted.log` in the root evidence directory. Rust source and both
WASM modules are unchanged, so the earlier Rust, safety, numerical and measured
runtime results retain their stated scope. `git diff --check` passes for authored
code; two historical report trailing spaces and one generated terminal blank
line are preserved with their original evidence/artifact bytes.

### Reconciliation with main

The first published checkpoint is commit `1bde902`. GitHub reported conflicts
with main's separate player redesign. The older main squash `5884cc0` and audit
commit `9801036` have the same complete tree
`25677286c23d5bf530ac113be22e3bc244833284`. Root used that verified common source
tree to resolve duplicated history, then manually reconciled the five genuinely
overlapping UI files. The merge retains main's chord runway, bottom transport,
line bands and held-chord grouping alongside the Rust playback/timing behavior.

Unresolved intervals and selected practice steps do not highlight the runway as
heard chords. Equal chords separated by a gap remain separate: a focused test
failed against the incoming grouping and passes after preserving that gap.
Upload lyrics also render held chords without inventing another attack.

The combined source passes the normal build and seven actual browser/native
checks, including both parent navigation paths. The direct-player check also
verifies the new transport, runway highlighting, silence, and 360px element
bounds; desktop/narrow screenshots were visually inspected. The first direct
run failed in the harness when Playwright lost a response body during dependency
discovery. Its log and cleanup record are retained. The harness now pre-bundles
its React dependencies and records response-read errors through its existing
assertion/cleanup flow; no assertion or product behavior was relaxed.

Evidence is `target/portable-root-integration/main-*`. All ten generated artifacts
and the verified `936a6569…` source association are unchanged by this UI merge.
The earlier Opus packaged acceptance predates the UI reconciliation; the merged
UI has its own source review, build and browser checks. No additional musical,
WASM performance or production acceptance is implied.

The first structured merge review identified two further runway issues: synced
blocks rebuilt from the sheet bypassed evidence gaps, and the current block used
a different media-boundary tolerance. Both were accepted. Synced blocks now
intersect chord steps with chord evidence and tab-note steps with note evidence;
ordered adjacent blocks merge only without a gap. The runway uses the same
`sounds` boundary helper as the sheet and lyrics. A rendered paused-boundary test
reproduced the mismatch before the fix; 17 focused tests pass after it. The real
native/browser test also checks that runway bounds respect the actual measured
note's silent intro/outro. All five direct-player cases pass after the fixes.
The original failed review and red tests remain beside the follow-up results.

The next review caught incoming lyric grouping moving a finished chord into a
silent instrumental outro. Root reproduced that case, the equivalent next-lyric
case, and a ringing chord losing its onset-row ownership. A related short-line
control also exposed duplicate lead-in assignment. Grouping now chooses one row
per chord: only a real lyric line overlapping the chord can receive its lead-in;
other later rows can show a sounding hold. All 21 focused grouping/runway tests
pass, including the previously valid sung lead-ins. The red results and each
review remain retained under distinct filenames.

The final structured review (`review-main-final.json`) reports no actionable
findings and explicitly covers evidence-limited runway spans, the shared media
boundary check, and single-owner lyric grouping. The normal build passes after
the last lyric fix (`main-build-lyrics-fixed.log`). This resolves the main-branch
UI conflicts without changing the accepted native engine or generated runtime.
