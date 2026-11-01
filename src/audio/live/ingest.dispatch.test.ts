import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

it.each(['refine', 'retry_retained_refinement'])(
  'rejecting concurrent %s preserves the first request cancellation route',
  async (secondOperation) => {
    const scope = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: vi.fn(),
    }
    vi.stubGlobal('self', scope)
    vi.stubGlobal('document', undefined)
    const { IngestRuntime } = await import('./ingest.worker')
    vi.spyOn(IngestRuntime.prototype, 'prepare').mockResolvedValue()
    let rejectFirst: (reason: Error) => void = () => {
      throw new Error('First request not initialized')
    }
    const first = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject
    })
    vi.spyOn(IngestRuntime.prototype, 'refine')
      .mockImplementationOnce(() => first)
      .mockRejectedValue(new Error('Already running'))
    vi.spyOn(
      IngestRuntime.prototype,
      'retryRetainedRefinement',
    ).mockRejectedValue(new Error('Already running'))
    const cancel = vi
      .spyOn(IngestRuntime.prototype, 'cancelRefinement')
      .mockImplementation(() => {})
    let rejectRetry: ((reason: Error) => void) | undefined
    const key = {
      sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82',
      generation: 1,
    }
    const send = (message: Record<string, unknown>) => {
      scope.onmessage?.(
        new MessageEvent('message', { data: { ...key, ...message } }),
      )
    }
    try {
      send({
        type: 'prepare',
        requestId: 1,
        options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
      })
      await vi.waitFor(() =>
        expect(scope.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 1, ok: true }),
        ),
      )
      send({ type: 'refine', requestId: 2 })
      send({ type: secondOperation, requestId: 3 })
      await vi.waitFor(() =>
        expect(scope.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 3, ok: false }),
        ),
      )
      send({
        type: 'cancel_refinement',
        refinementRequestId: 3,
        cleanupDeadline: Date.now() + 100,
      })
      expect(cancel).not.toHaveBeenCalled()
      send({
        type: 'cancel_refinement',
        refinementRequestId: 2,
        cleanupDeadline: Date.now() + 100,
      })
      expect(cancel).toHaveBeenCalledTimes(1)
      const retry = new Promise<never>((_resolve, reject) => {
        rejectRetry = reject
      })
      vi.mocked(
        IngestRuntime.prototype.retryRetainedRefinement,
      ).mockImplementationOnce(() => retry)
      send({ type: 'retry_retained_refinement', requestId: 4 })
      rejectFirst(new Error('First canceled attempt settled'))
      await vi.waitFor(() =>
        expect(scope.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 2, ok: false }),
        ),
      )
      send({
        type: 'cancel_refinement',
        refinementRequestId: 4,
        cleanupDeadline: Date.now() + 100,
      })
      expect(cancel).toHaveBeenCalledTimes(2)
    } finally {
      rejectFirst(new Error('Test teardown'))
      rejectRetry?.(new Error('Test teardown'))
      await Promise.resolve()
      await Promise.resolve()
    }
  },
)
