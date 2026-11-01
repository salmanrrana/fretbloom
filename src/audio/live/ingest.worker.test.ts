import { describe, it, expect, vi } from 'vitest'
import { IngestRuntime, Recording } from './ingest.worker'
import { DEFAULT_OPTIONS } from '../analysisV1'
import type { EngineRequest, RuntimeEvent } from './protocol'
import { object } from '../analysisV1'
import { parseEngineRequest } from './validation'
import { parseRuntimeEvent } from './runtime'
const key = { sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82', generation: 1 }
class EngineStub {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  requests: EngineRequest[] = []
  respond = true
  autoRelease = true
  childId = 0
  postMessage(value: unknown, transfer: Transferable[] = []) {
    const v = object(structuredClone(value, { transfer }))
    if (v.type === 'init') this.childId = Number(v.childId)
    if (v.type === 'cancel_input') {
      if (this.autoRelease) this.release(this.requests.at(-1)!)
      return
    }
    if (v.type === 'init')
      queueMicrotask(() =>
        this.onmessage?.(
          new MessageEvent('message', {
            data: {
              ...key,
              generation: v.generation,
              type: 'engine_ready',
              childId: this.childId,
              engineVersion: 'test',
              wasmBytes: 65536,
            },
          }),
        ),
      )
    else this.requests.push(parseEngineRequest(v))
  }
  reply(request: EngineRequest) {
    const duration = request.pcm.byteLength / 4 / 24000
    this.onmessage?.(
      new MessageEvent('message', {
        data: {
          ...key,
          generation: request.generation,
          type: 'result',
          childId: this.childId,
          throughRequestId: request.requestId,
          requestId: request.requestId,
          computeMs: 1,
          wasmBytes: 65536,
          result: {
            schemaVersion: 1,
            engineVersion: 'test',
            options: request.options,
            duration,
            sampleRateHz: 24000,
            timingResolutionSeconds: 0.02,
            tuning: {
              referenceHz: request.options.concertAHz,
              estimatedOffsetCents: null,
            },
            harmony: [
              {
                start: 0,
                end: duration,
                bass: null,
                kind: 'no_chord',
                reason: 'silence',
              },
            ],
            monophonicNotes: [],
            polyphonicNotes: [],
            warnings: [],
          },
          features: {
            schemaVersion: 1,
            engineVersion: 'test',
            duration,
            hopSeconds: 0.08,
            frames: [],
          },
        },
      }),
    )
    if (this.autoRelease) this.release(request)
  }
  release(request: EngineRequest, fields: Record<string, unknown> = {}) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: {
          ...key,
          generation: request.generation,
          childId: this.childId,
          requestId: request.requestId,
          throughRequestId: request.requestId,
          type: 'input_released',
          ...fields,
        },
      }),
    )
  }

  terminate() {
    this.terminated = true
  }
}
// Scheduler tests use a deliberately blocked engine, not a detector/music-accuracy substitute.
function setup() {
  const engine = new EngineStub(),
    events: RuntimeEvent[] = []
  const runtime = new IngestRuntime(
    (value) => {
      const v = object(value)
      if (v.type === 'event') events.push(parseRuntimeEvent(v.event))
    },
    () => engine,
  )
  return { engine, events, runtime }
}
function capture(runtime: IngestRuntime) {
  const channel = new MessageChannel()
  runtime.attach(channel.port1, 'mean')
  let sequence = 0,
    frame = 0
  return {
    port: channel.port2,
    pcm(n: number, skip = 0) {
      frame += skip
      const input = new Float32Array(n)
      for (let i = 0; i < n; i++)
        input[i] = 0.3 * Math.sin((2 * Math.PI * 440 * (frame + i)) / 24000)
      channel.port2.postMessage(
        {
          ...key,
          type: 'pcm',
          sequence: sequence++,
          firstFrame: frame,
          frameCount: n,
          sampleRateHz: 24000,
          channels: 1,
          interleaved: input.buffer,
        },
        [input.buffer],
      )
      frame += n
    },
    boundary(action: 'pause' | 'resume') {
      channel.port2.postMessage({
        ...key,
        type: 'boundary',
        sequence: sequence++,
        frame,
        action,
        reason: 'paused',
      })
    },
    end() {
      channel.port2.postMessage({
        ...key,
        type: 'boundary',
        sequence: sequence++,
        frame,
        action: 'end',
        reason: 'user_stop',
      })
    },
  }
}
async function turn() {
  await new Promise((resolve) => setTimeout(resolve, 15))
}
describe('bounded ingestion scheduler', () => {
  it('records across chunk boundaries with a fixed ring', () => {
    const r = new Recording(),
      pcm = Float32Array.from({ length: 250000 }, (_, i) => i / 250000)
    r.append(pcm.subarray(0, 1000))
    r.append(pcm.subarray(1000))
    expect(r.copy(999, 20000)).toEqual(pcm.slice(999, 20000))
    expect(r.ring.length).toBe(245760)
    expect(() => r.copy(0, 250001)).toThrow()
  })
  it('rejects an engine deadline, retains partial PCM and bounds one-running/one-pending', async () => {
    const { engine, events, runtime } = setup()
    await runtime.prepare(key, DEFAULT_OPTIONS)
    const source = capture(runtime)
    for (let i = 0; i < 48; i++) source.pcm(2048)
    await turn()
    expect(engine.requests.length).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 5100))
    const stopped = await runtime.stop()
    expect(stopped.completeness).toBe('partial')
    expect(stopped.durationSamples).toBeGreaterThan(0)
    expect(engine.terminated).toBe(true)
    expect(
      events.some((e) => e.type === 'error' && e.code === 'ANALYSIS_TOO_SLOW'),
    ).toBe(true)
    expect((await runtime.exportPcm()).pcm.size).toBe(
      stopped.durationSamples * 4,
    )
    runtime.dispose()
    source.port.close()
  }, 10000)
  it('acknowledges end only after copying PCM and abstains on short fragments', async () => {
    const { engine, runtime } = setup()
    await runtime.prepare(key, DEFAULT_OPTIONS)
    const source = capture(runtime),
      acks: unknown[] = []
    source.port.onmessage = (e) => acks.push(e.data)
    source.pcm(2048)
    source.end()
    await turn()
    const stopped = await runtime.stop()
    expect(stopped.durationSamples).toBe(2048)
    expect(stopped.results).toEqual([])
    expect(engine.requests).toEqual([])
    expect(acks.some((v) => object(v).type === 'boundary_ack')).toBe(true)
    runtime.dispose()
    source.port.close()
  })
  it('opens an explicit gap from the source clock instead of inserting silence', async () => {
    const { runtime } = setup()
    await runtime.prepare(key, DEFAULT_OPTIONS)
    const source = capture(runtime)
    source.pcm(2048)
    source.pcm(2048, 1000)
    source.end()
    await turn()
    const stopped = await runtime.stop()
    expect(stopped.durationSamples).toBe(4096)
    expect(stopped.segments).toHaveLength(2)
    expect(stopped.segments[1].precedingGap?.reason).toBe('transport_overflow')
    runtime.dispose()
    source.port.close()
  })
})

it('verifies PCM before explicit engine upgrades; cancellation preserves the old snapshot', async () => {
  const { runtime, engine } = setup()
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const samples = new Float32Array(24000),
    pcm = new Blob([samples.buffer]),
    digest = await crypto.subtle.digest('SHA-256', samples.buffer),
    sha = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  const saved = {
    schemaVersion: 1 as const,
    engineVersion: 'old-engine',
    options: DEFAULT_OPTIONS,
    durationSamples: 24000,
    segments: [
      {
        id: 0,
        startSample: 0,
        endSample: 24000,
        sourceRateHz: 24000,
        channel: 'mean' as const,
        precedingGap: null,
      },
    ],
    results: [],
    completeness: 'partial' as const,
  }
  await expect(runtime.restore(saved, pcm, sha)).rejects.toThrow('differs')
  await expect(
    runtime.restore(saved, pcm, '0'.repeat(64), true),
  ).rejects.toThrow('hash')
  await runtime.restore(saved, pcm, sha, true)
  const refining = runtime.refine()
  await turn()
  runtime.cancelRefinement()
  await expect(refining).rejects.toThrow('canceled')
  expect(engine.terminated).toBe(true)
  expect((await runtime.stop()).engineVersion).toBe('old-engine')
  expect((await runtime.exportPcm()).pcmSha256).toBe(sha)
  runtime.dispose()
})
it('replaces the old engine/results atomically only after a successful explicit reanalysis', async () => {
  const { runtime, engine } = setup()
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const samples = new Float32Array(24000),
    pcm = new Blob([samples.buffer]),
    digest = await crypto.subtle.digest('SHA-256', samples.buffer),
    sha = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  const saved = {
    schemaVersion: 1 as const,
    engineVersion: 'old-engine',
    options: DEFAULT_OPTIONS,
    durationSamples: 24000,
    segments: [
      {
        id: 0,
        startSample: 0,
        endSample: 24000,
        sourceRateHz: 24000,
        channel: 'mean' as const,
        precedingGap: null,
      },
    ],
    results: [],
    completeness: 'partial' as const,
  }
  await runtime.restore(saved, pcm, sha, true)
  const refining = runtime.refine()
  await turn()
  engine.reply(engine.requests[0])
  const result = await refining
  expect(result.engineVersion).toBe('test')
  expect(result.completeness).toBe('refined')
  expect(result.results).toHaveLength(1)
  expect(saved.engineVersion).toBe('old-engine')
  runtime.dispose()
})

it('enforces the segment and PCM caps without silently truncating metadata', async () => {
  const recording = new Recording()
  recording.append(new Float32Array(7200000))
  expect(() => recording.append(new Float32Array(1))).toThrow('limit')
  recording.release()
  expect(recording.ownedBytes).toBe(0)
  const { runtime, events } = setup()
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const source = capture(runtime)
  for (let i = 0; i < 65; i++) {
    source.pcm(128)
    source.boundary('pause')
    source.boundary('resume')
  }
  await turn()
  const stopped = await runtime.stop()
  expect(stopped.segments).toHaveLength(64)
  expect(stopped.completeness).toBe('partial')
  expect(
    events.some((e) => e.type === 'error' && e.code === 'LIMIT_EXCEEDED'),
  ).toBe(true)
  runtime.dispose()
  source.port.close()
})
it('anchors resumed short capture from ingest state before any new patch, independent of late prior-segment analysis', async () => {
  const { runtime, engine, events } = setup()
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const source = capture(runtime)
  try {
    for (let i = 0; i < 16; i++) source.pcm(2048)
    await turn()
    const oldRequest = engine.requests[0]
    expect(oldRequest).toBeDefined()
    source.boundary('pause')
    source.boundary('resume')
    source.pcm(2048)
    await new Promise((resolve) => setTimeout(resolve, 530))
    const status = events.filter((e) => e.type === 'status').at(-1)
    expect(status).toMatchObject({
      captureEpoch: 1,
      capturePosition: { segmentId: 1 },
    })
    if (status?.type !== 'status') throw new Error('Missing status')
    expect(status.capturePosition?.sample).toBe(status.capturedSamples)
    expect(
      events.some((e) => e.type === 'timeline' && e.patch.segmentId === 1),
    ).toBe(false)
    engine.reply(oldRequest)
    await turn()
    source.end()
    await turn()
    // Any queued final prior-segment analysis can complete independently.
    for (const request of engine.requests.slice(1)) engine.reply(request)
    const stopped = await runtime.stop()
    expect(
      stopped.segments[1].endSample - stopped.segments[1].startSample,
    ).toBe(2048)
    expect(stopped.results.some((r) => r.segmentId === 1)).toBe(false)
    expect(events.filter((e) => e.type === 'status').at(-1)).not.toHaveProperty(
      'capturePosition',
    )
  } finally {
    runtime.dispose()
    source.port.close()
  }
})
it('keeps segment 0 usable after pause/resume before any PCM, using a new resume epoch', async () => {
  const { runtime, events } = setup()
  await runtime.prepare(key, DEFAULT_OPTIONS)
  const source = capture(runtime)
  try {
    source.boundary('pause')
    source.boundary('resume')
    for (let i = 0; i < 6; i++) source.pcm(2048)
    await new Promise((resolve) => setTimeout(resolve, 530))
    expect(events.filter((e) => e.type === 'status').at(-1)).toMatchObject({
      captureEpoch: 1,
      capturePosition: { segmentId: 0 },
    })
    source.end()
    await turn()
    expect((await runtime.stop()).segments).toHaveLength(1)
  } finally {
    runtime.dispose()
    source.port.close()
  }
})

async function restored() {
  const context = setup()
  await context.runtime.prepare(key, DEFAULT_OPTIONS)
  const samples = new Float32Array(24000)
  const pcm = new Blob([samples.buffer])
  const sha = Buffer.from(
    await crypto.subtle.digest('SHA-256', samples.buffer),
  ).toString('hex')
  const saved = {
    schemaVersion: 1 as const,
    engineVersion: 'test',
    options: DEFAULT_OPTIONS,
    durationSamples: 24000,
    segments: [
      {
        id: 0,
        startSample: 0,
        endSample: 24000,
        sourceRateHz: 24000,
        channel: 'mean' as const,
        precedingGap: null,
      },
    ],
    results: [],
    completeness: 'partial' as const,
  }
  await context.runtime.restore(saved, pcm, sha)
  context.engine.autoRelease = false
  return { ...context, pcm, sha, saved }
}
it('reserves canceled input until exact child/key/request/watermark release, then admits exactly one retained retry', async () => {
  const { runtime, engine, saved, sha } = await restored()
  const copy = vi.spyOn(Recording.prototype, 'copy')
  try {
    const first = runtime.refine()
    const rejected = expect(first).rejects.toThrow('canceled')
    await turn()
    const request = engine.requests[0]
    runtime.cancelRefinement()
    await rejected
    expect(await runtime.stop()).toBe(saved)
    const retry = runtime.retryRetainedRefinement()
    await expect(runtime.retryRetainedRefinement()).rejects.toThrow(
      'No canceled',
    )
    await expect(runtime.refine()).rejects.toThrow('already')
    for (const fields of [
      { childId: engine.childId + 1 },
      { generation: request.generation + 1 },
      {
        requestId: request.requestId + 1,
        throughRequestId: request.requestId + 1,
      },
    ])
      engine.release(request, fields)
    await turn()
    expect(copy).toHaveBeenCalledTimes(1)
    engine.release(request)
    await turn()
    expect(copy).toHaveBeenCalledTimes(2)
    const next = engine.requests[1]
    expect(next.requestId).toBeGreaterThan(request.requestId)
    expect(next.generation).toBeGreaterThan(request.generation)
    engine.release(request) // duplicate old input must not discharge the new owner
    engine.reply(next)
    await turn()
    expect(await runtime.stop()).toBe(saved)
    engine.release(next)
    await expect(retry).resolves.toMatchObject({ completeness: 'refined' })
    await expect(runtime.refine()).rejects.toThrow('already')
    expect((await runtime.exportPcm()).pcmSha256).toBe(sha)
  } finally {
    copy.mockRestore()
    runtime.dispose()
  }
})
it('holds normal result completion and export until release, with no result replay adoption', async () => {
  const { runtime, engine, saved } = await restored()
  const copy = vi.spyOn(Recording.prototype, 'copy')
  try {
    const refining = runtime.refine()
    await turn()
    engine.reply(engine.requests[0])
    engine.reply(engine.requests[0])
    let done = false
    void refining.then(() => {
      done = true
    })
    const exporting = runtime.exportPcm()
    await turn()
    expect(done).toBe(false)
    expect(copy).toHaveBeenCalledTimes(1)
    expect(await runtime.stop()).toBe(saved)
    engine.release(engine.requests[0])
    await refining
    await exporting
    expect(copy).toHaveBeenCalledTimes(2)
  } finally {
    copy.mockRestore()
    runtime.dispose()
  }
})
it('does not renew cleanup on repeat cancel; missing proof refuses export/retry and late ack cannot clear reservation', async () => {
  const { runtime, engine } = await restored()
  const copy = vi.spyOn(Recording.prototype, 'copy')
  try {
    const refining = runtime.refine()
    const rejected = expect(refining).rejects.toThrow('canceled')
    await turn()
    vi.useFakeTimers()
    const late = engine.onmessage!
    runtime.cancelRefinement()
    await rejected
    await vi.advanceTimersByTimeAsync(80)
    runtime.cancelRefinement()
    await vi.advanceTimersByTimeAsync(20)
    expect(engine.terminated).toBe(true)
    await expect(runtime.retryRetainedRefinement()).rejects.toThrow('unproved')
    await expect(runtime.exportPcm()).rejects.toThrow('unproved')
    const request = engine.requests[0]
    late(
      new MessageEvent('message', {
        data: {
          ...request,
          pcm: undefined,
          childId: engine.childId,
          throughRequestId: request.requestId,
          type: 'input_released',
        },
      }),
    )
    await expect(runtime.exportPcm()).rejects.toThrow('unproved')
    expect(copy).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
    copy.mockRestore()
    runtime.dispose()
  }
})
it('rejects malformed release watermarks and uncertain transfers instead of allocating again', async () => {
  const { runtime, engine } = await restored()
  try {
    const refining = runtime.refine()
    const rejected = expect(refining).rejects.toThrow('Invalid')
    await turn()
    engine.release(engine.requests[0], { throughRequestId: 999 })
    await rejected
    await expect(runtime.exportPcm()).rejects.toThrow('unproved')
  } finally {
    runtime.dispose()
  }
})
it('keeps the reservation when postMessage returns without detaching the analysis buffer', async () => {
  const { runtime, engine } = await restored()
  const copy = vi.spyOn(Recording.prototype, 'copy')
  const post = vi.spyOn(engine, 'postMessage').mockImplementation(() => {})
  try {
    await expect(runtime.refine()).rejects.toThrow(
      'Uncertain analysis input transfer',
    )
    expect(engine.terminated).toBe(true)
    await expect(runtime.exportPcm()).rejects.toThrow('unproved')
    expect(copy).toHaveBeenCalledTimes(1)
  } finally {
    post.mockRestore()
    copy.mockRestore()
    runtime.dispose()
  }
})
it('canceling an explicit retry while it waits for the old genuine-release boundary creates no new input', async () => {
  const { runtime, engine, saved } = await restored()
  const copy = vi.spyOn(Recording.prototype, 'copy')
  try {
    const first = runtime.refine()
    const canceled = expect(first).rejects.toThrow('canceled')
    await turn()
    runtime.cancelRefinement()
    await canceled
    let retryCanceled = false
    const retry = runtime.retryRetainedRefinement(() => retryCanceled)
    const rejected = expect(retry).rejects.toThrow('Retained retry canceled')
    retryCanceled = true
    engine.release(engine.requests[0])
    await rejected
    expect(copy).toHaveBeenCalledTimes(1)
    expect(await runtime.stop()).toBe(saved)
    await expect(runtime.refine()).rejects.toThrow('already')
  } finally {
    copy.mockRestore()
    runtime.dispose()
  }
})
