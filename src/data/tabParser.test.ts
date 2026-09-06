import { describe, expect, test } from 'vitest'

import { parseTab, youtubeId } from './tabParser'

describe('parseTab', () => {
  test('keeps section context across chord lines and inline chords', () => {
    const parsed = parseTab('[Verse 1]\nG  Cadd9\nHello [D/F#]world')

    expect(parsed.steps.map((step) => step.chord.symbol)).toEqual([
      'G',
      'Cadd9',
      'D/F#',
    ])
    expect(parsed.steps.every((step) => step.section === 'Verse')).toBe(true)
    expect(parsed.unknown).toEqual([])
  })
})

describe('youtubeId', () => {
  test.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=2', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts %s', (input, expected) => {
    expect(youtubeId(input)).toBe(expected)
  })

  test('rejects unrelated URLs', () => {
    expect(youtubeId('https://example.com/video')).toBeNull()
  })
})
