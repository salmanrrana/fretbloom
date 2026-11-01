use fretbloom_analysis::*;
fn tone(midi: u8, seconds: f64) -> Vec<f32> {
    let hz = 440.0 * 2.0_f64.powf((midi as f64 - 69.0) / 12.0);
    (0..(seconds * 24000.0) as usize)
        .map(|i| {
            let t = i as f64 / 24000.0;
            (0.15 * (std::f64::consts::TAU * hz * t).sin()
                + 0.05 * (std::f64::consts::TAU * hz * 2.0 * t).sin()) as f32
        })
        .collect()
}
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
#[test]
fn low_notes_keep_their_octave() {
    for midi in [40, 41, 45, 47, 64, 84] {
        let out = run(&tone(midi, 0.6));
        assert!(
            out.result
                .monophonic_notes
                .iter()
                .any(|n| n.midi == midi && n.end - n.start > 0.3),
            "{midi}: {:?}",
            out.result.monophonic_notes
        );
    }
}
#[test]
fn silence_is_a_complete_empty_timeline() {
    let out = run(&vec![0.0; 24000]);
    assert_eq!(out.result.harmony.len(), 1);
    assert!(matches!(
        out.result.harmony[0].kind,
        HarmonyKind::NoChord {
            reason: NoChordReason::Silence
        }
    ));
    assert!(out.result.monophonic_notes.is_empty());
    assert!(out.result.polyphonic_notes.is_empty());
    assert_eq!(out.result.harmony[0].start, 0.0);
    assert_eq!(out.result.harmony[0].end, 1.0);
    assert!(out
        .features
        .frames
        .iter()
        .all(|f| f.chroma == [0.0; 12] && f.midi.is_none() && f.rms == 0.0));
}
#[test]
fn input_and_cancellation_are_typed() {
    let opt = AnalysisOptions::default();
    let p = &mut |_| {};
    assert!(matches!(
        analyze(&[], 24000, &opt, &|| false, p),
        Err(AnalysisError::InvalidInput(_))
    ));
    assert!(matches!(
        analyze(&[f32::NAN], 24000, &opt, &|| false, p),
        Err(AnalysisError::InvalidInput(_))
    ));
    assert!(matches!(
        analyze(&[0.0], 44100, &opt, &|| false, p),
        Err(AnalysisError::InvalidInput(_))
    ));
    assert!(matches!(
        analyze(&[0.0; 480], 24000, &opt, &|| true, p),
        Err(AnalysisError::Cancelled)
    ));
    let opt = AnalysisOptions {
        concert_a_hz: 447.0,
        ..opt
    };
    assert!(matches!(
        analyze(&[0.0], 24000, &opt, &|| false, p),
        Err(AnalysisError::InvalidInput(_))
    ));
}
#[test]
fn all_qualities_and_slash_names_serialize() {
    let vocabulary = chord_vocabulary();
    assert_eq!(vocabulary.len(), 18);
    for t in vocabulary {
        let c = ChordIdentity {
            root_pc: 0,
            quality: t.quality,
            bass_pc: Some(4),
        };
        assert!(chord_label(&c, Spelling::Sharps).ends_with("/E"));
        let s = serde_json::to_string(&c).unwrap();
        let round: ChordIdentity = serde_json::from_str(&s).unwrap();
        assert_eq!(round, c);
    }
    assert_eq!(pitch_name(61, Spelling::Flats), "Db4");
    let out = run(&[0.0; 480]);
    let value = serde_json::to_value(&out).unwrap();
    assert_eq!(value["result"]["harmony"][0]["kind"], "no_chord");
    assert_eq!(value["result"]["sampleRateHz"], 24000);
    let _: AnalysisOutput = serde_json::from_value(value).unwrap();
}
#[test]
fn silence_margins_are_not_bridged() {
    let mut pcm = vec![0.0; 4800];
    pcm.extend(tone(52, 0.5));
    pcm.extend(vec![0.0; 4800]);
    let out = run(&pcm);
    for n in out
        .result
        .monophonic_notes
        .iter()
        .chain(&out.result.polyphonic_notes)
    {
        assert!(n.start >= 0.2);
        assert!(n.end <= 0.7 + 1e-8);
    }
    assert!(matches!(
        out.result.harmony.first().unwrap().kind,
        HarmonyKind::NoChord {
            reason: NoChordReason::Silence
        }
    ));
    assert!(matches!(
        out.result.harmony.last().unwrap().kind,
        HarmonyKind::NoChord {
            reason: NoChordReason::Silence
        }
    ));
}
#[test]
fn harmonic_equivalence_stays_uncertain() {
    let mut pcm = vec![0.0; 24000];
    for midi in [48, 52, 55, 57] {
        for (x, y) in pcm.iter_mut().zip(tone(midi, 1.0)) {
            *x += y * 0.6;
        }
    }
    let out = run(&pcm);
    assert!(out.result.harmony.iter().any(|e|matches!(&e.kind,HarmonyKind::Unknown{alternatives,..} if alternatives.len()>=2 && alternatives[0].evidence.margin<0.12)));
}
#[test]
fn explicit_modes_preserve_stream_semantics() {
    let mut pcm = tone(48, 0.5);
    for (x, y) in pcm.iter_mut().zip(tone(52, 0.5)) {
        *x += y;
    }
    for mode in [
        AnalysisMode::Auto,
        AnalysisMode::Monophonic,
        AnalysisMode::Polyphonic,
    ] {
        let options = AnalysisOptions {
            mode,
            ..AnalysisOptions::default()
        };
        let out = analyze(&pcm, 24000, &options, &|| false, &mut |_| {}).unwrap();
        assert!(
            out.result.monophonic_notes.is_empty(),
            "multi-voice audio must not become a monophonic estimate"
        );
        if mode == AnalysisMode::Monophonic {
            assert!(out.result.polyphonic_notes.is_empty());
        } else {
            assert!(out.result.polyphonic_notes.iter().any(|n| n.midi == 48));
            assert!(out.result.polyphonic_notes.iter().any(|n| n.midi == 52));
        }
    }
    let options = AnalysisOptions {
        mode: AnalysisMode::Polyphonic,
        ..AnalysisOptions::default()
    };
    let out = analyze(&tone(52, 0.5), 24000, &options, &|| false, &mut |_| {}).unwrap();
    assert!(out.result.monophonic_notes.is_empty());
    assert!(out.result.polyphonic_notes.iter().any(|n| n.midi == 52));
}
#[test]
fn progress_can_cancel_during_processing_and_clipping_is_reported() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let flag = AtomicBool::new(false);
    let pcm = tone(47, 1.0);
    let result = analyze(
        &pcm,
        24000,
        &AnalysisOptions::default(),
        &|| flag.load(Ordering::Relaxed),
        &mut |p| {
            if p.processed_samples >= 480 {
                flag.store(true, Ordering::Relaxed)
            }
        },
    );
    assert!(matches!(result, Err(AnalysisError::Cancelled)));
    let out = run(&vec![2.0; 4800]);
    assert!(out
        .result
        .warnings
        .iter()
        .any(|w| w.code == WarningCode::Clipping));
    assert!(serde_json::to_string(&out).is_ok());
}
