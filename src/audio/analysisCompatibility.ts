import manifestJson from '../generated/analysis-wasm/manifest.json?raw'
import { AUDIO_ALIGNMENT_VERSION } from './analysisAdapter'
import { object, string } from './analysisV1'

/** Current build identity; compatibility still requires an explicitly reviewed pair below. */
export const CURRENT_ANALYSIS_ENGINE = string(
  object(JSON.parse(manifestJson)).engineVersion,
  100,
)

// V1 results remain readable under their original identity. Never relabel them.
export const SUPPORTED_AUDIO_ALIGNMENTS = [
  { engineVersion: 'rust-dsp-1', alignmentVersion: 1 },
  { engineVersion: 'rust-dsp-3.1', alignmentVersion: 1 },
] as const
export type SupportedAudioAlignment =
  (typeof SUPPORTED_AUDIO_ALIGNMENTS)[number]

/** Engine/version compatibility only; callers must separately verify sheet, source and PCM. */
export function supportsAutomaticAlignment(
  engineVersion: string,
  alignmentVersion: number = AUDIO_ALIGNMENT_VERSION,
): boolean {
  return SUPPORTED_AUDIO_ALIGNMENTS.some(
    (supported) =>
      supported.engineVersion === engineVersion &&
      supported.alignmentVersion === alignmentVersion,
  )
}
