# Guitar isolation final review

Completed locally on 2026-11-01 by Sol 6.1 xhigh, taking over the existing Opus
review without delegation. Branch `feat/guitar-isolation`, base and HEAD
`a696d54809ee27b75679255a7f7a927e47de55c2`. All changes remain uncommitted.

## Decision

**Go for local scientific evaluation and root code integration. No-go for app
deployment or redistribution of the packaged weights until permission is resolved
and suitable worker resources are provisioned.** No further material product-code
defect was found in the takeover review. Musical quality is experimental and is
not dependable transcription. This is a self-review, not another independent model review.

The implementation is usable locally: explicit guitar/full-mix jobs, real CPU
separation before the existing recognizer, original playback and aligned guitar
preview, saved analyzed-source identity, manual timing/lyrics preservation and
explicit failure/full-mix recovery. Live listening, WASM and DSP recognition were
not changed.

## What was reviewed

- Rust job creation, defaults, stage progression, capability checks, provenance,
  original-versus-analyzed hashes, original/guitar artifact routing and expiry.
- Existing Node owner gate and the narrow GET/HEAD preview allowlist; no new
  public worker listener or secret forwarding. Production and live DBs were not accessed.
- Subprocess arguments and cleared environment, cancellation, parent death,
  process-group kill/reaping, deadlines, queue expiry, temporary-file cleanup,
  disk reservations, RSS watchdog and bounded-window model memory.
- Client focus/model/hash validation, stale result rejection, both playback
  sources on one clock, saved/legacy data, manual timing and lyrics identity.
- Pinned Linux CPU dependencies, official weight hash, fresh image provisioning,
  non-root offline runtime evidence and the resource/deployment documentation.

The lead had already fixed the stereo downmix gain, mono and opposite-phase
channel selection, inherited-pipe cleanup after helper death, watchdog cadence,
page-size handling, queue errors, capability-retry behavior and automatic analysis.
Those fixes were retained. The Rust copy-through pipeline test is red against the
old gain and green against the fix; historical command output, including the
intentional red test, is retained in `lead-review-evidence.json`.

Takeover changes were limited to correcting license and stale report claims,
computing report values from evidence, completing source/artifact inventories,
and adding browser assertions for saved guitar reopening and playback speed.
No product implementation changed after the inherited proof's source freeze.

## Validation and evidence

The inherited process was verified as PID 105396 running exactly
`/usr/bin/python3 validation/guitar-isolation/final-proof.py`, with container-proof
child PID 133267. It finished with exit 0, including the actual container job;
its output is retained in ignored `runs/before-takeover-closeout/lead-final-proof.out`.
No second build or inference job was started while it ran.

`final-proof.json` records failure controls, real browser integration, nine real
backend evaluation jobs, leakage/missing-note observations, six-minute native
inference, fresh no-cache image build, builder removal and offline container
inference. All eight phases exited 0. The build took 440.47 seconds.

`checks.json` contains fresh takeover checks: lint/types/19 Node tests plus
267 Vitest tests passed (7 skipped); strict production build including WASM
verification; 21 backend release tests; workspace release build; and clippy with
warnings denied. Existing lint warnings remain. `takeover-checks.json` records
separate serial browser, real seam, multi-format stub alignment, pipeline alignment
and rustfmt checks. Exact commands, exits and log paths are retained there.

The browser evidence uses fresh local Node/Rust servers and a crop of a frozen
DEV recording. It covers real separation, original/guitar playback while paused
and playing, speed retention, saved guitar provenance/focus reopened without
session audio, explicit full-mix reanalysis, original identity, manual timing,
lyrics, reload and legacy saved data. It uses local browser storage; **no real
Postgres save or live YouTube download was exercised in this proof**. Existing
backend source/YouTube and owner/proxy checks still run in the normal suites.

Copy-through controls test plumbing, not music: equal 96,000-sample previews,
zero lag and correct stage order; stereo WAV/Opus, MP3, mono and opposite-phase
sources also retain gain within 0.1%, zero measured lag and residual SNR above
60 dB. The real 30-second window/unwindowed comparison crosses an outer seam and
requires byte equality. This does not prove seamless output for every song.

Full per-fixture and pooled denominators, note F1, SI-SDR, leakage and missing-note
observations are generated in [the validation report](guitar-isolation-validation.md)
from the current JSON evidence. Two GuitarSet DEV acoustic recordings plus frozen
synthetic accompaniment were used. No holdout or human listening test was used;
no recognizer or separator settings were tuned. The accompaniment predeclaration
says A minor while the frozen generator produces A major; that discrepancy and
all original labels/inputs were preserved.

Both no-guitar controls still produce false chord/note frames despite triggering
the low-guitar warning. Correct-root coverage grows on this pair, while precision
among emitted chord frames falls. Neither a stem file nor cleaner audio is proof
of reliable chords. Clean guitar recognition is also weak.

## Measured hosting requirements

| Environment, real six-minute job | Wall seconds |    CPU seconds |        Peak memory | Peak job files |
| -------------------------------- | -----------: | -------------: | -----------------: | -------------: |
| Native, 2 inference threads      |       429.43 | 858.57 sampled | 1.533 GiB RSS tree |     137.60 MiB |
| Container, 2 CPUs / 2.5 GiB cap  |       383.91 |  756.46 cgroup |   1.735 GiB cgroup |     136.09 MiB |

Native exact aggregate CPU, including startup, was 861.15 seconds (GNU time).
Container peak includes page cache and is not the same metric as summed RSS.
Runtime UID was 1000; networking was disabled. Original and analyzed PCM
identities match between native and container. Image size is
2,665,040,459 bytes; retained tag `fretbloom-guitar-runtime:local`.

Budget **4 GiB RAM, two CPUs and 1.5 GiB writable temporary space, plus image
storage**, one active job at a time. A 0.5 GB service is insufficient. Current
Railway allocations were not read or changed; this is a measured requirement,
not a successful hosted deployment claim. The existing ten-minute maximum is
preserved, but this evidence runs six minutes, not ten. Defaults allow 2,400 s
separation, 2,700 s active guitar work and 3,000 s client time; full-mix deadlines
stay unchanged. Separate-worker transport is described in the validation report;
it has not been implemented or provisioned. For co-located web/DB processes add
their own memory budget.

## License gate

[Demucs 4.1.0 code](https://pypi.org/project/demucs/4.1.0/) is MIT. The
[author's historical weight statement](https://github.com/facebookresearch/demucs/issues/327)
limits use to scientific purposes. The [current README](https://github.com/adefossez/demucs#license)
explicitly calls weight licensing unclear and only speculates about a
non-commercial license for the six-source checkpoint. An exact license grant
was not established. Personal, private or non-commercial app use is not automatic
permission. Clarify permission or replace the weights before app deployment or
image redistribution. This corrects the original plan's unsupported personal-use
conclusion; it is not a legal clearance.

## Identity, inventory and handoff

- Weights: `34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd`.
- Lock: `a1809e4d5f5dd7589b7c4516d39f514a9f25948734e2ccbec20eca14bf6876b3`.
- Native backend: `d9dc1f071aba282acdbd749bf01a5251c5069e8c1771d07420ea5f18d5adf771`.
- Runtime image: `sha256:a67f90d50184a9826454c2f47c3c447ef1650197c64840e7b0e4d85e891ffcbd`.
- Portable WASM unchanged:
  `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b`.

`takeover-source.json` preserves the takeover snapshot and comparison with the
inherited backend-source/binary snapshot. `identities.json` is refreshed to the
actual current helper, validation scripts and artifacts; the old stale-helper
record remains archived. `source-inventory.json` lists exact task files and
SHA256 values, including new feature source and review files, excluding old
unrelated research and ignored bulk inputs. `changes.json` gives descriptions.
The inventory excludes its own hash. No staging was performed.

Historical failed/canceled phases remain recorded: the earlier canceled Docker
build (`packaging-checks.json`, exit 130), stale queue/contract assertions,
wrong Rust PATH and transient probe spawn, intentional old-gain regression, and
the takeover browser harness's second-page-context error. The latter is archived
under `runs/before-takeover-closeout/failed-second-page-*` and corrected using an
explicit browser context. It was a test setup error, not a product failure.
The first report regeneration also failed closed on ANSI-colored test output;
SGR codes are now stripped before parsing counts. An idempotence check also caught
an accumulating blank line; the prefix is now normalized. Both failures are retained in
`runs/before-takeover-closeout/report-generator-failure.txt`.
Earlier evidence snapshots remain under `runs/before-*`; final success does not
relabel those failures or the musical negative controls.

Cleanup is recorded in `cleanup.json`. The inherited runner, owned backends,
helpers, browser servers, job directories, container and dedicated builder are
gone; the verified image and all evidence are retained. No production, live DB,
default preview, sibling checkout, credentials, commits, push, PR or deployment
operations were used. All task-file ownership is released to the integrating agent.
