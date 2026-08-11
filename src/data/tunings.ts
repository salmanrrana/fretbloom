/** Named tunings, low string → high string, as MIDI note numbers. */
export interface Tuning {
  id: string
  name: string
  midis: number[]
}

export const TUNINGS: Tuning[] = [
  { id: 'standard',   name: 'Standard · E A D G B e',      midis: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d',     name: 'Drop D · D A D G B e',        midis: [38, 45, 50, 55, 59, 64] },
  { id: 'half-down',  name: 'Half step down · Eb Ab Db Gb Bb eb', midis: [39, 44, 49, 54, 58, 63] },
  { id: 'full-down',  name: 'Full step down · D G C F A d', midis: [38, 43, 48, 53, 57, 62] },
  { id: 'dadgad',     name: 'DADGAD · D A D G A d',        midis: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g',     name: 'Open G · D G D G B d',        midis: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d',     name: 'Open D · D A D F# A d',       midis: [38, 45, 50, 54, 57, 62] },
  { id: 'open-e',     name: 'Open E · E B E G# B e',       midis: [40, 47, 52, 56, 59, 64] },
]
