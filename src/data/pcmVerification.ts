import { parsePcmVerification } from './pcmIntegrity'
import { serializePcmOperation } from './pcmOperations'

export type PcmIntegrity = { byteLength: number; sha256: string }
export type PcmVerificationOptions = {
  signal?: AbortSignal
  onWorkingBytes?: (bytes: number) => void
}
export async function verifyPcmInWorker(
  pcm: Blob,
  metadata: PcmIntegrity,
  options: PcmVerificationOptions = {},
): Promise<void> {
  const request = parsePcmVerification({ pcm, ...metadata })
  return serializePcmOperation(
    () =>
      new Promise<void>((resolve, reject) => {
        let worker: Worker | undefined
        let settled = false
        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          options.signal?.removeEventListener('abort', abort)
          if (worker) {
            worker.onmessage = null
            worker.onerror = null
            worker.onmessageerror = null
            worker.terminate()
          }
          options.onWorkingBytes?.(0)
          if (error) reject(error)
          else resolve()
        }
        const abort = () =>
          finish(new DOMException('Audio verification canceled.', 'AbortError'))
        const timer = setTimeout(
          () =>
            finish(
              new Error('Audio verification timed out. Try saving again.'),
            ),
          15000,
        )
        options.signal?.addEventListener('abort', abort, { once: true })
        try {
          worker = new Worker(
            new URL('./pcmVerification.worker.ts', import.meta.url),
            { type: 'module' },
          )
          // Reserve the full read buffer and digest output BEFORE asking the worker to allocate.
          options.onWorkingBytes?.(pcm.size + 32)
          worker.onmessage = (event: MessageEvent<unknown>) => {
            const v = event.data
            if (v && typeof v === 'object' && 'ok' in v && v.ok === true)
              finish()
            else if (
              v &&
              typeof v === 'object' &&
              'ok' in v &&
              v.ok === false &&
              'message' in v &&
              typeof v.message === 'string' &&
              v.message.length <= 1000
            )
              finish(new Error(v.message))
            else finish(new Error('Invalid audio verification reply.'))
          }
          worker.onerror = () =>
            finish(new Error('Audio verification worker failed.'))
          worker.onmessageerror = () =>
            finish(new Error('Audio verification transport failed.'))
          worker.postMessage(request)
        } catch (error) {
          finish(
            error instanceof Error
              ? error
              : new Error('Audio verification could not start.'),
          )
        }
      }),
    options.signal,
  )
}
