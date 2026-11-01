use crate::{ChordIdentity, ChordQuality, Spelling};
fn pc_name(pc: u8, spelling: Spelling) -> &'static str {
    let names = match spelling {
        Spelling::Sharps => [
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
        ],
        Spelling::Flats => [
            "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
        ],
    };
    names[usize::from(pc % 12)]
}
pub fn pitch_name(midi: u8, spelling: Spelling) -> String {
    format!(
        "{}{}",
        pc_name(midi % 12, spelling),
        i16::from(midi) / 12 - 1
    )
}
pub fn chord_label(chord: &ChordIdentity, spelling: Spelling) -> String {
    let suffix = match chord.quality {
        ChordQuality::Maj => "",
        ChordQuality::Min => "m",
        ChordQuality::Dom7 => "7",
        ChordQuality::Maj7 => "maj7",
        ChordQuality::Min7 => "m7",
        ChordQuality::Sus2 => "sus2",
        ChordQuality::Sus4 => "sus4",
        ChordQuality::Add9 => "add9",
        ChordQuality::Madd9 => "madd9",
        ChordQuality::Add11 => "add11",
        ChordQuality::Madd11 => "madd11",
        ChordQuality::Six => "6",
        ChordQuality::M6 => "m6",
        ChordQuality::Dim => "dim",
        ChordQuality::Dim7 => "dim7",
        ChordQuality::Hdim7 => "m7b5",
        ChordQuality::Aug => "aug",
        ChordQuality::Five => "5",
    };
    let mut label = format!("{}{}", pc_name(chord.root_pc, spelling), suffix);
    if let Some(bass) = chord.bass_pc.filter(|&b| b != chord.root_pc) {
        label.push('/');
        label.push_str(pc_name(bass, spelling));
    }
    label
}
