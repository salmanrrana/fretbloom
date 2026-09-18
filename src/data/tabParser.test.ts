import { describe, expect, test } from 'vitest'

import { midiToName } from '../audio/notes'
import { parseTab, stepMidiNotes, youtubeId } from './tabParser'

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

describe('numbered guitar tabs', () => {
  const staff = (top: string, second = '-----------') =>
    `e|${top}|\nB|${second}|\nG|-----------|\nD|-----------|\nA|-----------|\nE|-----------|`

  test('reads frets in order and preserves clickable staff positions', () => {
    const parsed = parseTab(staff('--0--3--12-'))
    expect(parsed.steps.map((step) => step.midis)).toEqual([[64], [67], [76]])
    expect(parsed.steps.map((step) => step.chord.symbol)).toEqual([
      'E4',
      'G4',
      'E5',
    ])
    expect(
      parsed.lines[0].segments
        .filter((segment) => segment.kind === 'chord')
        .map((segment) => segment.step),
    ).toEqual([0, 1, 2])
    expect(parsed.warnings).toEqual([])
  })

  test('keeps repeat counts and trailing comments out of playable frets', () => {
    for (const annotation of [
      ' x2',
      ' repeat 3 times',
      ' (4 times)',
      ' hold for 2 bars',
    ]) {
      const parsed = parseTab(staff('--0--|--3--') + annotation)
      expect(parsed.steps.map((step) => step.midis)).toEqual([[64], [67]])
      expect(parsed.lines[5].segments.at(-1)?.text).toContain(annotation)
    }
    const unclosed = parseTab(staff('--0--|--3--').replace('--3--|', '--3--'))
    expect(unclosed.steps.map((step) => step.midis)).toEqual([[64], [67]])
  })

  test('combines simultaneous string notes and applies capo', () => {
    const parsed = parseTab(`Capo: 2\n${staff('--0--3-----', '--1--------')}`)
    expect(parsed.steps.map((step) => step.midis)).toEqual([[62, 66], [69]])
  })

  test('does not double-count chord annotations above a staff', () => {
    const parsed = parseTab(`G C\n${staff('--0--3-----')}`)
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.warnings.join(' ')).toContain('annotations')
  })

  test('rejects incomplete and nonstandard staff blocks with an explanation', () => {
    expect(parseTab('e|--0--|\nB|-----|').steps).toHaveLength(0)
    expect(parseTab('e|--0--|\nB|-----|').warnings.join(' ')).toContain(
      'all six strings',
    )
    expect(
      parseTab(staff('--0-------').replace('E|', 'D|')).steps,
    ).toHaveLength(0)
  })

  test('preserves multiple blocks and technique pitches without inventing timing', () => {
    const parsed = parseTab(
      `[Verse]\n${staff('--0h2------')}\n\n[Chorus]\n${staff('--3--------')}`,
    )
    expect(parsed.steps.map((step) => step.midis)).toEqual([[64], [66], [67]])
    expect(parsed.steps[2].section).toBe('Chorus')
    expect(parsed.warnings.join(' ')).toContain('not interpreted')
  })

  test('applies capo to chord targets as well', () => {
    const parsed = parseTab('Capo: 2\nC G')
    expect(parsed.steps[0].midis).toEqual([50, 54, 57, 62, 66])
  })
})

test('keeps chord-only verses after a numbered intro', () => {
  const parsed = parseTab(
    '[Intro]\ne|--0--|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|\n[Verse]\nC G\nSinging the verse',
  )
  expect(parsed.steps.map((step) => step.chord.symbol)).toEqual([
    'E4',
    'C',
    'G',
  ])
})

test('does not treat lyric words as chord extensions', () => {
  expect(parseTab('Goodbye\nAmazing\nDreaming').steps).toHaveLength(0)
  expect(parseTab('Cmaj7 F#m7 Bbadd9 D/F#').steps).toHaveLength(4)
})

test('drops page markers and reads every section header style', () => {
  const parsed = parseTab(
    '[Intro]\nC\nPage 1/2\n[Verse 2]\nG\nChorus:\nAm\nPage 2 of 3',
  )
  expect(parsed.lines.map((line) => line.kind)).toEqual([
    'section',
    'chords',
    'blank',
    'section',
    'chords',
    'section',
    'chords',
    'blank',
  ])
  expect(parsed.steps.map((step) => step.section)).toEqual([
    'Intro',
    'Verse',
    'Chorus',
  ])
})

// CCR "Have You Ever Seen The Rain", as pasted from a PDF export.
const CCR_SHEET = `[Intro]

Am    F/C    C    G    C


[Verse]

C
Someone told me long ago
C                                   G
There's a calm before the storm, I know
                   C
It's been coming for some time

C
When it's over, so they say
C                          G
It'll rain a sunny day, I know
                   C
Shining down like water


[Chorus]

F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F        G               C
Coming down on a sunny day


[Verse]

C
Yesterday and days before
C                                G
Sun is cold and rain is hard, I know
Page 1/2
                    C
Been that way for all my time

C
'Til forever on it goes
C                                    G
Through the circle fast and slow, I know
                   C
It can't stop, I wonder


[Chorus]

F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F        G                C
Coming down on a sunny day


[Chorus]

F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F         G
I wanna know
         C    C/B      Am    Am7/G
Have you ever seen the rain
F        G                C     G    C
Coming down on a sunny day
`

test('parses a real sheet: every chord kept verbatim, slash chords sound their bass', () => {
  const parsed = parseTab(CCR_SHEET)
  expect(parsed.steps).toHaveLength(68)
  expect(parsed.unknown).toEqual([])
  expect(new Set(parsed.steps.map((step) => step.chord.symbol))).toEqual(
    new Set(['Am', 'F/C', 'C', 'G', 'F', 'C/B', 'Am7/G']),
  )

  const notes = (symbol: string) => {
    const step = parsed.steps.find((step) => step.chord.symbol === symbol)
    return step && new Set(stepMidiNotes(step).map(midiToName))
  }
  expect(notes('C')).toEqual(new Set(['C', 'E', 'G']))
  expect(notes('C/B')).toEqual(new Set(['B', 'C', 'E', 'G']))
  expect(notes('Am')).toEqual(new Set(['A', 'C', 'E']))
  expect(notes('Am7/G')).toEqual(new Set(['G', 'A', 'C', 'E']))
  expect(notes('F/C')).toEqual(new Set(['F', 'A', 'C']))
  expect(notes('G')).toEqual(new Set(['G', 'B', 'D']))
})

test('YouTube import accepts known hosts and rejects lookalikes or malformed IDs', () => {
  expect(youtubeId('https://evilyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  expect(
    youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQextra'),
  ).toBeNull()
  expect(
    youtubeId('https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ'),
  ).toBeNull()
  expect(youtubeId('youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ')
  expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
    'dQw4w9WgXcQ',
  )
})
