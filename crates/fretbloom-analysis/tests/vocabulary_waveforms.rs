use fretbloom_analysis::*;
// Independent equal-tempered harmonic voices exercise the entire promised vocabulary.
fn chord(midis: &[u8]) -> Vec<f32> {
    (0..24000)
        .map(|i| {
            let t = i as f64 / 24000.0;
            midis
                .iter()
                .map(|&m| {
                    let f = 440.0 * 2.0_f64.powf((m as f64 - 69.0) / 12.0);
                    (1..=5)
                        .map(|h| {
                            0.06 / (h as f64).powf(1.3)
                                * (std::f64::consts::TAU * f * h as f64 * t + m as f64).sin()
                        })
                        .sum::<f64>()
                })
                .sum::<f64>() as f32
        })
        .collect()
}
#[test]
fn all_families_have_observed_defining_tones() {
    let examples = [
        (ChordQuality::Maj, vec![48, 52, 55]),
        (ChordQuality::Min, vec![48, 51, 55]),
        (ChordQuality::Dom7, vec![48, 52, 55, 58]),
        (ChordQuality::Maj7, vec![48, 52, 55, 59]),
        (ChordQuality::Min7, vec![48, 51, 55, 58]),
        (ChordQuality::Sus2, vec![48, 50, 55]),
        (ChordQuality::Sus4, vec![48, 53, 55]),
        (ChordQuality::Add9, vec![48, 52, 55, 62]),
        (ChordQuality::Madd9, vec![48, 51, 55, 62]),
        (ChordQuality::Add11, vec![48, 52, 55, 65]),
        (ChordQuality::Madd11, vec![48, 51, 55, 65]),
        (ChordQuality::Six, vec![48, 52, 55, 57]),
        (ChordQuality::M6, vec![48, 51, 55, 57]),
        (ChordQuality::Dim, vec![48, 51, 54]),
        (ChordQuality::Dim7, vec![48, 51, 54, 57]),
        (ChordQuality::Hdim7, vec![48, 51, 54, 58]),
        (ChordQuality::Aug, vec![48, 52, 56]),
        (ChordQuality::Five, vec![48, 55]),
    ];
    for (quality, midis) in examples {
        let options = AnalysisOptions {
            mode: AnalysisMode::Polyphonic,
            ..AnalysisOptions::default()
        };
        let out = analyze(&chord(&midis), 24000, &options, &|| false, &mut |_| {}).unwrap();
        let found = out.result.harmony.iter().any(|event| {
            let candidates: Vec<_> = match &event.kind {
                HarmonyKind::Chord {
                    primary,
                    alternatives,
                } => std::iter::once(primary).chain(alternatives).collect(),
                HarmonyKind::Unknown { alternatives, .. } => alternatives.iter().collect(),
                _ => vec![],
            };
            candidates.iter().any(|c| {
                c.chord.root_pc == 0
                    && c.chord.quality == quality
                    && c.missing_pitch_classes.is_empty()
            })
        });
        assert!(found, "missing {quality:?}: {:?}", out.result.harmony);
        assert!(out.result.monophonic_notes.is_empty());
        for midi in midis {
            assert!(
                out.result.polyphonic_notes.iter().any(|n| n.midi == midi),
                "{quality:?} missing observed MIDI {midi}"
            );
        }
    }
}
