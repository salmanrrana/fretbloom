/** Named tunings in physical string order, as MIDI note numbers. */
export interface Tuning {
  id: string
  instrument: 'guitar' | 'ukulele'
  name: string
  midis: number[]
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', instrument: 'guitar', name: 'Standard · E A D G B e', midis: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', instrument: 'guitar', name: 'Drop D · D A D G B e', midis: [38, 45, 50, 55, 59, 64] },
  { id: 'half-down', instrument: 'guitar', name: 'Half step down · Eb Ab Db Gb Bb eb', midis: [39, 44, 49, 54, 58, 63] },
  { id: 'full-down', instrument: 'guitar', name: 'Full step down · D G C F A d', midis: [38, 43, 48, 53, 57, 62] },
  { id: 'dadgad', instrument: 'guitar', name: 'DADGAD · D A D G A d', midis: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', instrument: 'guitar', name: 'Open G · D G D G B d', midis: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', instrument: 'guitar', name: 'Open D · D A D F# A d', midis: [38, 45, 50, 54, 57, 62] },
  { id: 'open-e', instrument: 'guitar', name: 'Open E · E B E G# B e', midis: [40, 47, 52, 56, 59, 64] },
  { id: 'ukulele-standard', instrument: 'ukulele', name: 'Standard · g C E A', midis: [67, 60, 64, 69] },
  { id: 'ukulele-low-g', instrument: 'ukulele', name: 'Low G · G C E A', midis: [55, 60, 64, 69] },
  { id: 'ukulele-d-tuning', instrument: 'ukulele', name: 'D tuning · a D F# B', midis: [69, 62, 66, 71] },
  { id: 'ukulele-baritone', instrument: 'ukulele', name: 'Baritone · D G B E', midis: [50, 55, 59, 64] },
]

export const TUNING_GROUPS = [
  { instrument: 'guitar', label: 'Guitar' },
  { instrument: 'ukulele', label: 'Ukulele' },
] as const
