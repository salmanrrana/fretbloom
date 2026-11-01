import { expect, test } from 'vitest'
import { AUDIO_ALIGNMENT_VERSION } from './analysisAdapter'
import {
  CURRENT_ANALYSIS_ENGINE,
  supportsAutomaticAlignment,
} from './analysisCompatibility'

test('the generated current engine and original v1 engine support alignment v1', () => {
  expect(CURRENT_ANALYSIS_ENGINE).toBe('rust-dsp-3.1')
  expect(
    supportsAutomaticAlignment(
      CURRENT_ANALYSIS_ENGINE,
      AUDIO_ALIGNMENT_VERSION,
    ),
  ).toBe(true)
  expect(supportsAutomaticAlignment('rust-dsp-1', 1)).toBe(true)
})

test.each([
  'rust-dsp-2',
  'rust-dsp-3',
  'rust-dsp-3.2',
  'rust-dsp-999',
  'other',
  '',
])('refuses unreviewed engine %s', (engine) =>
  expect(supportsAutomaticAlignment(engine, 1)).toBe(false),
)

test.each([0, 2, NaN, Infinity])(
  'refuses unsupported alignment version %s',
  (version) => {
    expect(supportsAutomaticAlignment(CURRENT_ANALYSIS_ENGINE, version)).toBe(
      false,
    )
    expect(supportsAutomaticAlignment('rust-dsp-1', version)).toBe(false)
  },
)
