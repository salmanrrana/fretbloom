import { expect, it } from 'vitest'
import { youtubeVideoId } from './LiveVideo'
it('accepts explicit YouTube IDs and URLs without treating arbitrary URLs as video sources', () => {
  expect(youtubeVideoId('https://youtu.be/abcdefghijk?t=3')).toBe('abcdefghijk')
  expect(youtubeVideoId('https://www.youtube.com/watch?v=abcdefghijk')).toBe(
    'abcdefghijk',
  )
  expect(youtubeVideoId('https://evil.example/watch?v=abcdefghijk')).toBeNull()
  expect(youtubeVideoId('javascript:alert(1)')).toBeNull()
})
