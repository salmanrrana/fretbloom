import type { ChordShape } from '../data/chords'

interface Props {
  shape: ChordShape
  /** Accent for the dots (defaults to ember). */
  accent?: string
  width?: number
}

/**
 * A classic chord box: strings vertical (low E left), 5 frets tall,
 * finger dots with finger numbers, x/o markers above the nut.
 */
export function ChordDiagram({ shape, accent = 'var(--ember)', width = 150 }: Props) {
  const cols = 6
  const rows = 5
  const pad = 22
  const w = 120
  const h = 132
  const colGap = w / (cols - 1)
  const rowGap = h / rows
  const height = (width * (h + pad + 26)) / (w + 30)

  const strings = Array.from({ length: cols }, (_, i) => pad / 2 + 4 + i * colGap)
  const fretY = (row: number) => 26 + row * rowGap

  return (
    <svg
      className="diagram"
      viewBox={`0 0 ${w + 30} ${h + pad + 26}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${shape.name} chord diagram`}
    >
      {/* nut or base fret marker */}
      {shape.baseFret === 1 ? (
        <rect x={strings[0]} y={22} width={w} height={5} rx={2} fill="var(--moth)" />
      ) : (
        <text x={strings[0] - 10} y={fretY(0) + rowGap / 2 + 4} fontSize="11" fill="var(--faded)" fontFamily="var(--font-mono)" textAnchor="end">
          {shape.baseFret}
        </text>
      )}

      {/* frets */}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line key={r} x1={strings[0]} y1={fretY(r)} x2={strings[cols - 1]} y2={fretY(r)} stroke="var(--veil)" strokeWidth={1.4} />
      ))}

      {/* strings */}
      {strings.map((x, i) => (
        <line key={i} x1={x} y1={26} x2={x} y2={fretY(rows)} stroke="var(--faded)" strokeWidth={i === 0 ? 1.8 : 1.1} opacity={0.75} />
      ))}

      {/* markers + dots */}
      {shape.frets.map((fret, i) => {
        const x = strings[i]
        if (fret < 0) {
          return (
            <text key={i} x={x} y={16} fontSize="12" fill="var(--faded)" textAnchor="middle" fontFamily="var(--font-mono)">
              ×
            </text>
          )
        }
        if (fret === 0) {
          return <circle key={i} cx={x} cy={11} r={4.5} fill="none" stroke="var(--faded)" strokeWidth={1.4} />
        }
        const row = fret - shape.baseFret
        const cy = fretY(row) + rowGap / 2
        return (
          <g key={i}>
            <circle cx={x} cy={cy} r={8.5} fill={accent} />
            {shape.fingers[i] > 0 && (
              <text x={x} y={cy + 3.5} fontSize="10" fill="var(--night)" textAnchor="middle" fontWeight="700" fontFamily="var(--font-mono)">
                {shape.fingers[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
