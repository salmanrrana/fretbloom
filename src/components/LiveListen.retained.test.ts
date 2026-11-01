import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

// Execute the actual caller body, with its surrounding React refs/state injected.
// This seam does not assume a retry API exists in the baseline.
it('retries a canceled attempt without restoring or replacing the retained recording', async () => {
  const source = readFileSync(
    new URL('./LiveListen.tsx', import.meta.url),
    'utf8',
  )
  const body = source.slice(
    source.indexOf('  async function refine('),
    source.indexOf('  async function getPcm('),
  )
  const js = ts.transpile(body, { target: ts.ScriptTarget.ES2023 })
  const first = new AbortController()
  first.abort()
  const snapshot = { completeness: 'partial' }
  const blob = new Blob(['retained'])
  const engine = {
    refine: vi.fn().mockRejectedValue(new Error('canceled')),
    retryRetainedRefinement: vi.fn().mockResolvedValue(snapshot),
    restore: vi.fn(),
    dispose: vi.fn(),
  }
  const attempted = { current: true }
  const operation = { current: first as AbortController | null }
  const key = { current: { sessionId: 'unchanged', generation: 4 } }
  const runtime = { current: engine }
  const pcm = { current: { pcm: blob, pcmSha256: 'same' } }
  const createLiveRuntime = vi.fn(() => engine)
  const getPcm = vi.fn(async () => blob)
  const setSaved = vi.fn()
  const values = {
    player: { current: null },
    runtime,
    analysis: snapshot,
    refineAvailable: true,
    pcm,
    upgradeApproved: { current: false },
    refinementAttempted: attempted,
    retainedRetry: { current: true },
    key,
    operation,
    setError: vi.fn(),
    transition: vi.fn(),
    getPcm,
    current: () => true,
    createLiveRuntime,
    runtimeEvent: vi.fn(),
    sharedPcm: { current: { blob, generation: 4 } },
    setPcmBytes: vi.fn(),
    setRefineAvailable: vi.fn(),
    setAnalysis: vi.fn(),
    setTimeline: vi.fn(),
    timelineFromAnalysis: vi.fn(),
    setSaved,
    captureErrorMessage: String,
    phaseRef: { current: 'captured' },
  }
  const refine = new Function(...Object.keys(values), `${js}; return refine`)(
    ...Object.values(values),
  ) as () => Promise<void>
  await refine()
  expect(createLiveRuntime).not.toHaveBeenCalled()
  expect(engine.restore).not.toHaveBeenCalled()
  expect(getPcm).not.toHaveBeenCalled()
  expect(engine.retryRetainedRefinement).toHaveBeenCalledOnce()
  expect(key.current.generation).toBe(4)
  expect(pcm.current.pcm).toBe(blob)
})

it('restores a fresh runtime after cancellation before refinement was requested', async () => {
  const source = readFileSync(
    new URL('./LiveListen.tsx', import.meta.url),
    'utf8',
  )
  const body = source.slice(
    source.indexOf('  async function refine('),
    source.indexOf('  async function getPcm('),
  )
  const js = ts.transpile(body, { target: ts.ScriptTarget.ES2023 })
  const snapshot = { completeness: 'refined' }
  const blob = new Blob(['retained'])
  const original = { dispose: vi.fn() }
  const canceled = {
    restore: vi.fn(
      (
        _key: unknown,
        _analysis: unknown,
        _pcm: Blob,
        _hash: string,
        signal: AbortSignal,
      ) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new Error('Restore canceled')),
            { once: true },
          )
        }),
    ),
    refine: vi
      .fn()
      .mockRejectedValue(new Error('Listening runtime is unavailable')),
    retryRetainedRefinement: vi
      .fn()
      .mockRejectedValue(new Error('Listening runtime is unavailable')),
    dispose: vi.fn(),
  }
  const recovered = {
    restore: vi.fn().mockResolvedValue(undefined),
    refine: vi.fn().mockResolvedValue(snapshot),
    retryRetainedRefinement: vi.fn(),
    dispose: vi.fn(),
  }
  const createLiveRuntime = vi
    .fn()
    .mockReturnValueOnce(canceled)
    .mockReturnValueOnce(recovered)
  const operation = { current: null as AbortController | null }
  const key = { current: { sessionId: 'unchanged', generation: 4 } }
  const retainedRetry = { current: false }
  const pcm = { current: { pcm: blob, pcmSha256: 'same' } }
  const setAnalysis = vi.fn()
  const setSaved = vi.fn()
  const values = {
    player: { current: null },
    runtime: { current: original },
    analysis: snapshot,
    refineAvailable: true,
    pcm,
    upgradeApproved: { current: false },
    refinementAttempted: { current: true },
    retainedRetry,
    key,
    operation,
    setError: vi.fn(),
    transition: vi.fn(),
    getPcm: vi.fn(async () => blob),
    current: (candidate: typeof key.current) =>
      candidate.generation === key.current.generation,
    createLiveRuntime,
    runtimeEvent: vi.fn(),
    sharedPcm: { current: { blob, generation: 4 } },
    setPcmBytes: vi.fn(),
    setRefineAvailable: vi.fn(),
    setAnalysis,
    setTimeline: vi.fn(),
    timelineFromAnalysis: vi.fn(),
    setSaved,
    captureErrorMessage: String,
    phaseRef: { current: 'refining' },
  }
  const refine = new Function(...Object.keys(values), `${js}; return refine`)(
    ...Object.values(values),
  ) as () => Promise<void>
  const first = refine()
  await vi.waitFor(() => expect(canceled.restore).toHaveBeenCalledOnce())
  operation.current?.abort()
  await first
  expect(canceled.refine).not.toHaveBeenCalled()
  expect(setAnalysis).not.toHaveBeenCalled()
  expect(setSaved).not.toHaveBeenCalled()
  await refine()
  expect(recovered.restore).toHaveBeenCalledOnce()
  expect(recovered.refine).toHaveBeenCalledOnce()
  expect(canceled.retryRetainedRefinement).not.toHaveBeenCalled()
  expect(retainedRetry.current).toBe(false)
  expect(setAnalysis).toHaveBeenCalledExactlyOnceWith(snapshot)
  expect(key.current).toEqual({ sessionId: 'unchanged', generation: 6 })
  expect(pcm.current.pcm).toBe(blob)
})
