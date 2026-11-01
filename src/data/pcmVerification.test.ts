import { afterEach, expect, it, vi } from 'vitest'
import { checkPcmIntegrity } from './pcmIntegrity'
import { verifyPcmInWorker } from './pcmVerification'
import { serializePcmOperation } from './pcmOperations'

class VerificationWorker {
  static instances: VerificationWorker[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  constructor() {
    VerificationWorker.instances.push(this)
  }
  postMessage() {}
  terminate() {
    this.terminated = true
  }
  reply(value: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: value }))
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  VerificationWorker.instances = []
})
const metadata = { byteLength: 12, sha256: 'a'.repeat(64) }
it('validates exact length, finite little-endian samples and SHA256', async () => {
  const bytes = new Float32Array([0, 0.25, -0.25]).buffer
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
  await expect(
    checkPcmIntegrity({ pcm: new Blob([bytes]), byteLength: 12, sha256 }),
  ).resolves.toBeUndefined()
  await expect(
    checkPcmIntegrity({ pcm: new Blob([bytes]), ...metadata }),
  ).rejects.toThrow('integrity')
  await expect(
    checkPcmIntegrity({
      pcm: new Blob([new Float32Array([NaN, 0, 0])]),
      ...metadata,
    }),
  ).rejects.toThrow('invalid samples')
  await expect(
    checkPcmIntegrity({ pcm: new Blob([bytes]), ...metadata, byteLength: 8 }),
  ).rejects.toThrow('length')
})
it('serializes WAV/full-copy work, reserves verification bytes before posting, and terminates every completed worker', async () => {
  vi.stubGlobal('Worker', VerificationWorker)
  let release: (() => void) | undefined
  const wav = serializePcmOperation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  const counts: number[] = []
  const verification = verifyPcmInWorker(
    new Blob([new Float32Array(3)]),
    metadata,
    { onWorkingBytes: (bytes) => counts.push(bytes) },
  )
  await vi.waitFor(() => expect(release).toBeDefined())
  expect(VerificationWorker.instances).toHaveLength(0)
  release?.()
  await wav
  await vi.waitFor(() => expect(VerificationWorker.instances).toHaveLength(1))
  expect(counts).toEqual([44])
  VerificationWorker.instances[0].reply({ ok: true })
  await verification
  expect(counts).toEqual([44, 0])
  expect(VerificationWorker.instances[0].terminated).toBe(true)
})
it.each(['cancel', 'error', 'messageerror', 'invalid', 'timeout'] as const)(
  'cleans up a verification worker on %s and permits another operation',
  async (reason) => {
    vi.stubGlobal('Worker', VerificationWorker)
    if (reason === 'timeout') vi.useFakeTimers()
    const controller = new AbortController()
    const counts: number[] = []
    const operation = verifyPcmInWorker(
      new Blob([new Float32Array(3)]),
      metadata,
      { signal: controller.signal, onWorkingBytes: (b) => counts.push(b) },
    )
    const rejected = expect(operation).rejects.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    const worker = VerificationWorker.instances[0]
    if (reason === 'cancel') controller.abort()
    if (reason === 'error') worker.onerror?.()
    if (reason === 'messageerror') worker.onmessageerror?.()
    if (reason === 'invalid') worker.reply({ ok: 'wrong' })
    if (reason === 'timeout') {
      await vi.advanceTimersByTimeAsync(15000)
    }
    await rejected
    expect(worker.terminated).toBe(true)
    expect(worker.onmessage).toBeNull()
    expect(counts.at(-1)).toBe(0)
    await expect(serializePcmOperation(async () => 42)).resolves.toBe(42)
  },
)
