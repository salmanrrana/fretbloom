/** Serializes application-owned full audio copies (WAV preparation and verification). */
let tail: Promise<unknown> = Promise.resolve()
let pending = 0
export function serializePcmOperation<T>(
  run: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (pending >= 8)
    return Promise.reject(new Error('Too many audio operations.'))
  ++pending
  const operation = tail
    .then(() => {
      signal?.throwIfAborted()
      return run()
    })
    .finally(() => {
      --pending
    })
  tail = operation.catch(() => {})
  return operation
}
