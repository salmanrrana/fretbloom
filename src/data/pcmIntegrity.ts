import { number, object, parseHash } from '../audio/analysisV1'

export function parsePcmVerification(value: unknown) {
  const v = object(value)
  if (!(v.pcm instanceof Blob)) throw new Error('Missing saved audio.')
  const byteLength = number(v.byteLength, 4, 28800000, true)
  if (v.pcm.size !== byteLength || byteLength % 4 !== 0)
    throw new Error('Saved audio has a different length.')
  return { pcm: v.pcm, byteLength, sha256: parseHash(v.sha256) }
}
/** Runs only in the verification worker; the immutable PCM Blob is shared, not copied here. */
export async function checkPcmIntegrity(value: unknown): Promise<void> {
  const { pcm, sha256 } = parsePcmVerification(value)
  const bytes = await pcm.arrayBuffer()
  const values = new DataView(bytes)
  for (let i = 0; i < bytes.byteLength; i += 4)
    if (!Number.isFinite(values.getFloat32(i, true)))
      throw new Error('Saved audio contains invalid samples.')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const actual = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (actual !== sha256)
    throw new Error(
      'Saved audio failed its integrity check. Results remain readable; playback and refinement are unavailable.',
    )
}
