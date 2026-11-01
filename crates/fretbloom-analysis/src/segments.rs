use crate::*;
use crate::{config::*, polyphony::Pitch};
#[derive(Clone)]
pub(crate) struct Frame {
    pub notes: Vec<Pitch>,
    pub mono: Option<Pitch>,
    pub bass: Option<Pitch>,
    pub rms: f64,
    pub silent: bool,
    pub tonal: bool,
    pub dense: bool,
    // Demonstrated pitch-local absence blocks median resurrection.
    pub absent: u128,
}
fn round6(v: f64) -> f64 {
    (v * 1e6).round() / 1e6
}
fn check(cancelled: &(dyn Fn() -> bool + Sync)) -> Result<(), AnalysisError> {
    if cancelled() {
        Err(AnalysisError::Cancelled)
    } else {
        Ok(())
    }
}
type SegmentedOutput = (
    Vec<HarmonyEvent>,
    Vec<NoteEvent>,
    Vec<NoteEvent>,
    AlignmentFeatures,
);

pub(crate) fn finish(
    mut frames: Vec<Frame>,
    duration: f64,
    options: &AnalysisOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
) -> Result<SegmentedOutput, AnalysisError> {
    // Median only isolated one-hop dropouts/spikes. Silence is an absolute barrier.
    let original = frames.clone();
    for i in 1..frames.len().saturating_sub(1) {
        check(cancelled)?;
        if frames[i].silent {
            continue;
        }
        let mut notes = Vec::new();
        for midi in MIN_MIDI..=MAX_MIDI {
            let votes: Vec<_> = original[i - 1..=i + 1]
                .iter()
                .flat_map(|f| f.notes.iter().filter(|p| p.midi == midi))
                .copied()
                .collect();
            if votes.len() >= 2 && frames[i].absent & (1_u128 << (midi - MIN_MIDI)) == 0 {
                notes.push(Pitch {
                    midi,
                    cents: votes.iter().map(|p| p.cents).sum::<f64>() / votes.len() as f64,
                    support: votes.iter().map(|p| p.support).sum::<f64>() / votes.len() as f64,
                });
            }
        }
        frames[i].notes = notes;
        frames[i].mono = original[i]
            .mono
            .filter(|p| frames[i].notes.len() == 1 && frames[i].notes[0].midi == p.midi);
    }
    // Confirm a physical pitch before choosing its output stream. Route changes
    // may split a supported note, but must not restart its duration requirement.
    for midi in MIN_MIDI..=MAX_MIDI {
        let mut begin = None;
        for i in 0..=frames.len() {
            check(cancelled)?;
            let present = frames
                .get(i)
                .is_some_and(|f| !f.silent && f.notes.iter().any(|p| p.midi == midi));
            if present {
                begin.get_or_insert(i);
            } else if let Some(start) = begin.take() {
                if i - start < 3 {
                    for f in &mut frames[start..i] {
                        f.notes.retain(|p| p.midi != midi);
                        f.mono = f.mono.filter(|p| p.midi != midi);
                    }
                }
            }
        }
    }
    let mut mono_events = Vec::new();
    let mut poly_events = Vec::new();
    for is_mono in [true, false] {
        for midi in MIN_MIDI..=MAX_MIDI {
            check(cancelled)?;
            let mut start = None;
            let mut cents = 0.0;
            let mut support = 0.0;
            for i in 0..=frames.len() {
                let note = frames.get(i).and_then(|f| {
                    if f.silent {
                        return None;
                    }
                    if is_mono {
                        if options.mode == AnalysisMode::Polyphonic {
                            None
                        } else {
                            f.mono.filter(|n| n.midi == midi)
                        }
                    } else if options.mode == AnalysisMode::Monophonic
                        || (options.mode == AnalysisMode::Auto && f.mono.is_some())
                    {
                        None
                    } else {
                        f.notes.iter().find(|n| n.midi == midi).copied()
                    }
                });
                if let Some(p) = note {
                    if start.is_none() {
                        start = Some(i);
                    }
                    cents += p.cents;
                    support += p.support;
                } else if let Some(begin) = start.take() {
                    if i > begin {
                        let event = NoteEvent {
                            start: begin as f64 * 0.02,
                            end: (i as f64 * 0.02).min(duration),
                            midi,
                            name: pitch_name(midi, options.spelling),
                            cents: (cents / (i - begin) as f64).clamp(-50.0, 50.0),
                            evidence: Evidence::new(support / (i - begin) as f64, 0.25),
                        };
                        let target = if is_mono {
                            &mut mono_events
                        } else {
                            &mut poly_events
                        };
                        target.push(event);
                        if target.len() > MAX_NOTES {
                            return Err(AnalysisError::LimitExceeded(
                                "too many note events".into(),
                            ));
                        }
                    }
                    cents = 0.0;
                    support = 0.0;
                }
            }
        }
    }
    mono_events.sort_by(|a, b| a.start.total_cmp(&b.start).then(a.midi.cmp(&b.midi)));
    poly_events.sort_by(|a, b| a.start.total_cmp(&b.start).then(a.midi.cmp(&b.midi)));
    let mut harmony: Vec<HarmonyEvent> = Vec::new();
    for (i, f) in frames.iter().enumerate() {
        check(cancelled)?;
        let bass = f
            .bass
            .filter(|b| {
                let start = i.saturating_sub(2);
                let end = (i + 3).min(frames.len());
                frames[start..end]
                    .iter()
                    .filter(|f| !f.silent && f.bass.is_some_and(|n| n.midi == b.midi))
                    .count()
                    >= 5
            })
            .map(|b| BassEstimate {
                midi: b.midi,
                pitch_class: b.midi % 12,
                evidence: Evidence::new(b.support.sqrt(), 0.25),
            });
        let kind = if f.silent {
            HarmonyKind::NoChord {
                reason: NoChordReason::Silence,
            }
        } else if !f.tonal {
            HarmonyKind::NoChord {
                reason: NoChordReason::Unpitched,
            }
        } else if f.notes.is_empty() {
            HarmonyKind::Unknown {
                reason: UnknownReason::InsufficientEvidence,
                alternatives: vec![],
            }
        } else {
            crate::chords::infer(
                &f.notes,
                bass.as_ref().map(|b| b.pitch_class),
                options.spelling,
            )
        };
        let start = i as f64 * 0.02;
        let end = ((i + 1) as f64 * 0.02).min(duration);
        let same = harmony.last().is_some_and(|last| {
            same_kind(&last.kind, &kind)
                && last.bass.as_ref().map(|b| b.midi) == bass.as_ref().map(|b| b.midi)
        });
        if same {
            harmony.last_mut().unwrap().end = end;
        } else {
            harmony.push(HarmonyEvent {
                start,
                end,
                bass,
                kind,
            });
        }
        if harmony.len() > MAX_HARMONY {
            return Err(AnalysisError::LimitExceeded(
                "too many harmony events".into(),
            ));
        }
    }
    // Brief tentative chord spans remain unknown rather than claiming a confirmed attack.
    let mut begin = 0;
    while begin < harmony.len() {
        let mut end = begin + 1;
        while end < harmony.len()
            && same_harmonic_identity(&harmony[begin].kind, &harmony[end].kind)
        {
            end += 1;
        }
        let confirmed = harmony[end - 1].end - harmony[begin].start >= 0.06 - 1e-9;
        for event in &mut harmony[begin..end] {
            if !confirmed {
                if let HarmonyKind::Chord {
                    primary,
                    alternatives,
                } = &event.kind
                {
                    let mut all = vec![primary.clone()];
                    all.extend(alternatives.iter().take(2).cloned());
                    event.kind = HarmonyKind::Unknown {
                        reason: UnknownReason::InsufficientEvidence,
                        alternatives: all,
                    };
                }
            }
        }
        begin = end;
    }
    let mut features = AlignmentFeatures {
        schema_version: 1,
        engine_version: ENGINE_VERSION.into(),
        duration,
        hop_seconds: 0.08,
        frames: Vec::new(),
    };
    for (i, group) in frames.chunks(4).enumerate() {
        check(cancelled)?;
        let mut chroma = [0.0_f64; 12];
        let mut energy = 0.0;
        let mono = group[0]
            .mono
            .map(|p| p.midi)
            .filter(|m| group.iter().all(|f| f.mono.is_some_and(|p| p.midi == *m)));
        for f in group {
            energy += f.rms * f.rms;
            for n in &f.notes {
                chroma[(n.midi % 12) as usize] += n.support;
            }
        }
        let norm = chroma.iter().map(|v| v * v).sum::<f64>().sqrt();
        if norm > 0.0 {
            for v in &mut chroma {
                *v = round6(*v / norm);
            }
        }
        features.frames.push(AlignmentFrame {
            // Rounding an exact off-grid endpoint can move it past duration.
            time: round6(i as f64 * 0.08 + 0.04).min(duration),
            chroma,
            midi: mono,
            rms: round6((energy / group.len() as f64).sqrt()),
        });
    }
    Ok((harmony, mono_events, poly_events, features))
}
// Bass estimates retain their own event boundaries, without demoting a stable
// root/quality every time the lowest observed voice changes or becomes uncertain.
fn same_harmonic_identity(a: &HarmonyKind, b: &HarmonyKind) -> bool {
    matches!((a, b), (HarmonyKind::Chord {primary: a, ..}, HarmonyKind::Chord {primary: b, ..})
        if a.chord.root_pc == b.chord.root_pc && a.chord.quality == b.chord.quality)
}
fn same_kind(a: &HarmonyKind, b: &HarmonyKind) -> bool {
    match (a, b) {
        (HarmonyKind::NoChord { reason: a }, HarmonyKind::NoChord { reason: b }) => a == b,
        (HarmonyKind::Chord { primary: a, .. }, HarmonyKind::Chord { primary: b, .. }) => {
            a.chord == b.chord
        }
        (
            HarmonyKind::Unknown {
                reason: a,
                alternatives: aa,
            },
            HarmonyKind::Unknown {
                reason: b,
                alternatives: bb,
            },
        ) => a == b && aa.first().map(|c| &c.chord) == bb.first().map(|c| &c.chord),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pitch(midi: u8) -> Pitch {
        Pitch {
            midi,
            cents: 0.0,
            support: 1.0,
        }
    }

    fn frame(midis: &[u8], mono: bool, bass: Option<u8>) -> Frame {
        Frame {
            notes: midis.iter().copied().map(pitch).collect(),
            mono: mono.then(|| pitch(midis[0])),
            bass: bass.map(pitch),
            rms: 0.1,
            silent: false,
            tonal: true,
            dense: false,
            absent: 0,
        }
    }

    #[test]
    fn route_changes_do_not_erase_a_continuously_supported_pitch() {
        let frames = (0..12).map(|i| frame(&[69], i % 4 < 2, Some(69))).collect();
        let (_, mono, poly, _) =
            finish(frames, 0.24, &AnalysisOptions::default(), &|| false).unwrap();
        assert_eq!(mono.len(), 3);
        assert_eq!(poly.len(), 3);
        assert!(
            (mono
                .iter()
                .chain(&poly)
                .map(|n| n.end - n.start)
                .sum::<f64>()
                - 0.24)
                .abs()
                < 1e-9
        );
        for a in &mono {
            for b in &poly {
                assert!(a.end <= b.start || b.end <= a.start);
            }
        }
    }

    #[test]
    fn measured_release_blocks_median_resurrection() {
        let mut frames: Vec<_> = (0..17).map(|_| frame(&[57], true, Some(57))).collect();
        frames[8] = Frame {
            absent: 1_u128 << (57 - MIN_MIDI),
            ..frame(&[], false, None)
        };
        let (_, mono, poly, _) =
            finish(frames, 0.34, &AnalysisOptions::default(), &|| false).unwrap();
        assert!(poly.is_empty());
        assert_eq!(mono.len(), 2);
        assert!(mono.iter().all(|n| n.end <= 0.16 || n.start >= 0.18));
    }

    #[test]
    fn changing_bass_does_not_demote_a_constant_chord() {
        let frames = (0..25)
            .map(|i| {
                frame(
                    &[48, 52, 55],
                    false,
                    if i < 12 { Some(48) } else { Some(52) },
                )
            })
            .collect();
        let (harmony, _, _, _) =
            finish(frames, 0.5, &AnalysisOptions::default(), &|| false).unwrap();
        assert!(
            harmony.len() > 2,
            "bass uncertainty retains its event boundaries"
        );
        assert!(
            harmony
                .iter()
                .all(|e| matches!(e.kind, HarmonyKind::Chord { .. })),
            "{harmony:?}"
        );
    }

    #[test]
    fn silence_and_real_chord_changes_keep_their_boundaries() {
        let mut frames: Vec<_> = (0..8).map(|_| frame(&[48, 52, 55], false, None)).collect();
        frames.push(Frame {
            silent: true,
            rms: 0.0,
            ..frame(&[], false, None)
        });
        frames.extend((0..8).map(|_| frame(&[50, 53, 57], false, None)));
        let (harmony, _, poly, _) =
            finish(frames, 0.34, &AnalysisOptions::default(), &|| false).unwrap();
        assert!(harmony.iter().any(|e| matches!(
            e.kind,
            HarmonyKind::NoChord {
                reason: NoChordReason::Silence
            }
        )));
        assert!(harmony.iter().any(|e| matches!(&e.kind, HarmonyKind::Chord { primary, .. } if primary.chord.root_pc == 2 && primary.chord.quality == ChordQuality::Min)));
        assert!(poly.iter().all(|n| n.end <= 0.16 || n.start >= 0.18));
    }
}
