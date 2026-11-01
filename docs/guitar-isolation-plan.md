# Guitar isolation plan (lead contract)

Status: implemented; see guitar-isolation-review.md for the completed review. Base commit `a696d54809ee27b75679255a7f7a927e47de55c2`,
branch `feat/guitar-isolation` (local only, not pushed). Original lead: Opus. Implementation and final takeover review: Sol.

## Goal

For server-backed song jobs (upload and YouTube), separate the guitar from the song, find chords in
that guitar track, and keep playback on the original song with the same timeline. The user can hear
the isolated guitar as a preview. "Focus on guitar" is an option; full mix stays available as an
explicit choice. Live browser analysis, Listen/WASM and the recognizer (`rust-dsp-3.1`) are
unchanged.

Both steps make mistakes. Separation leaks other instruments into the guitar track and can drop
quiet guitar notes. The recognizer has known musical failures. Nothing here claims an exact
transcription.

## Model choice

**Chosen: Demucs `htdemucs_6s`** (6 stems: drums, bass, other, vocals, guitar, piano), run on CPU by
a small Python helper behind Rust.

- Code: `demucs` 4.1.0 on PyPI (2026-07-11), maintained fork of the archived
  facebookresearch/demucs, MIT license. Its dependencies no longer need torchaudio.
- Weights: official file
  `https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th`
  (54,996,327 bytes, live on 2026-10-31). Pin full SHA256 at setup. Demucs names files with the
  first 8 hex digits of the hash (`34c22ccb`); check that it matches.
- Quality: upstream calls the 6-stem model experimental. Guitar is "okay". Piano is poor, which
  matters because piano bleeds into guitar.
- CPU: upstream says CPU takes about 1.5x the track length on old hardware. Measure here.

**Weights license is the main limit.** The weights have no explicit license. The Demucs author said
they are "not covered by the MIT license, and are provided only for scientific purposes"
(facebookresearch/demucs#327, 2022), and the maintained fork says the 6-stem model "was trained only
on Meta internal dataset, which likely means CC-NC-BY license is applicable." These statements do not establish a clear license for the exact six-stem checkpoint or permission
for ordinary personal-app use. Owner-only or non-commercial use is not automatic clearance.
**Local scientific evaluation is the scope of this evidence. Deployment/use beyond it needs
clarified permission or replacement weights with a suitable license.**

Rejected:

- SAM Audio (Meta, 2025): text prompt "guitar" works and its license allows commercial use, but the
  weights are gated on Hugging Face (needs an account, which is not allowed here) and the published
  usage is GPU-only (3.6–6.9 GiB checkpoints).
- RoFormer guitar models (ZFTurbo/MVSep community): licenses and training data are unclear too,
  they cost much more CPU, and the strong multi-stem ones need 12–16 GB GPUs.
- Spleeter and Open-Unmix: no guitar stem. Open-Unmix UMX-L weights are CC BY-NC-SA anyway.
- Community ONNX exports of htdemucs_6s: third-party conversions with weaker provenance. Possible
  later as a size optimization, not now.

No guitar separator with clean commercial weights was found.

## Default

"Focus on guitar" is **on by default** when the server says separation is available, because
guitar is what Fretbloom is for. Re-analyzing a saved song starts from that analysis's own setting.
If separation is unavailable, the guitar request fails with a clear message and an explicit
"Analyze full mix instead" button. The server never falls back silently.

## Pipeline

```
awaiting_upload -> queued -> [fetching] -> decoding -> separating (guitar only) -> analyzing -> succeeded
```

1. Fetch or receive the source (unchanged).
2. `decode_media` makes the ORIGINAL 24 kHz mono PCM, `playback.wav` and `pcmSha256` (unchanged).
3. Guitar only: ffmpeg decodes the same source, from sample 0 with no seek, to a 44.1 kHz stereo
   s16 WAV for the separator (mono is duplicated, more than 2 channels are downmixed). Cap the
   duration the same way. Delete the source after this.
4. Run the helper with fixed arguments (below). It writes a guitar stem WAV and a small JSON summary.
5. Rust decodes the stem to 24 kHz mono f32 with the same resampler, then trims or pads it to
   **exactly** the original sample count. If the lengths differ by more than 50 ms, fail with
   `SEPARATION_FAILED`. Compute the guitar PCM SHA256 and write `guitar.wav` (preview). Never
   overwrite `playback.wav`. Delete the separation input and stem.
6. `analyze_song` runs on the guitar PCM (or the original PCM for full mix). Features (chroma for
   automatic sheet timing) come from the analyzed audio. All times stay on the original timeline.

Separator settings are fixed and recorded: `shifts=0` (deterministic), `overlap=0.25`, the model's
default segment, `split=True`. The helper processes outer windows with overlap and keeps only the
guitar stem, so memory does not grow with song length. A test must show that windowed output
matches unwindowed output on a short clip (no seams, no shift). No parameter tuning on evaluation
results.

## Wire contract

All additions are additive to the existing v1 shapes. `schemaVersion` stays 1.

### Create (`POST /v1/jobs`)

```jsonc
{ "source": Source, "options"?: PartialOptions, "focus"?: "guitar" | "full_mix" }
```

`focus` left out means `"full_mix"`, so an old cached client keeps its truthful old behavior. The
new client always sends it. Unknown fields are still rejected. A guitar request while separation is
unavailable gets `503 SEPARATOR_UNAVAILABLE`.

### Job view

v1 fields plus `"focus"`. `status` gains `"separating"`. During separation, `progress.fraction`
comes from the helper's real progress, not a timer.

### Result envelope (`GET /v1/jobs/{id}/result`)

v1 fields plus:

```jsonc
"focus": "guitar" | "full_mix",
"analyzedAudio":
  { "kind": "full_mix", "pcmSha256": "<same as envelope pcmSha256>" }
| { "kind": "guitar_stem",
    "pcmSha256": "<SHA256 of the analyzed 24 kHz mono f32 guitar PCM>",
    "separator": {
      "model": "htdemucs_6s",
      "weightsSha256": "<pinned 64-hex>",
      "package": "demucs <version>",
      "runtime": "torch <version> cpu",
      "shifts": 0,
      "overlap": 0.25
    },
    "guitarLevelDb": -12.3 }   // 10*log10(guitar energy / original energy), clamped to [-120, 20]
```

**The key rule:** envelope `pcmSha256` keeps its current meaning, the ORIGINAL decoded playback
PCM. Playback identity, `sameRecording`, manual timing and lyrics identity (`upload:<pcmSha256>`)
stay tied to the original song. `analyzedAudio` says what the recognizer actually heard. Rust fills
it in from the code path that really ran, never from the request.

### Capabilities

v1 fields plus `"separation": { "available": bool, "reason": string | null, "separator": <object above> | null }`.
Availability is only true after a real startup check: the venv Python and helper exist, the weights
SHA256 matches the constant compiled into Rust, and `helper --check` (import plus model load, with a
time limit) succeeds. The weights hash is not configurable at runtime.

### Artifacts

- `GET|HEAD /v1/jobs/{id}/audio`: original playback WAV (unchanged).
- `GET|HEAD /v1/jobs/{id}/guitar-audio` (new): guitar preview WAV, 24 kHz mono s16, same sample
  count as the original. Full-mix jobs get a clear error.
- `/result` and `/features`: as before. For guitar jobs, features describe the guitar audio.

Node allowlist: add `guitar-audio` (GET and HEAD only, 30 MiB response cap). Nothing else changes in
the proxy.

### Errors (new)

| code                    | HTTP       | retryable | meaning                                              |
| ----------------------- | ---------- | --------- | ---------------------------------------------------- |
| `SEPARATOR_UNAVAILABLE` | 503        | false     | separator or model is missing or failed its check    |
| `SEPARATION_FAILED`     | 422        | false     | helper failed, bad output, or alignment check failed |
| `SEPARATION_LIMIT`      | 507 or 413 | false     | separation went over the memory or disk ceiling      |

A queued job that expires while waiting behind a long separation fails with a truthful "busy" code
(`QUEUE_FULL`, retryable), not `PROCESSING_TIMEOUT`.

## Client, saving and reload

- New TS module (for example `src/audio/songJob.ts`) parses `focus`, `analyzedAudio`, the
  `separating` status and capability separation. It reuses the primitives exported by
  `analysisV1.ts`. **Do not edit `src/audio/analysisV1.ts` or `src/audio/live/**`.** They are pinned
  by the WASM source manifest, and the portable WASM hash must stay
  `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b`. If an edit becomes truly
  unavoidable, regenerate legitimately with `scripts/wasm-build.mjs` and report it.
- The client checks that the result's `focus` equals the request. For guitar it also checks
  `analyzedAudio.kind === "guitar_stem"`, that its `pcmSha256` differs from the envelope
  `pcmSha256`, and that the separator matches capabilities. Anything else is an error, never a
  relabel.
- The client deadline scales with focus: full mix stays at 420 s, and guitar is longer than the
  server's active timeout.
- `SavedAudioAnalysis` gains optional `analyzedAudio`. Missing means a legacy full-mix analysis,
  shown as "Full mix (earlier analysis)". When present it is validated, and for `full_mix` its hash
  must equal `pcmSha256`.
- Manual timing and lyrics survive a focus or model change because they belong to the original
  recording. Automatic timing is rebuilt from the new analysis. The existing "options changed and
  alignment failed, so drop automatic timing" rule also covers focus and separator changes. A saved
  result is never reused or relabeled across focus or model.
- Guitar preview audio lives only for the session, like original audio today. After a reload the
  analysis label survives. The preview needs a new analysis (uploads: reattach, as now).

## UI

- Analysis options: a "Focus on guitar" checkbox with short help: "Separates the guitar from other
  instruments before finding chords. Takes a few minutes. Separation isn't perfect: other
  instruments can leak in and quiet guitar parts can be lost." Disabled, with the reason, when
  unavailable.
- Progress shows "Separating guitar" with real percentages, plus Cancel.
- Results header comes from `analyzedAudio`: "Chords found in: isolated guitar (htdemucs_6s)" or
  "Chords found in: full mix". Show a warning when `guitarLevelDb` is below -30 dB ("Very little
  guitar was found. Results may come from other instruments leaking through."). The -30 dB value is
  fixed in advance and not tuned.
- Transport: "Hear: Original song | Isolated guitar" when a guitar preview exists. Switching keeps
  the current time and play state on the same clock. Sheet, lyrics and timing keep following it.
- The analysis JSON download includes `analyzedAudio`.

## Safety and resources

- Reuse `run_process`: no shell, cleared env with an explicit allowlist, process group kill on
  cancel, timeout and drop, subreaper reaping, `RLIMIT_FSIZE`, no core dumps. Add only the
  separator's needed env (`OMP_NUM_THREADS` and similar, `HF_HUB_OFFLINE=1`). Run Python as
  `-I -B` with cwd, HOME and TMPDIR set to the job dir. The helper must not use the network or
  create nested directories (the job-dir rule rejects them).
- Memory ceiling: an RSS watchdog on the helper (or another measured, working mechanism) kills the
  process group when it goes over the configured limit and returns `SEPARATION_LIMIT`. Threads are
  capped by config.
- Disk: reserve per job by focus (source + 44.1 kHz stereo input + stem + two 24 kHz WAVs). Raise
  the total disk default only as far as measured need requires. Delete intermediates as soon as
  they are used.
- Timeouts: new separation timeout; active timeout and client deadline raised for guitar jobs.
  Values come from measurement at a hosted-like CPU limit, with headroom.
- One worker at a time, as today.
- Startup passes the separator paths and limits through `start-production.mjs`'s explicit Rust env
  allowlist. No secrets.
- Hosting: Railway Free gives about 0.5 GB RAM per service, which will not run this model. Report
  the measured peak RSS, CPU time and wall time, and the required plan (Hobby-class RAM) or a
  separate worker design. No deployment in this task.

## Packaging

- `scripts/setup-separator.mjs` (like `setup-youtube.mjs`): builds a project-local venv in
  `.tools/separator/` using `pip --require-hashes` and a committed lock (CPU-only torch wheels;
  hashes for cp311 Docker and cp312 local), then downloads the weights and checks the full SHA256.
  Nothing global.
- Dockerfile runtime stage provisions the same pinned venv and weights before `USER node`. The
  fresh isolated build must work, and a non-root runtime smoke with `--network none` must show
  capability `available: true` and run a real guitar job.

## Acceptance evidence (Sol produces; lead reviews)

1. Focused tests: create options and defaults, unknown field rejection, unavailable separator,
   stage order, cancel during separation kills the whole helper process tree and clears the dir,
   helper failure and bad output, memory or disk limit, alignment (identity stub separator gives
   lag 0 and equal length), provenance fields, Node allowlist for `guitar-audio`, client focus and
   provenance mismatch rejection, saved legacy and new parsing, manual timing survival.
2. Real inference on a legally usable fixture: a real recorded acoustic guitar with independent
   chord and note truth (CC BY 4.0, for example GuitarSet or Guitar-TECHS, not an existing
   acceptance holdout, so check the corpus locks), mixed with locally made accompaniment (bass,
   keys or piano, drums, a lead line) from owned or permissive sources. Predeclare fixtures, levels
   and metrics in a committed JSON before running. Conditions: full mix, separated guitar, and the
   clean guitar stem (upper bound). Report chord root and maj/min agreement against guitar truth,
   no-chord and unknown rates, note F1 where available, separation SI-SDR against the clean stem,
   and leakage and missing-note notes. Negative control: accompaniment only, no guitar. Failure
   control: wrong weights hash, and a killed helper. Record exact model, package, runtime and
   weights hash, command, duration, wall and CPU time, peak RSS and output hashes. A repeat run
   checks determinism. Only claim an improvement if the numbers show one.
3. Six-minute real job (legally sourced or generated input, identity recorded) through the real
   backend with guitar focus, measured on this machine and again inside the runtime container with
   hosted-like `--cpus` and `--memory` limits.
4. Real integration with isolated loopback servers on non-default ports: upload, separation,
   chords, original and guitar playback toggle, save, reload, then check the analyzed-source label,
   that timing source survives, and that old saved songs still read.
5. Normal checks: `npm run check:fast`, `npm run build` (strict, includes `wasm:verify`), Rust
   release tests and build, clippy. The known debug overflow in a core test is untouched.
6. Heavy builds and benchmarks run one at a time, never overlapping.

## Out of scope

Recognizer changes or tuning, live and WASM analysis, unrelated security hardening, deploys,
pushes, Railway changes, credentials and live data.
