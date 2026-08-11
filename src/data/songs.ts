import type { ChordShape } from './chords'
import { CHORDS } from './chords'

export interface SongStep {
  chord: ChordShape
  /** Duration in beats. */
  beats: number
  strum: 'down' | 'arpeggio'
}

export interface Song {
  id: string
  title: string
  artistVibe: string
  bpm: number
  steps: SongStep[]
  loop: boolean
}

function step(name: keyof typeof CHORDS, beats = 4, strum: SongStep['strum'] = 'down'): SongStep {
  return { chord: CHORDS[name], beats, strum }
}

export const SONGS: Song[] = [
  {
    id: 'garden-drift',
    title: 'Garden Drift',
    artistVibe: 'slow strums · first-chords friendly',
    bpm: 72,
    loop: true,
    steps: [step('G'), step('Cadd9'), step('Em'), step('D')],
  },
  {
    id: 'moth-motel',
    title: 'Moth Motel',
    artistVibe: 'garage swagger · Ohsees energy',
    bpm: 132,
    loop: true,
    steps: [step('E', 2), step('G', 2), step('A', 2), step('G', 2)],
  },
  {
    id: 'let-it-hum',
    title: 'Let It Hum',
    artistVibe: 'four chords · Beatles bones',
    bpm: 96,
    loop: true,
    steps: [step('C'), step('G'), step('Am'), step('F')],
  },
  {
    id: 'pink-summit',
    title: 'Pink Summit',
    artistVibe: 'droning minor · Pink Mountaintops haze',
    bpm: 84,
    loop: true,
    steps: [step('Am'), step('F'), step('C'), step('E')],
  },
  {
    id: 'lid-of-stars',
    title: 'Lid of Stars',
    artistVibe: 'ambient arpeggios · Stars of the Lid patience',
    bpm: 56,
    loop: true,
    steps: [
      step('Fmaj7', 4, 'arpeggio'),
      step('C', 4, 'arpeggio'),
      step('Am', 4, 'arpeggio'),
      step('G', 4, 'arpeggio'),
    ],
  },
  {
    id: 'overworld',
    title: 'Overworld Theme',
    artistVibe: 'bright + bouncy · Kondo spirit',
    bpm: 120,
    loop: true,
    steps: [step('C', 2), step('G', 2), step('Am', 2), step('Em', 2), step('F', 2), step('C', 2), step('Dm', 2), step('G', 2)],
  },
  {
    id: 'twelve-bar-haze',
    title: 'Twelve-Bar Haze',
    artistVibe: 'blues skeleton · everyone starts here',
    bpm: 100,
    loop: true,
    steps: [
      step('A7'), step('A7'), step('A7'), step('A7'),
      step('D7'), step('D7'), step('A7'), step('A7'),
      step('E7'), step('D7'), step('A7'), step('E7'),
    ],
  },
  {
    id: 'hyperballad-dawn',
    title: 'Hyperballad Dawn',
    artistVibe: 'suspended shimmer · Björk sunrise',
    bpm: 88,
    loop: true,
    steps: [step('Asus2', 4, 'arpeggio'), step('Bm', 4, 'arpeggio'), step('G', 4, 'arpeggio'), step('D', 4, 'arpeggio')],
  },
]
