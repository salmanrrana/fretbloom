import { describe, expect, it } from 'vitest'
import {
  editedLyricCues,
  lyricRows,
  notesForLyrics,
  parseLyrics,
  readCaptions,
  type SongLyrics,
} from './lyrics'

const notes = [0.5, 2, 3.5, 5, 8].map((start, i) => ({
  start,
  end: start + 0.5,
  midi: 60 + i,
  confidence: 0.9,
}))
const cues = [
  { start: 2, end: 3, text: 'Morning light' },
  { start: 5, end: 7, text: 'Carry me home' },
]

describe('lyrics with detected notes', () => {
  it('preserves manually repaired timing on unchanged text and plain word edits', () => {
    const saved: SongLyrics = {
      videoId: 'test',
      source: 'pasted',
      language: null,
      automatic: false,
      text: '[00:01]Morning light\nCarry me home',
      cues,
    }
    expect(editedLyricCues(saved.text, 10, saved)).toEqual(cues)
    expect(
      editedLyricCues('[00:01]Morning sun\nCarry me home', 10, saved),
    ).toEqual([{ ...cues[0], text: 'Morning sun' }, cues[1]])
    // Even valid old LRC timestamps must not replace later manual marks.
    saved.text = '[00:01]Morning light\n[00:04]Carry me home'
    expect(editedLyricCues(saved.text, 10, saved)).toEqual(cues)
    expect(editedLyricCues('Morning sun\nCarry me home', 10, saved)).toEqual([
      { ...cues[0], text: 'Morning sun' },
      cues[1],
    ])
    expect(
      editedLyricCues(
        '[00:03]Morning sun\n[00:06]Carry me home',
        10,
        saved,
      )?.map((cue) => cue.start),
    ).toEqual([3, 6])
    expect(
      editedLyricCues('[00:03]Morning sun\nCarry me home', 10, saved),
    ).toBeNull()
    expect(editedLyricCues('Only one line', 10, saved)).toBeNull()
    saved.text = '[00:05]Home\n[00:02]Light'
    saved.cues = parseLyrics(saved.text, 10).cues
    expect(editedLyricCues('[00:05]House\n[00:02]Light', 10, saved)).toEqual([
      { start: 2, end: 5, text: 'Light' },
      { start: 5, end: 10, text: 'House' },
    ])
  })
  it('assigns notes by onset once, including exact line boundaries', () => {
    expect(
      notesForLyrics(
        [
          { start: 0, end: 2, text: 'First' },
          { start: 2, end: 5, text: 'Second' },
        ],
        notes,
      ).map((group) => group.map((note) => note.start)),
    ).toEqual([[0.5], [2, 3.5]])
  })
  it('preserves notes in introductions, breaks and endings', () => {
    const rows = lyricRows(cues, notes, 10)
    expect(rows.map((row) => row.instrumental)).toEqual([
      true,
      false,
      true,
      false,
      true,
    ])
    expect(rows.flatMap((row) => row.notes)).toEqual(notes)
    expect(lyricRows(cues, [], 10)).toHaveLength(2)
  })
  it('uses sorted LRC timestamps, including repeated lines and offsets', () => {
    expect(
      parseLyrics(
        '[ar:Someone]\n[offset:500]\n[00:05.50]Home\n[00:02.50][00:08.50]Light',
        10,
      ).cues,
    ).toEqual([
      { start: 2, end: 5, text: 'Light' },
      { start: 5, end: 8, text: 'Home' },
      { start: 8, end: 10, text: 'Light' },
    ])
  })
  it('never invents timings for plain, mixed, invalid or duplicated timestamps', () => {
    for (const text of [
      'Morning\nLight',
      '[00:02]Morning\nLight',
      '[00:99]No',
      '[00:02]One\n[00:02]Two',
      '[00:10]End',
      '[offset:5000]\n[00:02]Negative',
    ]) {
      expect(parseLyrics(text, 10).cues).toBeNull()
    }
    expect(parseLyrics('[00:02]Morning\nLight', 10).lines).toEqual([
      'Morning',
      'Light',
    ])
  })
  it('treats empty LRC timestamps as lyric clearing points', () => {
    expect(
      parseLyrics('[00:01]First\n[00:03]\n[00:05]Second', 10).cues,
    ).toEqual([
      { start: 1, end: 3, text: 'First' },
      { start: 5, end: 10, text: 'Second' },
    ])
  })
  it('validates remote cues and clips to the analyzed duration', () => {
    expect(
      readCaptions(
        {
          status: 'available',
          language: 'en',
          automatic: true,
          cues: [{ start: 2, end: 12, text: ' Morning ' }],
        },
        10,
      ),
    ).toEqual({
      status: 'available',
      language: 'en',
      automatic: true,
      cues: [{ start: 2, end: 10, text: 'Morning' }],
    })
    for (const bad of [
      null,
      { status: 'available', cues: [{ start: NaN, end: 2, text: 'No' }] },
      {
        status: 'available',
        cues: [
          { start: 0, end: 4, text: 'One' },
          { start: 3, end: 5, text: 'Two' },
        ],
      },
    ])
      expect(readCaptions(bad, 10)).toBeNull()
    expect(readCaptions({ status: 'unavailable', cues: [] }, 10)?.status).toBe(
      'unavailable',
    )
  })
})
