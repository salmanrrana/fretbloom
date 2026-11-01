export interface MicMatchState {
  smooth: number
  framesAbove: number
}

export const INITIAL_MIC_MATCH: Readonly<MicMatchState> = {
  smooth: 0,
  framesAbove: 0,
}

/** Missing frames break a streak; silence also decays the displayed score. */
export function nextMicMatch(
  previous: Readonly<MicMatchState>,
  observation: number | 'silence' | null,
  armed = true,
): MicMatchState {
  if (observation === null) return { ...previous, framesAbove: 0 }
  if (observation === 'silence')
    return { smooth: previous.smooth * 0.9, framesAbove: 0 }
  const smooth = previous.smooth * 0.5 + observation * 0.5
  return {
    smooth,
    framesAbove: armed && smooth > 0.58 ? previous.framesAbove + 1 : 0,
  }
}
