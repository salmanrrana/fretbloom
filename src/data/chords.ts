import { OPEN_STRINGS } from '../audio/notes'
import { midiToName } from '../audio/notes'

/**
 * A chord voicing. `frets` runs low E → high e.
 * -1 means muted, 0 means open, otherwise the fret number.
 * `fingers` uses 0 for open/muted, 1-4 for index→pinky.
 */
export interface ChordShape {
  name: string
  frets: number[]
  fingers: number[]
  /** Fret the diagram window starts at (1 unless the shape lives up the neck). */
  baseFret: number
}

export const CHORDS: Record<string, ChordShape> = {
  C:    { name: 'C',    frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  D:    { name: 'D',    frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  Dm:   { name: 'Dm',   frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  E:    { name: 'E',    frets: [0, 2, 2, 1, 0, 0],  fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  Em:   { name: 'Em',   frets: [0, 2, 2, 0, 0, 0],  fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  F:    { name: 'F',    frets: [1, 3, 3, 2, 1, 1],  fingers: [1, 3, 4, 2, 1, 1], baseFret: 1 },
  G:    { name: 'G',    frets: [3, 2, 0, 0, 0, 3],  fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  A:    { name: 'A',    frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  Am:   { name: 'Am',   frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  B7:   { name: 'B7',   frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },
  Bm:   { name: 'Bm',   frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1 },
  A7:   { name: 'A7',   frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0], baseFret: 1 },
  D7:   { name: 'D7',   frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  E7:   { name: 'E7',   frets: [0, 2, 0, 1, 0, 0],  fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  G7:   { name: 'G7',   frets: [3, 2, 0, 0, 0, 1],  fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  Cadd9:{ name: 'Cadd9',frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4], baseFret: 1 },
  Dsus4:{ name: 'Dsus4',frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], baseFret: 1 },
  Asus2:{ name: 'Asus2',frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], baseFret: 1 },
  Fmaj7:{ name: 'Fmaj7',frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], baseFret: 1 },
}

/** MIDI numbers of the sounding strings, low to high. */
export function chordMidiNotes(shape: ChordShape): number[] {
  const out: number[] = []
  shape.frets.forEach((fret, i) => {
    if (fret >= 0) out.push(OPEN_STRINGS[i] + fret)
  })
  return out
}

/** Unique pitch-class names in the chord, for the "notes being played" readout. */
export function chordNoteNames(shape: ChordShape): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const midi of chordMidiNotes(shape)) {
    const name = midiToName(midi)
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

/** Pitch-class set (0-11) for listen-mode matching. */
export function chordPitchClasses(shape: ChordShape): Set<number> {
  return new Set(chordMidiNotes(shape).map((m) => ((m % 12) + 12) % 12))
}

/** One line of ASCII tab for a chord, e.g. "e|--0--" style rows. */
export function chordTabLines(shape: ChordShape): string[] {
  const labels = ['e', 'B', 'G', 'D', 'A', 'E']
  return labels.map((label, row) => {
    const fret = shape.frets[5 - row]
    const cell = fret < 0 ? 'x' : String(fret)
    const pad = cell.length === 1 ? `--${cell}--` : `-${cell}--`
    return `${label}|${pad}|`
  })
}
