import type { ChordShape } from '../data/chords'

/** ASCII tab for one chord; fretted cells get the accent color. */
export function TabBlock({ shape }: { shape: ChordShape }) {
  const labels = ['e', 'B', 'G', 'D', 'A', 'E']
  return (
    <pre className="tab-block" aria-label={`${shape.name} tab`}>
      {labels.map((label, row) => {
        const fret = shape.frets[5 - row]
        const cell = fret < 0 ? 'x' : String(fret)
        const lit = fret > 0
        return (
          <span key={label}>
            {label}|--{lit ? <span className="lit">{cell}</span> : cell}
            {cell.length === 1 ? '--' : '-'}|{'\n'}
          </span>
        )
      })}
    </pre>
  )
}
