use crate::spectrum::{Peak, SpectralAnalyzer, Spectrum};
use crate::*;
use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
type PeakBits = (u64, u64, u64, bool);
fn bits(p: &Peak) -> PeakBits {
    (
        p.hz.to_bits(),
        p.amplitude.to_bits(),
        p.phase.to_bits(),
        p.prominent,
    )
}
fn spectrum_bits(s: &Spectrum) -> (Vec<PeakBits>, [u64; 5], bool) {
    (
        s.peaks.iter().map(bits).collect(),
        [
            s.flatness.to_bits(),
            s.tonal_fraction.to_bits(),
            s.peak_energy_fraction.to_bits(),
            s.rms.to_bits(),
            s.peaks.len() as u64,
        ],
        s.supported,
    )
}
fn pcm() -> Vec<f32> {
    (0..12288)
        .map(|i| {
            let t = i as f64 / 24000.0;
            [110.0, 220.31, 329.62, 440.1]
                .iter()
                .enumerate()
                .map(|(k, hz)| {
                    (1..=16)
                        .map(|h| {
                            0.04 / h as f64
                                * (std::f64::consts::TAU * hz * h as f64 * t + k as f64).sin()
                        })
                        .sum::<f64>()
                })
                .sum::<f64>() as f32
        })
        .collect()
}
fn paired(pcm: &[f32]) {
    let mut a = SpectralAnalyzer::new(4096);
    let mut b = SpectralAnalyzer::new(4096);
    let mut la = SpectralAnalyzer::new(1024);
    let mut lb = SpectralAnalyzer::new(1024);
    let mut ea = voice_evidence::VoiceEvidence::new();
    let mut eb = voice_evidence::VoiceEvidence::new();
    let mut known = vec![];
    for center in (0..pcm.len()).step_by(480) {
        let x = a.compute(pcm, center);
        let y = b.compute_original(pcm, center);
        assert_eq!(spectrum_bits(&x), spectrum_bits(&y));
        assert_eq!(a.transform_bits(), b.transform_bits());
        let ma = la.measure(pcm, center, &x.peaks, &|| false).unwrap();
        let mb = lb
            .measure_original(pcm, center, &y.peaks, &|| false)
            .unwrap();
        assert_eq!(
            ma.iter().map(bits).collect::<Vec<_>>(),
            mb.iter().map(bits).collect::<Vec<_>>()
        );
        let va = ea.observe(&ma, 440.0, &known, &|| false).unwrap();
        let vb = eb.observe_original(&mb, 440.0, &known, &|| false).unwrap();
        assert_eq!(ea.bit_snapshot(), eb.bit_snapshot());
        assert_eq!(va.bit_snapshot(), vb.bit_snapshot());
        for tuning in [-50.0, -49.999, 0.0, 49.999, 50.0] {
            let fa = polyphony::fit(&x, 440.0, tuning, Some(&va), &|| false).unwrap();
            let fb = polyphony::fit_original(&y, 440.0, tuning, Some(&vb), &|| false).unwrap();
            let fitbits = |f: &polyphony::Fit| {
                (
                    f.residual.to_bits(),
                    f.notes
                        .iter()
                        .map(|n| (n.midi, n.cents.to_bits(), n.support.to_bits()))
                        .collect::<Vec<_>>(),
                )
            };
            assert_eq!(fitbits(&fa), fitbits(&fb));
            for p in &fa.notes {
                assert!(
                    voice_evidence::current_support(pcm, center, *p, 440.0, &x)
                        == voice_evidence::current_support_original(pcm, center, *p, 440.0, &y)
                );
            }
            known = fa.notes;
        }
    }
}
#[test]
fn paired_internal_bits_synthetic() {
    paired(&pcm());
}
#[test]
#[ignore = "requires FRETBLOOM_COST_PCM_DIR"]
fn paired_internal_bits_frozen() {
    let dir = std::env::var("FRETBLOOM_COST_PCM_DIR")
        .expect("FRETBLOOM_COST_PCM_DIR must name the absolute frozen fixture directory");
    let dir = std::path::Path::new(&dir);
    assert!(
        dir.is_absolute() && dir.is_dir(),
        "FRETBLOOM_COST_PCM_DIR is not an absolute directory: {}",
        dir.display()
    );
    for (name, declared) in [
        (
            "dense",
            "1f25c773759ce1fee59f3f4e7ca3c886e614aeaa19c84c9fa75be08e4ddfad8f",
        ),
        (
            "sideband",
            "bc874d57594e94ed717c1a26778336c8d7562b9bc6007005bec96d6271649281",
        ),
        (
            "real-solo",
            "0ab5364c9f6c8394f0d506918ce61027ee96be22325e0592650f50842906c6b0",
        ),
        (
            "real-comp",
            "528ebe0b53625b0adccdd2fb42bc142b13cd9e7fbd31249effce990eb801d63b",
        ),
    ] {
        let path = dir.join(format!("{name}.f32le"));
        let data = std::fs::read(&path)
            .unwrap_or_else(|e| panic!("FRETBLOOM_COST_PCM_DIR {}: {e}", path.display()));
        assert!(
            !data.is_empty() && data.len() % 4 == 0,
            "invalid f32le shape: {}",
            path.display()
        );
        use sha2::{Digest, Sha256};
        assert_eq!(
            format!("{:x}", Sha256::digest(&data)),
            declared,
            "declared SHA-256 mismatch: {}",
            path.display()
        );
        let p: Vec<_> = data
            .chunks_exact(4)
            .map(|v| f32::from_le_bytes(v.try_into().unwrap()))
            .collect();
        assert!(
            p.iter().all(|v| v.is_finite()),
            "nonfinite fixture: {}",
            path.display()
        );
        paired(&p);
    }
}
#[test]
fn quotient_boundaries_and_exceptions() {
    use crate::ratio_gate::RatioGate;
    let mut n = 0;
    for center in [
        -128.0,
        -50.0,
        -50.0_f64.next_down(),
        -49.999,
        0.0,
        49.999,
        50.0,
        50.0_f64.next_up(),
        128.0,
    ] {
        for tol in [12.0, 18.0, 35.0, 45.0] {
            let gate = RatioGate::new(center, tol);
            for nominal in [
                f64::MIN_POSITIVE,
                1e-200,
                35.0,
                432.0,
                440.0,
                446.0,
                6500.0,
                1e200,
            ] {
                for h in 1..=8 {
                    for boundary in [
                        center - tol,
                        center + tol,
                        center - tol - 0.5,
                        center + tol + 0.5,
                    ] {
                        let at = nominal * h as f64 * 2.0_f64.powf(boundary / 1200.0);
                        let mut a = at;
                        for _ in 0..12 {
                            a = a.next_down();
                        }
                        for _ in 0..25 {
                            let cents = 1200.0 * (a / (nominal * h as f64)).log2();
                            if (cents - center).abs() <= tol {
                                assert!(!gate.rejects(a, nominal * h as f64), "{center} {tol} {a}");
                            }
                            n += 1;
                            a = a.next_up();
                        }
                    }
                }
            }
            for a in [
                f64::NAN,
                f64::INFINITY,
                f64::NEG_INFINITY,
                0.0,
                -0.0,
                -1.0,
                f64::from_bits(1),
            ] {
                assert!(!gate.rejects(a, 440.0));
                assert!(!gate.rejects(440.0, a));
            }
        }
    }
    eprintln!("quotient_boundary_checks={n}");
}
#[test]
fn median_total_order_bits() {
    let mut seed = 0x5a17_93de_0000_0001_u64;
    for len in 1..=44 {
        for _ in 0..1000 {
            let mut v: Vec<_> = (0..len)
                .map(|_| {
                    seed ^= seed << 13;
                    seed ^= seed >> 7;
                    seed ^= seed << 17;
                    f64::from_bits(seed)
                })
                .collect();
            v[0] = f64::from_bits(
                [0, 1 << 63, 0x7ff8_0000_0000_0001, 0xfff8_0000_0000_0042][seed as usize % 4],
            );
            let mut sorted = v.clone();
            sorted.sort_by(f64::total_cmp);
            assert_eq!(
                sorted[len / 2].to_bits(),
                v.select_nth_unstable_by(len / 2, f64::total_cmp)
                    .1
                    .to_bits()
            );
        }
    }
}
#[test]
fn leakage_boundaries_old_unsorted_duplicate_nonfinite_behaviour() {
    let p = pcm();
    let base = 24000.0 / 1024.0;
    let edge: f64 = 100.0 + 4.0 * base;
    let variants = vec![
        vec![100.0, 300.0, 110.0],
        vec![100.0, 100.0, edge.next_down(), edge, edge.next_up()],
        vec![edge, 100.0, 100.0_f64.next_up()],
        vec![100.0, f64::NAN, 110.0],
        vec![f64::INFINITY, 0.0, -1.0, f64::NEG_INFINITY],
        vec![100.0; 553],
        (0..552).map(|i| 35.0 + i as f64 * 11.7).collect(),
    ];
    for values in variants {
        let anchors: Vec<_> = values
            .into_iter()
            .map(|hz| Peak {
                hz,
                amplitude: 0.01,
                phase: 0.37,
                prominent: true,
            })
            .collect();
        let mut a = SpectralAnalyzer::new(1024);
        let mut b = SpectralAnalyzer::new(1024);
        let x = a.measure(&p, 4096, &anchors, &|| false).unwrap();
        let y = b.measure_original(&p, 4096, &anchors, &|| false).unwrap();
        assert_eq!(
            x.iter().map(bits).collect::<Vec<_>>(),
            y.iter().map(bits).collect::<Vec<_>>()
        );
    }
}
#[test]
fn cancellation_ordinals_and_progress() {
    let p = pcm();
    let options = AnalysisOptions::default();
    let count = AtomicUsize::new(0);
    let mut old_progress = vec![];
    let old = analyze_original(
        &p,
        24000,
        &options,
        &|| {
            count.fetch_add(1, Relaxed);
            false
        },
        &mut |v| old_progress.push((v.processed_samples, v.total_samples)),
    )
    .unwrap();
    let total = count.load(Relaxed);
    count.store(0, Relaxed);
    let mut new_progress = vec![];
    let new = analyze(
        &p,
        24000,
        &options,
        &|| {
            count.fetch_add(1, Relaxed);
            false
        },
        &mut |v| new_progress.push((v.processed_samples, v.total_samples)),
    )
    .unwrap();
    assert_eq!(total, count.load(Relaxed));
    assert_eq!(old_progress, new_progress);
    assert_eq!(
        serde_json::to_vec(&old).unwrap(),
        serde_json::to_vec(&new).unwrap()
    );
    // Sample the entire pipeline, and exhaust every local measure/observe/fit checkpoint below.
    for ordinal in (1..=total)
        .step_by((total / 32).max(1))
        .chain([total, total + 1])
    {
        let run = |original: bool| {
            let n = AtomicUsize::new(0);
            let mut progress = vec![];
            let cancel = || n.fetch_add(1, Relaxed) + 1 == ordinal;
            let r = if original {
                analyze_original(&p, 24000, &options, &cancel, &mut |v| {
                    progress.push((v.processed_samples, v.total_samples))
                })
            } else {
                analyze(&p, 24000, &options, &cancel, &mut |v| {
                    progress.push((v.processed_samples, v.total_samples))
                })
            };
            (
                r.map(|v| serde_json::to_vec(&v).unwrap())
                    .map_err(|e| e.to_string()),
                progress,
                n.load(Relaxed),
            )
        };
        assert_eq!(run(false), run(true));
    }
    let spectrum = SpectralAnalyzer::new(4096).compute(&p, 4096);
    for stage in 0..3 {
        let run = |original: bool, ordinal: usize| {
            let n = AtomicUsize::new(0);
            let cancel = || n.fetch_add(1, Relaxed) + 1 == ordinal;
            let r = match stage {
                0 => {
                    let mut a = SpectralAnalyzer::new(1024);
                    if original {
                        a.measure_original(&p, 4096, &spectrum.peaks, &cancel)
                    } else {
                        a.measure(&p, 4096, &spectrum.peaks, &cancel)
                    }
                    .map(|_| ())
                }
                1 => {
                    let mut a = voice_evidence::VoiceEvidence::new();
                    if original {
                        a.observe_original(&spectrum.peaks, 440.0, &[], &cancel)
                    } else {
                        a.observe(&spectrum.peaks, 440.0, &[], &cancel)
                    }
                    .map(|_| ())
                }
                _ => if original {
                    polyphony::fit_original(&spectrum, 440.0, 0.0, None, &cancel)
                } else {
                    polyphony::fit(&spectrum, 440.0, 0.0, None, &cancel)
                }
                .map(|_| ()),
            };
            (r.map_err(|e| e.to_string()), n.load(Relaxed))
        };
        let (_, count) = run(true, usize::MAX);
        for ordinal in 1..=count + 1 {
            assert_eq!(run(true, ordinal), run(false, ordinal));
        }
        eprintln!("stage={stage} checkpoints={count}");
    }
    eprintln!("pipeline_checkpoints={total}");
}
#[test]
#[ignore = "run alone for meaningful global allocation high-water"]
fn memory_high_water_and_repeated_retention() {
    use crate::allocation_meter::{LIVE, PEAK};
    let p = pcm();
    let anchors: Vec<_> = (0..552)
        .map(|i| Peak {
            hz: 35.0 + i as f64 * 11.7,
            amplitude: 0.01,
            phase: 0.37,
            prominent: true,
        })
        .collect();
    let mut a = SpectralAnalyzer::new(1024);
    let mut b = SpectralAnalyzer::new(1024);
    let baseline = LIVE.load(Relaxed);
    PEAK.store(baseline, Relaxed);
    drop(b.measure_original(&p, 4096, &anchors, &|| false).unwrap());
    let old_peak = PEAK.load(Relaxed) - baseline;
    let retained = LIVE.load(Relaxed);
    PEAK.store(retained, Relaxed);
    for _ in 0..64 {
        drop(a.measure(&p, 4096, &anchors, &|| false).unwrap());
        assert_eq!(LIVE.load(Relaxed), retained);
    }
    let new_peak = PEAK.load(Relaxed) - retained;
    assert!(new_peak <= old_peak + 330_000);
    eprintln!(
        "old_peak={old_peak} new_peak={new_peak} retained_delta={} repetitions=64",
        LIVE.load(Relaxed) - retained
    );
}

#[test]
fn isolated_cache_transform_and_comb_boundaries() {
    let pcm = pcm();
    let mut original = SpectralAnalyzer::new(4096);
    let spectrum = original.compute_original(&pcm, 4096);
    let expected = SpectralAnalyzer::new(1024)
        .measure_original(&pcm, 4096, &spectrum.peaks, &|| false)
        .unwrap();
    let cached = SpectralAnalyzer::new(1024)
        .measure_cache_only(&pcm, 4096, &spectrum.peaks, &|| false)
        .unwrap();
    let transformed = SpectralAnalyzer::new(1024)
        .measure_transform_only(&pcm, 4096, &spectrum.peaks, &|| false)
        .unwrap();
    assert_eq!(
        expected.iter().map(bits).collect::<Vec<_>>(),
        cached.iter().map(bits).collect::<Vec<_>>()
    );
    assert_eq!(
        expected.iter().map(bits).collect::<Vec<_>>(),
        transformed.iter().map(bits).collect::<Vec<_>>()
    );
    for tuning in [-50.0, -49.999, 0.0, 49.999, 50.0] {
        let hz = 440.0 * 2.0_f64.powf(tuning / 1200.0);
        let mut values = vec![hz, hz];
        for h in [1.5_f64, 2.5, 7.5, 8.5] {
            values.extend([hz * h.next_down(), hz * h, hz * h.next_up()]);
        }
        for c in [-45.0_f64, 45.0, -12.0, 12.0] {
            let edge = hz * 2.0_f64.powf(c / 1200.0);
            values.extend([edge.next_down(), edge, edge.next_up()]);
        }
        values.extend([
            f64::NAN,
            f64::INFINITY,
            0.0,
            -0.0,
            -1.0,
            f64::MIN_POSITIVE,
            f64::from_bits(1),
        ]);
        let peaks = values
            .into_iter()
            .map(|hz| Peak {
                hz,
                amplitude: 0.1,
                phase: 0.0,
                prominent: true,
            })
            .collect();
        let s = Spectrum {
            peaks,
            flatness: 0.0,
            tonal_fraction: 1.0,
            supported: true,
            peak_energy_fraction: 1.0,
            rms: 0.1,
        };
        let a = polyphony::fit(&s, 440.0, tuning, None, &|| false).unwrap();
        let b = polyphony::fit_original(&s, 440.0, tuning, None, &|| false).unwrap();
        assert_eq!(a.residual.to_bits(), b.residual.to_bits());
        let bits = |f: polyphony::Fit| {
            f.notes
                .iter()
                .map(|p| (p.midi, p.cents.to_bits(), p.support.to_bits()))
                .collect::<Vec<_>>()
        };
        assert_eq!(bits(a), bits(b));
    }
}

#[test]
fn maximum_anchor_cancellation_ordinals() {
    let p = pcm();
    let anchors: Vec<_> = (0..552)
        .map(|i| Peak {
            hz: 35.0 + i as f64 * 11.7,
            amplitude: 0.01,
            phase: 0.37,
            prominent: true,
        })
        .collect();
    for ordinal in [1, 552, 553, 554, 1105, 2209, 2764, 2765] {
        let run = |original: bool| {
            let n = AtomicUsize::new(0);
            let cancel = || n.fetch_add(1, Relaxed) + 1 == ordinal;
            let mut a = SpectralAnalyzer::new(1024);
            let r = if original {
                a.measure_original(&p, 4096, &anchors, &cancel)
            } else {
                a.measure(&p, 4096, &anchors, &cancel)
            };
            (
                r.map(|v| v.iter().map(bits).collect::<Vec<_>>())
                    .map_err(|e| e.to_string()),
                n.load(Relaxed),
            )
        };
        assert_eq!(run(true), run(false));
    }
}
