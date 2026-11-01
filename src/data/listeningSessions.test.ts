import { checkPcmIntegrity } from './pcmIntegrity'
import { expect, it } from 'vitest'
import {
  exportListeningJson,
  parseSavedListeningSession,
} from './listeningSessions'
import type { SavedListeningSession } from './listeningSessions'

export function sessionFixture(): SavedListeningSession {
  return {
    schemaVersion: 1,
    id: '35e8c4cf-27f6-4ada-b570-d4cba025f799',
    title: 'A local passage',
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    source: 'tab',
    anchors: [],
    captureWarnings: [],
    pcm: null,
    analysis: {
      schemaVersion: 1,
      engineVersion: 'saved-engine',
      options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
      durationSamples: 24000,
      segments: [
        {
          id: 0,
          startSample: 0,
          endSample: 24000,
          sourceRateHz: 48000,
          channel: 'mean',
          precedingGap: null,
        },
      ],
      results: [],
      completeness: 'partial',
      missedLiveIntervals: [{ segmentId: 0, startSample: 0, endSample: 24000 }],
    },
  }
}
it('preserves recorded engine identity and missed-live metadata in bounded JSON without embedded audio', async () => {
  const fixture = sessionFixture()
  const parsed = parseSavedListeningSession(fixture)
  expect(parsed.analysis.engineVersion).toBe('saved-engine')
  const json: unknown = JSON.parse(await exportListeningJson(parsed).text())
  expect(parseSavedListeningSession(json)).toEqual(fixture)
})
it('rejects malformed metadata, audio association, impossible anchors, and oversized result exports', () => {
  const fixture = sessionFixture()
  expect(() =>
    parseSavedListeningSession({ ...fixture, source: 'songbook' }),
  ).toThrow()
  expect(() =>
    parseSavedListeningSession({
      ...fixture,
      pcm: {
        sha256: 'a'.repeat(64),
        byteLength: 4,
        sampleRateHz: 24000,
        format: 'f32le',
      },
    }),
  ).toThrow('length')
  expect(() =>
    parseSavedListeningSession({
      ...fixture,
      anchors: [
        {
          videoId: 'abcdefghijk',
          segmentId: 1,
          captureSample: 0,
          videoSeconds: 0,
          rate: 1,
          status: 'approximate',
          userConfirmed: true,
        },
      ],
    }),
  ).toThrow('segment')
  expect(() =>
    parseSavedListeningSession({ ...fixture, title: 'x'.repeat(201) }),
  ).toThrow()
})
it('checks audio content instead of trusting the stored filename or length', async () => {
  const bytes = new Float32Array([0, 0.25, -0.25]).buffer
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
  await expect(
    checkPcmIntegrity({
      pcm: new Blob([bytes]),
      byteLength: 12,
      sha256: hash,
      format: 'f32le',
      sampleRateHz: 24000,
    }),
  ).resolves.toBeUndefined()
  await expect(
    checkPcmIntegrity({
      pcm: new Blob([new Float32Array([0, 0.5, -0.25])]),
      byteLength: 12,
      sha256: hash,
      format: 'f32le',
      sampleRateHz: 24000,
    }),
  ).rejects.toThrow('integrity')
})
