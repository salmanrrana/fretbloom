use crate::polyphony::Pitch;
use crate::*;
static VOCABULARY: [ChordTemplate; 18] = [
    ChordTemplate {
        quality: ChordQuality::Maj,
        intervals: &[0, 4, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Min,
        intervals: &[0, 3, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Dom7,
        intervals: &[0, 4, 7, 10],
    },
    ChordTemplate {
        quality: ChordQuality::Maj7,
        intervals: &[0, 4, 7, 11],
    },
    ChordTemplate {
        quality: ChordQuality::Min7,
        intervals: &[0, 3, 7, 10],
    },
    ChordTemplate {
        quality: ChordQuality::Sus2,
        intervals: &[0, 2, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Sus4,
        intervals: &[0, 5, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Add9,
        intervals: &[0, 2, 4, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Madd9,
        intervals: &[0, 2, 3, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Add11,
        intervals: &[0, 4, 5, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Madd11,
        intervals: &[0, 3, 5, 7],
    },
    ChordTemplate {
        quality: ChordQuality::Six,
        intervals: &[0, 4, 7, 9],
    },
    ChordTemplate {
        quality: ChordQuality::M6,
        intervals: &[0, 3, 7, 9],
    },
    ChordTemplate {
        quality: ChordQuality::Dim,
        intervals: &[0, 3, 6],
    },
    ChordTemplate {
        quality: ChordQuality::Dim7,
        intervals: &[0, 3, 6, 9],
    },
    ChordTemplate {
        quality: ChordQuality::Hdim7,
        intervals: &[0, 3, 6, 10],
    },
    ChordTemplate {
        quality: ChordQuality::Aug,
        intervals: &[0, 4, 8],
    },
    ChordTemplate {
        quality: ChordQuality::Five,
        intervals: &[0, 7],
    },
];
pub fn chord_vocabulary() -> &'static [ChordTemplate] {
    &VOCABULARY
}
pub(crate) fn infer(notes: &[Pitch], bass: Option<u8>, spelling: Spelling) -> HarmonyKind {
    let mut support = [0.0_f64; 12];
    for n in notes {
        support[(n.midi % 12) as usize] = support[(n.midi % 12) as usize].max(n.support.sqrt());
    }
    let observed: Vec<u8> = (0..12).filter(|&p| support[p as usize] > 0.25).collect();
    if observed.len() < 2 {
        return HarmonyKind::NoChord {
            reason: NoChordReason::SingleNote,
        };
    }
    let total = support.iter().sum::<f64>();
    let mut candidates = Vec::new();
    for root in 0..12 {
        for template in &VOCABULARY {
            let pcs: Vec<u8> = template.intervals.iter().map(|n| (root + n) % 12).collect();
            let missing: Vec<u8> = pcs
                .iter()
                .copied()
                .filter(|p| !observed.contains(p))
                .collect();
            // Defining thirds, sevenths, suspensions and additions require observations.
            let characteristic_missing = template
                .intervals
                .iter()
                .any(|&n| n != 7 && !observed.contains(&((root + n) % 12)));
            let mean = pcs.iter().map(|p| support[*p as usize]).sum::<f64>() / pcs.len() as f64;
            let outside = support
                .iter()
                .enumerate()
                .filter(|(p, _)| !pcs.contains(&(*p as u8)))
                .map(|(_, v)| v)
                .sum::<f64>()
                / total.max(1e-9);
            let score = (mean
                - 0.65 * outside
                - 0.25 * missing.len() as f64 / pcs.len() as f64
                - if characteristic_missing { 0.25 } else { 0.0 })
            .clamp(0.0, 1.0);
            let identity = ChordIdentity {
                root_pc: root,
                quality: template.quality,
                bass_pc: bass,
            };
            let supported = pcs
                .iter()
                .copied()
                .filter(|p| observed.contains(p))
                .collect();
            candidates.push(ChordCandidate {
                label: chord_label(&identity, spelling),
                chord: identity,
                evidence: Evidence::new(score, 0.0),
                supported_pitch_classes: supported,
                missing_pitch_classes: missing,
            });
        }
    }
    candidates.sort_by(|a, b| b.evidence.score.total_cmp(&a.evidence.score));
    let margin = (candidates[0].evidence.score - candidates[1].evidence.score).max(0.0);
    let mut primary = candidates.remove(0);
    primary.evidence = Evidence::new(primary.evidence.score, margin);
    let alternatives: Vec<_> = candidates
        .into_iter()
        .filter(|c| c.evidence.score >= primary.evidence.score - 0.20 && c.evidence.score >= 0.5)
        .take(3)
        .collect();
    if primary.evidence.score >= 0.65 && margin >= 0.12 && primary.missing_pitch_classes.is_empty()
    {
        HarmonyKind::Chord {
            primary,
            alternatives,
        }
    } else {
        let reason = if primary.evidence.score >= 0.65 {
            UnknownReason::Ambiguous
        } else {
            UnknownReason::InsufficientEvidence
        };
        let mut all = vec![primary];
        all.extend(alternatives);
        all.truncate(3);
        HarmonyKind::Unknown {
            reason,
            alternatives: all,
        }
    }
}
