import { expect, test } from 'vitest'
import { INITIAL_MIC_MATCH, nextMicMatch } from './micMatchState'

test.each(['silence', null] as const)(
  'a %s breaks consecutive high frames',
  (gap) => {
    const first = nextMicMatch({ smooth: 0.8, framesAbove: 0 }, 0.8)
    expect(first.framesAbove).toBe(1)
    const interrupted = nextMicMatch(first, gap)
    expect(interrupted.framesAbove).toBe(0)
    const second = nextMicMatch(interrupted, 0.8)
    expect(second.framesAbove).toBe(1)
    expect(nextMicMatch(second, 0.8).framesAbove).toBe(2)
  },
)

test('keeps smoothing, the score threshold and arming unchanged', () => {
  expect(nextMicMatch(INITIAL_MIC_MATCH, 1)).toEqual({
    smooth: 0.5,
    framesAbove: 0,
  })
  expect(
    nextMicMatch({ smooth: 0.8, framesAbove: 1 }, 'silence').smooth,
  ).toBeCloseTo(0.72)
  expect(nextMicMatch({ smooth: 0.8, framesAbove: 1 }, null).smooth).toBe(0.8)
  expect(nextMicMatch({ smooth: 0.58, framesAbove: 1 }, 0.58).framesAbove).toBe(
    0,
  )
  expect(
    nextMicMatch({ smooth: 0.8, framesAbove: 1 }, 0.8, false).framesAbove,
  ).toBe(0)
})
