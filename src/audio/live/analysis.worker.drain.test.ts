import { afterEach, expect, it, vi } from 'vitest'
const backend = vi.hoisted(() => ({
  initialize: vi.fn(),
  analyze: vi.fn(),
  close: vi.fn(),
}))
vi.mock('../../generated/analysis-wasm/portable/fretbloom_wasm', () => ({
  ...backend,
  info: () =>
    JSON.stringify({
      bridgeVersion: 2,
      schemaVersion: 1,
      sampleRateHz: 24000,
      maxSamples: 7200000,
      engineVersion: 'test',
    }),
  memoryBytes: () => 65536,
}))
const fence = {
  sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82',
  generation: 9,
  childId: 3,
  requestId: 7,
  throughRequestId: 7,
}
const request = () => ({
  ...fence,
  type: 'analyze',
  purpose: 'refine',
  segmentId: 0,
  startSample: 0,
  pcm: new Float32Array(24000).buffer,
  options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
})
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve()
}
async function worker() {
  vi.resetModules()
  const send = vi.fn()
  const surface = {
    onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
    postMessage: send,
  }
  vi.stubGlobal('self', surface)
  await import('./analysis.worker')
  const post = (data: unknown) =>
    surface.onmessage!(new MessageEvent('message', { data }))
  post({ ...fence, type: 'init' })
  await flush()
  return { post, send }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
it('does not acknowledge cancel receipt, close return or drained backend until the entire payload helper returns', async () => {
  let finish!: () => void
  const drained = new Promise<void>((resolve) => {
    finish = resolve
  })
  let closed!: () => void
  const closing = new Promise<void>((resolve) => {
    closed = resolve
  })
  backend.close.mockImplementation(closed)
  backend.analyze.mockImplementation(async () => {
    await closing
    await drained
    throw new Error('closed')
  })
  const { post, send } = await worker()
  post(request())
  post({ ...fence, childId: 99, type: 'cancel_input' })
  expect(backend.close).not.toHaveBeenCalled()
  post({ ...fence, type: 'cancel_input' })
  post({ ...fence, type: 'cancel_input' })
  await flush()
  expect(backend.close).toHaveBeenCalledOnce()
  expect(send.mock.calls.filter(([v]) => v.type === 'input_released')).toEqual(
    [],
  )
  finish()
  await flush()
  expect(send.mock.calls.filter(([v]) => v.type === 'input_released')).toEqual([
    [{ ...fence, type: 'input_released' }],
  ])
  expect(send.mock.calls.some(([v]) => v.type === 'result')).toBe(false)
})
it.each(['trap', 'close-error', 'initialization'])(
  'does not fabricate proof on %s',
  async (kind) => {
    if (kind === 'initialization')
      backend.initialize.mockRejectedValue(new Error('init'))
    backend.analyze.mockRejectedValue(new Error('trap'))
    if (kind === 'close-error')
      backend.close.mockImplementation(() => {
        throw new Error('close')
      })
    const { post, send } = await worker()
    if (kind !== 'initialization') {
      post(request())
      if (kind === 'close-error') post({ ...fence, type: 'cancel_input' })
    }
    await flush()
    expect(send.mock.calls.some(([v]) => v.type === 'input_released')).toBe(
      false,
    )
  },
)
