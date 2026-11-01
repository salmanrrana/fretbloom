use fretbloom_analysis::*;
use std::collections::BTreeSet;

fn run(pcm: &[f32]) -> AnalysisOutput {
    analyze(
        pcm,
        24000,
        &AnalysisOptions::default(),
        &|| false,
        &mut |_| {},
    )
    .unwrap()
}

fn notes_at(out: &AnalysisOutput, t: f64) -> BTreeSet<u8> {
    out.result
        .monophonic_notes
        .iter()
        .chain(&out.result.polyphonic_notes)
        .filter(|n| n.start <= t && t < n.end)
        .map(|n| n.midi)
        .collect()
}

fn voice(midi: u8, cents: f64, t: f64, harmonics: &[f64]) -> f64 {
    let hz = 440.0 * 2.0_f64.powf((midi as f64 - 69.0 + cents / 100.0) / 12.0);
    harmonics
        .iter()
        .enumerate()
        .map(|(h, a)| a * (std::f64::consts::TAU * hz * (h + 1) as f64 * t + h as f64 * 0.7).sin())
        .sum()
}

#[test]
fn finite_short_tones_do_not_invent_neighboring_notes() {
    for ms in [20, 40, 60, 80, 100, 140, 180] {
        for phase in [0.0, 0.7, 2.3] {
            for smooth in [false, true] {
                let len = ms * 24;
                let pcm: Vec<_> = (0..len)
                    .map(|i| {
                        let envelope = if smooth {
                            (std::f64::consts::PI * i as f64 / len as f64).sin().powi(2)
                        } else {
                            1.0
                        };
                        (0.1 * envelope
                            * (std::f64::consts::TAU * 440.0 * i as f64 / 24000.0 + phase).sin())
                            as f32
                    })
                    .collect();
                let out = run(&pcm);
                let found: BTreeSet<_> = out
                    .result
                    .monophonic_notes
                    .iter()
                    .chain(&out.result.polyphonic_notes)
                    .map(|n| n.midi)
                    .collect();
                assert!(
                    found.iter().all(|&n| n == 69),
                    "{ms}ms phase={phase} smooth={smooth}: {found:?}"
                );
            }
        }
    }
}

#[test]
fn noisy_attack_does_not_veto_a_supported_decay_or_create_noise_notes() {
    for gain in [0.03, 0.2, 0.8] {
        for noise_level in [0.0, 0.015, 0.04] {
            for pitched in [false, true] {
                let mut state = 1234567_u32;
                let pcm: Vec<_> = (0..24000)
                    .map(|i| {
                        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
                        let noise = state as f64 / u32::MAX as f64 * 2.0 - 1.0;
                        let t = i as f64 / 24000.0;
                        let attack = if t < 0.18 { noise * 0.8 } else { 0.0 };
                        let tone = if pitched && t >= 0.18 {
                            voice(57, 0.0, t, &[0.08, 0.04, 0.02]) * (-1.7 * (t - 0.18)).exp()
                        } else {
                            0.0
                        };
                        (gain * (attack + noise * noise_level + tone)) as f32
                    })
                    .collect();
                let out = run(&pcm);
                if pitched {
                    for t in [0.4, 0.6, 0.8] {
                        assert_eq!(
                            notes_at(&out, t),
                            BTreeSet::from([57]),
                            "gain={gain} noise={noise_level} t={t}"
                        );
                    }
                } else {
                    assert!(
                        out.result.monophonic_notes.is_empty()
                            && out.result.polyphonic_notes.is_empty(),
                        "noise-only gain={gain} noise={noise_level}"
                    );
                }
            }
        }
    }
}

#[test]
fn independent_voices_and_bright_single_notes_keep_their_registers() {
    let mut failures = Vec::new();
    for root in [45, 52, 60] {
        for interval in [1, 7, 12, 19] {
            // At 110/165 Hz a semitone pair is inside the short Hann main lobe.
            // Adjacent-pitch recovery is checked where the peaks are resolvable.
            if interval == 1 && root < 60 {
                continue;
            }
            let pcm: Vec<_> = (0..24000)
                .map(|i| {
                    let t = i as f64 / 24000.0;
                    (voice(root, -9.0, t, &[0.07, 0.035, 0.02, 0.012]) * (-0.6 * t).exp()
                        + voice(root + interval, 13.0, t, &[0.055, 0.025, 0.017, 0.009])
                            * (-1.1 * t).exp()) as f32
                })
                .collect();
            let out = run(&pcm);
            let found = notes_at(&out, 0.5);
            if found != BTreeSet::from([root, root + interval]) {
                let poly = analyze(
                    &pcm,
                    24000,
                    &AnalysisOptions {
                        mode: AnalysisMode::Polyphonic,
                        ..AnalysisOptions::default()
                    },
                    &|| false,
                    &mut |_| {},
                )
                .unwrap();
                failures.push(format!(
                    "root={root} interval={interval}: {found:?}; poly={:?}",
                    notes_at(&poly, 0.5)
                ));
            }
        }
        let pcm: Vec<_> = (0..24000)
            .map(|i| voice(root, 0.0, i as f64 / 24000.0, &[0.05, 0.10, 0.04, 0.05]) as f32)
            .collect();
        let found = notes_at(&run(&pcm), 0.5);
        if found != BTreeSet::from([root]) {
            failures.push(format!("bright root={root}: {found:?}"));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn independent_three_voice_mix_and_voice_changes_keep_supported_notes() {
    let pcm: Vec<_> = (0..36000)
        .map(|i| {
            let t = i as f64 / 24000.0;
            let upper = if t < 0.7 { 64 } else { 65 };
            (voice(48, -7.0, t, &[0.05, 0.025, 0.014, 0.008])
                + voice(55, 8.0, t, &[0.04, 0.018, 0.012, 0.006])
                + voice(upper, -2.0, t, &[0.03, 0.014, 0.008])) as f32
        })
        .collect();
    let out = run(&pcm);
    assert_eq!(notes_at(&out, 0.4), BTreeSet::from([48, 55, 64]));
    assert_eq!(notes_at(&out, 1.1), BTreeSet::from([48, 55, 65]));
}

#[test]
fn a_true_release_separates_repeated_notes() {
    let pcm: Vec<_> = (0..28800)
        .map(|i| {
            let t = i as f64 / 24000.0;
            if (0.45..0.6).contains(&t) {
                0.0
            } else {
                voice(57, 0.0, t, &[0.08, 0.03, 0.012]) as f32
            }
        })
        .collect();
    let out = run(&pcm);
    assert!(notes_at(&out, 0.5).is_empty());
    assert_eq!(notes_at(&out, 0.3), BTreeSet::from([57]));
    assert_eq!(notes_at(&out, 0.9), BTreeSet::from([57]));
    assert!(out
        .result
        .monophonic_notes
        .iter()
        .all(|n| n.end <= 0.46 || n.start >= 0.6));
}

#[test]
fn rich_single_voices_do_not_become_octave_stacks() {
    for midi in [45, 57, 69] {
        for exponent in [0.5, 1.0, 1.5] {
            let harmonics: Vec<_> = (1..=20).map(|h| 0.06 / (h as f64).powf(exponent)).collect();
            let pcm: Vec<_> = (0..24000)
                .map(|i| voice(midi, 0.0, i as f64 / 24000.0, &harmonics) as f32)
                .collect();
            assert_eq!(
                notes_at(&run(&pcm), 0.5),
                BTreeSet::from([midi]),
                "midi={midi} decay={exponent}"
            );
        }
    }
}

#[test]
fn irregular_lengths_keep_features_and_events_inside_exact_duration() {
    for len in [1, 17, 479, 481, 1441, 4097, 61696, 65536] {
        let pcm: Vec<_> = (0..len)
            .map(|i| voice(69, 0.0, i as f64 / 24000.0, &[0.1]) as f32)
            .collect();
        let out = run(&pcm);
        let duration = len as f64 / 24000.0;
        assert_eq!(out.result.duration, duration);
        let mut previous = -1.0;
        for f in &out.features.frames {
            assert!(
                f.time.is_finite() && f.time > previous && f.time <= duration,
                "len={len} duration={duration} time={} previous={previous}",
                f.time
            );
            previous = f.time;
        }
        for (start, end) in out.result.harmony.iter().map(|e| (e.start, e.end)).chain(
            out.result
                .monophonic_notes
                .iter()
                .chain(&out.result.polyphonic_notes)
                .map(|e| (e.start, e.end)),
        ) {
            assert!(
                start.is_finite()
                    && end.is_finite()
                    && 0.0 <= start
                    && start < end
                    && end <= duration,
                "len={len} event={start}..{end} duration={duration}"
            );
        }
        assert_eq!(out.result.harmony.last().unwrap().end, duration);
    }
}

#[test]
fn quiet_noisy_release_is_not_filled_by_neighboring_fft_energy() {
    let mut state = 456_u32;
    let pcm: Vec<_> = (0..28800)
        .map(|i| {
            let t = i as f64 / 24000.0;
            state = state.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = 0.001 * (state as f64 / u32::MAX as f64 * 2.0 - 1.0);
            (noise
                + if (0.45..0.6).contains(&t) {
                    0.0
                } else {
                    voice(57, 0.0, t, &[0.08, 0.03, 0.012])
                }) as f32
        })
        .collect();
    let out = run(&pcm);
    assert!(
        notes_at(&out, 0.47).is_empty(),
        "gap contains {:?}",
        notes_at(&out, 0.47)
    );
    assert_eq!(notes_at(&out, 0.3), BTreeSet::from([57]));
    assert_eq!(notes_at(&out, 0.9), BTreeSet::from([57]));
}

#[test]
fn resolved_adjacent_sines_are_not_banned_as_a_group() {
    for root in [60, 69, 76] {
        let pcm: Vec<_> = (0..24000)
            .map(|i| {
                let t = i as f64 / 24000.0;
                (voice(root, 0.0, t, &[0.06]) + voice(root + 1, 0.0, t, &[0.05])) as f32
            })
            .collect();
        assert_eq!(
            notes_at(&run(&pcm), 0.5),
            BTreeSet::from([root, root + 1]),
            "root={root}"
        );
    }
}
