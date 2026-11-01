import { afterEach, it, expect, vi } from 'vitest'
import { createLiveRuntime, parseRuntimeEvent } from './runtime'
import { object } from '../analysisV1'
import { DEFAULT_OPTIONS } from '../analysisV1'
import { parseKey, integer } from './validation'
import type { Key, RuntimeEvent } from './protocol'
class FacadeWorker {
  static workers: FacadeWorker[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  terminated = false
  calls: Record<string, unknown>[] = []
  constructor() {
    FacadeWorker.workers.push(this)
  }
  postMessage(value: unknown) {
    const v = object(value)
    this.calls.push(v)
    if (v.type === 'prepare')
      queueMicrotask(() =>
        this.emit({
          ...parseKey(v),
          type: 'reply',
          requestId: integer(v.requestId),
          ok: true,
          value: null,
        }),
      )
  }
  emit(value: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: value }))
  }
  terminate() {
    this.terminated = true
  }
}
const key: Key = {
  sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82',
  generation: 1,
}
afterEach(() => {
  vi.unstubAllGlobals()
  FacadeWorker.workers = []
})
it('guards stale sessions/revisions and rejects pending operations on dispose', async () => {
  vi.stubGlobal('Worker', FacadeWorker)
  const events: RuntimeEvent[] = [],
    runtime = createLiveRuntime((e) => events.push(e))
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const worker = FacadeWorker.workers[0]
  worker.emit({
    type: 'event',
    event: {
      type: 'ready',
      key: { ...key, generation: 2 },
      engineVersion: 'wrong',
    },
  })
  worker.emit({
    type: 'event',
    event: { type: 'ready', key, engineVersion: 'test' },
  })
  expect(events).toHaveLength(1)
  const refining = runtime.refine(new AbortController().signal)
  runtime.dispose()
  await expect(refining).rejects.toThrow('disposed')
  expect(worker.terminated).toBe(true)
})
it('cancels refinement promptly and sends the engine termination instruction', async () => {
  vi.stubGlobal('Worker', FacadeWorker)
  const runtime = createLiveRuntime(() => {})
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const worker = FacadeWorker.workers[0],
    controller = new AbortController(),
    refining = runtime.refine(controller.signal)
  controller.abort()
  await expect(refining).rejects.toThrow('canceled')
  expect(worker.calls.at(-1)?.type).toBe('cancel_refinement')
  runtime.dispose()
})
it('validates optional counters as present values, retaining missing as unavailable', () => {
  const status = {
    type: 'status',
    key,
    capturedSamples: 0,
    analyzedThroughSample: 0,
    queuedBlocks: 0,
    processingMs: 0,
    wasmBytes: 65536,
  }
  expect(parseRuntimeEvent(status)).toEqual(status)
  expect(() =>
    parseRuntimeEvent({ ...status, ownedJsBytes: Infinity }),
  ).toThrow()
  expect(() => parseRuntimeEvent({ ...status, skippedWindows: 1.5 })).toThrow()
})
it('validates atomic capture position, resume provenance and shared PCM accounting', () => {
  const status = {
    type: 'status',
    key,
    capturedSamples: 60000,
    analyzedThroughSample: 0,
    queuedBlocks: 0,
    processingMs: 0,
    wasmBytes: 65536,
    captureEpoch: 1,
    capturePosition: { segmentId: 1, sample: 60000 },
    ownedJsBytes: 1000000,
    sharedPcmBytes: 240000,
  }
  expect(parseRuntimeEvent(status)).toEqual(status)
  expect(() =>
    parseRuntimeEvent({
      ...status,
      capturePosition: { segmentId: 0, sample: 48000 },
    }),
  ).toThrow('position')
  expect(() => parseRuntimeEvent({ ...status, captureEpoch: -1 })).toThrow()
  expect(() =>
    parseRuntimeEvent({ ...status, sharedPcmBytes: 1000001 }),
  ).toThrow('Shared PCM')
  expect(() => parseRuntimeEvent({ ...status, sharedPcmBytes: 1.5 })).toThrow()
})
it('refreshes included shared Blob accounting immediately on export and disposal', async () => {
  vi.stubGlobal('Worker', FacadeWorker)
  const events: RuntimeEvent[] = [],
    runtime = createLiveRuntime((e) => events.push(e))
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const worker = FacadeWorker.workers[0]
  worker.emit({
    type: 'event',
    event: {
      type: 'status',
      key,
      capturedSamples: 3,
      analyzedThroughSample: 0,
      queuedBlocks: 0,
      processingMs: 0,
      wasmBytes: 65536,
      ownedJsBytes: 100,
    },
  })
  const exported = runtime.exportPcm(new AbortController().signal)
  const request = worker.calls.at(-1)
  worker.emit({
    ...key,
    type: 'reply',
    requestId: request?.requestId,
    ok: true,
    value: { pcm: new Blob([new Float32Array(3)]), pcmSha256: 'a'.repeat(64) },
  })
  await exported
  expect(events.at(-1)).toMatchObject({
    type: 'status',
    ownedJsBytes: 112,
    sharedPcmBytes: 12,
  })
  runtime.dispose()
  expect(events.at(-1)).toMatchObject({ type: 'status', sharedPcmBytes: 0 })
})

it('rejects a canceled refinement and ignores its queued reply and refined event', async () => {
  vi.stubGlobal('Worker', FacadeWorker)
  const events: RuntimeEvent[] = []
  const runtime = createLiveRuntime((e) => events.push(e))
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const worker = FacadeWorker.workers[0]
  const controller = new AbortController()
  const pending = runtime.refine(controller.signal)
  const request = worker.calls.at(-1)!
  controller.abort()
  await expect(pending).rejects.toMatchObject({ code: 'CANCELED' })
  const analysis = {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-3.1',
    options: DEFAULT_OPTIONS,
    durationSamples: 0,
    segments: [],
    results: [],
    completeness: 'refined',
  }
  worker.emit({
    ...key,
    type: 'reply',
    requestId: request.requestId,
    ok: true,
    value: analysis,
  })
  worker.emit({ type: 'event', event: { type: 'refined', key, analysis } })
  expect(events).toEqual([])
  expect(worker.terminated).toBe(false)
  runtime.dispose()
})

it.each(['abort', 'explicit'] as const)(
  'does not adopt a canceled request during a later refinement (%s)',
  async (cancel) => {
    vi.stubGlobal('Worker', FacadeWorker)
    const events: RuntimeEvent[] = []
    const runtime = createLiveRuntime((event) => events.push(event))
    await runtime.prepare(key, DEFAULT_OPTIONS)
    const worker = FacadeWorker.workers[0]
    const controller = new AbortController()
    const original = runtime.refine(controller.signal)
    const originalRequest = worker.calls.at(-1)!
    if (cancel === 'abort') controller.abort()
    else runtime.cancelRefinement()
    await expect(original).rejects.toMatchObject({ code: 'CANCELED' })

    const analysis = {
      schemaVersion: 1,
      engineVersion: 'rust-dsp-3.1',
      options: DEFAULT_OPTIONS,
      durationSamples: 0,
      segments: [],
      results: [],
      completeness: 'refined',
    }
    const oldReply = {
      ...key,
      type: 'reply',
      requestId: originalRequest.requestId,
      ok: true,
      value: analysis,
    }
    const oldEvent = {
      type: 'event',
      event: { type: 'refined', key, analysis },
    }
    const later = runtime.refine(new AbortController().signal)
    const laterRequest = worker.calls.at(-1)!
    const settled = vi.fn()
    void later.then(settled, settled)
    worker.emit(oldEvent)
    worker.emit(oldReply)
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual([])
    expect(settled).not.toHaveBeenCalled()
    expect(worker.terminated).toBe(false)

    const rejected = expect(later).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
    worker.emit({
      ...key,
      type: 'reply',
      requestId: laterRequest.requestId,
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Refinement already requested',
    })
    await rejected

    const freshKey = { ...key, generation: 2 }
    await runtime.prepare(freshKey, DEFAULT_OPTIONS)
    const freshWorker = FacadeWorker.workers.at(-1)!
    const fresh = runtime.refine(new AbortController().signal)
    const freshRequest = freshWorker.calls.at(-1)!
    freshWorker.emit(oldEvent)
    freshWorker.emit(oldReply)
    expect(events).toEqual([])
    const freshReply = {
      ...freshKey,
      type: 'reply',
      requestId: freshRequest.requestId,
      ok: true,
      value: analysis,
    }
    freshWorker.emit(freshReply)
    await expect(fresh).resolves.toMatchObject(analysis)
    expect(events).toEqual([{ type: 'refined', key: freshKey, analysis }])
    freshWorker.emit(freshReply)
    freshWorker.emit({
      type: 'event',
      event: { type: 'refined', key: freshKey, analysis },
    })
    expect(events).toHaveLength(1)
    runtime.dispose()
  },
)

it('rejects malformed refinement replies without announcing completion', async () => {
  vi.stubGlobal('Worker', FacadeWorker)
  const events: RuntimeEvent[] = []
  const runtime = createLiveRuntime((event) => events.push(event))
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const worker = FacadeWorker.workers[0]
  const refining = runtime.refine(new AbortController().signal)
  const request = worker.calls.at(-1)!
  const rejected = expect(refining).rejects.toMatchObject({
    code: 'PROTOCOL_MISMATCH',
  })
  worker.emit({
    ...key,
    type: 'reply',
    requestId: request.requestId,
    ok: true,
    value: {},
  })
  await rejected
  expect(events).toEqual([])
  expect(worker.terminated).toBe(true)
  runtime.dispose()
})
