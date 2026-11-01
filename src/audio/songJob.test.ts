import { expect, test } from 'vitest'
import {
  parseAnalyzedAudio,
  parseJob,
  parseSeparator,
  verifyFocus,
  analyzedSourceLabel,
} from './songJob'
import { DEFAULT_OPTIONS } from './analysisV1'
const hash = 'a'.repeat(64)
const separator = parseSeparator({
  model: 'htdemucs_6s',
  weightsSha256: 'b'.repeat(64),
  package: 'demucs 4.1.0',
  runtime: 'torch 2.8.0+cpu cpu',
  shifts: 0,
  overlap: 0.25,
})
test('provenance rejects relabeling or a copied full-mix hash', () => {
  expect(() =>
    parseAnalyzedAudio({ kind: 'full_mix', pcmSha256: 'c'.repeat(64) }, hash),
  ).toThrow()
  expect(() =>
    parseAnalyzedAudio(
      { kind: 'guitar_stem', pcmSha256: hash, separator, guitarLevelDb: -12 },
      hash,
    ),
  ).toThrow()
  const analyzedAudio = parseAnalyzedAudio(
    {
      kind: 'guitar_stem',
      pcmSha256: 'c'.repeat(64),
      separator,
      guitarLevelDb: -12,
    },
    hash,
  )
  const result = { focus: 'guitar' as const, analyzedAudio }
  expect(() => verifyFocus(result, 'full_mix', separator)).toThrow()
  expect(() =>
    verifyFocus(result, 'guitar', {
      ...separator,
      weightsSha256: 'd'.repeat(64),
    }),
  ).toThrow()
  expect(() => verifyFocus(result, 'guitar', separator)).not.toThrow()
  expect(analyzedSourceLabel()).toBe('Full mix (earlier analysis)')
})
test('separating stage uses checked v1 job fields', () => {
  const job = parseJob({
    schemaVersion: 1,
    id: '00000000-0000-4000-8000-000000000001',
    source: { kind: 'youtube', videoId: 'abcdefghijk' },
    options: DEFAULT_OPTIONS,
    focus: 'guitar',
    createdAt: '2026-11-01T00:00:00Z',
    expiresAt: '2026-11-01T00:30:00Z',
    status: 'separating',
    progress: { stage: 'Separating guitar', fraction: 0.5 },
    error: null,
  })
  expect(job.status).toBe('separating')
  expect(job.progress.fraction).toBe(0.5)
})
