import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { chordAt } from '../data/songSync'
import { ChordRunway } from './ChordRunway'

const runs = [
  { label: 'C', start: 0, end: 5 },
  { label: 'G', start: 5, end: 10 },
]
function markup(at: number, highlighted = true) {
  return renderToStaticMarkup(
    <ChordRunway
      runs={runs}
      sections={[]}
      at={at}
      unit="seconds"
      highlighted={highlighted}
      clock={{
        time: () => at,
        isPlaying: () => false,
        playing: false,
        seek() {},
        play() {},
        pause() {},
        setRate() {},
      }}
    />,
  )
}

test('a paused boundary seek highlights the same chord as the sheet', () => {
  const at = 4.9999997
  expect(chordAt(runs, at)?.label).toBe('G')
  expect(markup(at)).toMatch(/class="runway-chord now"[^>]*>G<\/span>/)
  expect(markup(at)).not.toMatch(/class="runway-chord now"[^>]*>C<\/span>/)
})

test('selected or unresolved evidence never highlights the runway', () => {
  expect(markup(6, false)).not.toContain('runway-chord now')
  expect(markup(10)).not.toContain('runway-chord now')
})
