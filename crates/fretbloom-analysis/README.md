# Core DSP handoff — 2026-10-31

This crate implements the pure `analyze` API and JSON types from
`docs/rust-architecture.md`. It owns no I/O or worker threads. The `analyze-pcm`
binary owns raw-f32le file I/O, SIGINT handling and atomic JSON publication.
Rust 1.89.0 is pinned at workspace root and was installed/verified with rustfmt
and Clippy. No WASM or capture implementation belongs to this pass.

## Files and integration

Builder A created only `Cargo.toml`, `rust-toolchain.toml`, and these crate files:

- `Cargo.toml`: independent explicit dependency versions.
- `src/lib.rs`: public exports, input validation, tuning, orchestration, limits.
- `src/types.rs`: camelCase wire structs, tagged harmony, enums and typed errors.
- `src/config.rs`: frame sizes, pitch range, signal floors and cardinality bounds.
- `src/spectrum.rs`: centered Hann spectra, interpolated peaks and noise evidence.
- `src/pitch.rs`: FFT-accelerated YIN differences and refined period estimates.
- `src/polyphony.rs`: independent sparse measured-harmonic fitting.
- `src/chords.rs`: all 18 qualities, required-tone scoring and alternatives.
- `src/segments.rs`: timelines, note streams, bass persistence and 80 ms features.
- `src/naming.rs`: note spelling and slash-bass labels.
- `src/bin/analyze-pcm.rs`: validation CLI, typed exit codes and SIGINT.
- `tests/analysis.rs`: eight input, DSP, stream, serialization and cancellation tests.
- `tests/vocabulary_waveforms.rs`: one test exercising independent harmonic
  waveforms for all 18 qualities, with observed defining tones and ambiguity.
- `tests/resource_probe.py`: bounded synthetic 30/600-second CLI resource checks,
  SIGINT and invalid-input checks; generated scratch files are removed.
- `README.md`: this handoff.

Cargo legitimately resolved `Cargo.lock` during the first compile; B owns its
final contents. The workspace uses `crates/*`, resolver 2 and edition 2021.
B confirmed service compilation and WAV upload/result/features/playback integration.
The A-owned Clippy type-complexity issue was resolved with `SegmentedOutput`.
Backend must still enforce the exact result-envelope limit. The core reserves
2 KiB below 1 MiB for envelope metadata and checks note/harmony cardinality.

## Inference behavior and limits

Input is finite mono PCM at exactly 24 kHz, 1..14,400,000 samples. Finite clipping
is clamped only for spectral work and reported; original-amplitude RMS is kept.
4096-sample spectra use 480-sample hops; 8192-sample bass spectra run every four
hops. Circular peak tuning uses at most the first 30 seconds. YIN requires
periodicity, observed fundamental evidence and spectral corroboration, and refuses
independent competing pitches. Auto separates single/multiple voice streams;
explicit monophonic refuses unresolved polyphony, explicit polyphonic emits only
the fitted stream. Harmony is independent of mode.

The sparse fit uses up to eight harmonics, six active candidates, narrow local
frequency refinement, nonnegative coordinate refits and residual stopping.
A fixed decaying harmonic envelope performed poorly on plucked strings: it left
real partials behind as false notes. This implementation adapts partial amplitudes
to measured peaks, allocates shared peak energy once, and uses decaying `1/h`
weights for pitch refinement. It suppresses higher-harmonic aliases and cautiously
retains octave/fifth components with measured fundamental excess and another
partial. These are tentative acoustic observations, never notes synthesized from
a chord template. This is not instrument separation or reliable full voicing
reconstruction. Completely absent fundamentals, octave doubles and harmonically
masked voices remain difficult; a fitted fundamental must be observed.

Bass comes from the longer spectrum and five-hop persistence, not a chord root.
Chord ranking requires defining tones and explicitly compares all 216 root/quality
combinations. Equivalent pitch sets keep low margin and alternatives; they remain
`unknown` without a defensible primary. Chroma cannot distinguish add2/add9.
Three-frame pitch medians and 60 ms note support remove isolated spikes without
crossing actual silence. Short chord runs remain tentative. No smoothing was added
to suppress real note changes merely to improve the boundary metric. Precise
reattack/onset separation, richer chord hysteresis and confidence calibration
remain future work. Silence is gated from each original 20 ms cell, so FFT padding
does not fill leading/trailing silent margins with notes.

## Reproduction and final measured evidence

From repository root:

```sh
cargo build --locked --release -p fretbloom-analysis --bin analyze-pcm
cargo test --locked --release -p fretbloom-analysis
cargo clippy --locked -p fretbloom-analysis --all-targets -- -D warnings
cargo fmt --check -p fretbloom-analysis
python3 validation/audio/rust_eval.py --binary target/release/analyze-pcm --split dev
python3 crates/fretbloom-analysis/tests/resource_probe.py
```

All commands passed. Eight focused tests plus the all-18-family waveform test
passed. The runner independently decoded all 51 dev fixtures and validated all
three modes. No holdout predictions or real-audio evaluator results were read.
No corpus, labels, scorer, architecture or independent validation report was edited.
This is not a real-instrument accuracy claim.

Final CLI SHA-256:
`d933b4ef53fd70849c900203a9e5e31407a7d20da86f9ed933bdc7570e2ac659`.
The final development report is
`validation/audio/results/rust-dev/20261031T142656.939008Z-1b3d0dc7/`;
its `run.json` records binary/source hashes, input inventory, configuration and
machine. Source checkout baseline was `ed6507981fb61804098be7bfc6d955bdcf2cae37`,
with concurrent uncommitted builder changes. The builder ran the build above;
the evaluator itself correctly does not attest binary build provenance.

Auto settled-window measurements (percent):

| Metric                                            | Measured |      Proposed target | Status                    |
| ------------------------------------------------- | -------: | -------------------: | ------------------------- |
| Mono early exact                                  |    97.43 |                   95 | met on dev                |
| Mono sustained exact                              |    90.52 |                   90 | met on dev                |
| Poly pitch-class exact                            |    81.98 |                   85 | unmet                     |
| Poly MIDI-set exact                               |    15.88 | 80 diagnostic target | unmet                     |
| MIDI note precision                               |    80.41 |                   80 | met on dev                |
| MIDI note recall                                  |    82.14 |                   80 | met on dev                |
| MIDI note F1                                      |    81.26 |                   85 | unmet                     |
| Unambiguous root                                  |    80.39 |                   90 | unmet                     |
| Unambiguous quality                               |    73.47 |                   90 | unmet                     |
| Bass                                              |    96.60 |                   85 | met on dev                |
| Root + quality + bass                             |    72.39 |                    — | diagnostic                |
| Compatible identity                               |    52.66 |                   85 | unmet                     |
| Dedicated silence/noise/percussion false positive |   0 each |                  <=1 | met on dev                |
| Overall reference-empty false positive            |     2.46 |                    — | includes margins          |
| Harmonic boundary F1                              |    54.55 |       85 provisional | unmet                     |
| Matched boundary mean error                       |   110 ms |                    — | diagnostic                |
| Overlap note F1                                   |    47.73 |                    — | diagnostic; recall 31.91% |

Low E2/F2/B2/A2 each scored 100% on stable mono windows. Auto routing accuracy
was 92.96%, with zero cross-stream duplicate frames. Monophonic mode multi-voice
refusal accuracy was 100% on these fixtures. These routing figures do not prove
all notes were transcribed.

Per intended-family auto settled metrics, percent (unknown alternatives are **not**
promoted to identities):

| Family           | Pitch-class exact | MIDI F1 | Compatible identity |  Bass |
| ---------------- | ----------------: | ------: | ------------------: | ----: |
| maj              |             67.61 |   80.86 |               67.38 | 93.38 |
| min              |             95.05 |   79.67 |               95.05 |   100 |
| dom7             |             74.49 |   86.87 |               74.49 |   100 |
| maj7             |             75.27 |   74.76 |               67.03 |   100 |
| min7             |             96.70 |   91.63 |                   0 | 97.25 |
| sus2             |               100 |   82.83 |                   0 |   100 |
| sus4             |               100 |   88.64 |                   0 |   100 |
| add9             |             83.61 |   87.26 |               83.61 | 65.57 |
| 6                |                 0 |   71.48 |                   0 |   100 |
| m6               |             75.41 |   72.43 |                   0 |   100 |
| dim              |             91.80 |   81.70 |               90.16 |   100 |
| aug              |             96.72 |   74.09 |                   0 |   100 |
| power/thirdless  |             96.77 |   72.81 |            unscored |   100 |
| transition mixed |             91.38 |   75.70 |               87.36 | 90.80 |

Equivalent-name families often abstain by design, but that does not excuse missing
pitch evidence. The C6 development voicing is a clear remaining failure. The
independent corpus does not cover madd9/add11/madd11/dim7/hdim7; the crate waveform
test establishes inference paths for them, not representative accuracy. Root's
independent supplemental evaluator owns broader evidence and real recordings.

Final resource probe used repeated synthetic four-voice harmonic audio on Linux
x86_64, 8 logical CPUs, Rust 1.89.0 release:

| Duration |    Wall | User CPU | Peak process RSS | Features | Poly notes | Harmony |
| -------- | ------: | -------: | ---------------: | -------: | ---------: | ------: |
| 30 s     |  1.11 s |   1.01 s |        9,112 KiB |      375 |         32 |      24 |
| 600 s    | 19.22 s |  18.33 s |      115,524 KiB |    7,500 |        600 |     450 |

Combined CLI result+features JSON was 60,721 / 1,207,783 bytes respectively;
these are not result-envelope sizes. Both exited 0. The probe has a 110-second
subprocess timeout. SIGINT during a 600-second analysis exited 130 in 0.0106 s
without a destination file; malformed byte length and NaN exited 2 without output.
This measures core/CLI resources, not concurrent backend/legacy media load.

Root still owns integration, independent real-audio/supplemental evaluation,
acceptance decisions and commits. No deployment, production/database access,
branch/worktree change, commit, push, secret access or unrelated checkout edit
was performed. Preserve unknown results and observed-note provenance in future
browser/WASM adapters; do not use alternatives or sheet chords to fill notes.
