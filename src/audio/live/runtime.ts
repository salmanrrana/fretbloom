import {
  array,
  choice,
  number,
  object,
  parseAnalysisResult,
  parseHash,
  parseOptions,
  string,
} from '../analysisV1'
import type { AnalysisOptions } from '../analysisV1'
import { LIMITS } from './protocol'
import type {
  Key,
  LiveErrorCode,
  LiveRuntime,
  RuntimeEvent,
  TimelinePatch,
} from './protocol'
import {
  integer,
  parseCode,
  parseKey,
  parseLocalAnalysis,
  sameKey,
} from './validation'

type Pending = {
  operation: string
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
  cleanup: () => void
}
function error(
  message: string,
  code: LiveErrorCode,
): Error & { code: LiveErrorCode } {
  return Object.assign(new Error(message), { code })
}
function parsePatch(value: unknown): TimelinePatch {
  const v = object(value),
    key = parseKey(v),
    segmentId = integer(v.segmentId, 63),
    from = integer(v.replaceFromSample, LIMITS.samples),
    to = integer(v.replaceToSample, LIMITS.samples),
    settled = integer(v.settledThroughSample, LIMITS.samples)
  if (to <= from || settled < from || settled > to)
    throw new Error('Invalid patch extent')
  const base = {
    schemaVersion: 1,
    engineVersion: 'patch',
    options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
    duration: 300,
    sampleRateHz: 24000,
    timingResolutionSeconds: 0.02,
    tuning: { referenceHz: 440, estimatedOffsetCents: null },
    harmony: [],
    monophonicNotes: v.monophonicNotes,
    polyphonicNotes: v.polyphonicNotes,
    warnings: v.warnings,
  }
  const parsed = parseAnalysisResult(base)
  const withIds = (raw: unknown, notes: typeof parsed.monophonicNotes) =>
    array(raw, LIMITS.notes, (value) => object(value)).map((value, i) => ({
      ...notes[i],
      ...(value.id === undefined ? {} : { id: string(value.id, 160) }),
    }))
  const harmony = array(v.harmony, LIMITS.harmony, (value) => {
    const h = object(value),
      start = number(h.start, from / 24000, to / 24000),
      end = number(h.end, start, to / 24000)
    const parsed = parseAnalysisResult({
      ...base,
      duration: end - start,
      monophonicNotes: [],
      polyphonicNotes: [],
      harmony: [{ ...h, start: 0, end: end - start }],
    })
    return { ...parsed.harmony[0], start, end }
  })
  for (const n of [...parsed.monophonicNotes, ...parsed.polyphonicNotes])
    if (n.start < from / 24000 || n.end > to / 24000)
      throw new Error('Note outside patch')
  let prior = from / 24000
  for (const h of harmony) {
    if (h.start < prior) throw new Error('Patch harmony overlap')
    prior = h.end
  }
  const missedLiveIntervals =
    v.missedLiveIntervals === undefined
      ? undefined
      : array(v.missedLiveIntervals, 1024, (value) => {
          const i = object(value),
            startSample = integer(i.startSample, LIMITS.samples),
            endSample = integer(i.endSample, LIMITS.samples)
          if (
            integer(i.segmentId, 63) !== segmentId ||
            endSample <= startSample
          )
            throw new Error('Invalid patch diagnostic')
          return { segmentId, startSample, endSample }
        })
  if (missedLiveIntervals)
    for (let i = 1; i < missedLiveIntervals.length; i++)
      if (
        missedLiveIntervals[i].startSample <=
        missedLiveIntervals[i - 1].endSample
      )
        throw new Error('Uncoalesced patch diagnostics')
  return {
    ...key,
    revision: integer(v.revision),
    segmentId,
    replaceFromSample: from,
    replaceToSample: to,
    settledThroughSample: settled,
    harmony,
    monophonicNotes: withIds(v.monophonicNotes, parsed.monophonicNotes),
    polyphonicNotes: withIds(v.polyphonicNotes, parsed.polyphonicNotes),
    warnings: parsed.warnings,
    ...(missedLiveIntervals === undefined ? {} : { missedLiveIntervals }),
  }
}
export function parseRuntimeEvent(value: unknown): RuntimeEvent {
  const v = object(value)
  if (v.type === 'timeline')
    return { type: 'timeline', patch: parsePatch(v.patch) }
  const key = parseKey(v.key)
  if (v.type === 'ready')
    return { type: 'ready', key, engineVersion: string(v.engineVersion, 100) }
  if (v.type === 'stopped' || v.type === 'refined')
    return { type: v.type, key, analysis: parseLocalAnalysis(v.analysis) }
  if (v.type === 'error')
    return {
      type: 'error',
      key,
      code: parseCode(v.code),
      message: string(v.message, 1000),
    }
  const capturedSamples = integer(v.capturedSamples, LIMITS.samples)
  const position =
    v.capturePosition === undefined ? null : object(v.capturePosition)
  const capturePosition =
    position === null
      ? undefined
      : {
          segmentId: integer(position.segmentId, LIMITS.segments - 1),
          sample: integer(position.sample, LIMITS.samples),
        }
  if (
    capturePosition &&
    (capturePosition.sample === 0 || capturePosition.sample !== capturedSamples)
  )
    throw new Error('Capture position does not match captured samples')
  const ownedJsBytes =
    v.ownedJsBytes === undefined
      ? undefined
      : integer(v.ownedJsBytes, LIMITS.jsBytes)
  const sharedPcmBytes =
    v.sharedPcmBytes === undefined
      ? undefined
      : integer(v.sharedPcmBytes, LIMITS.samples * 4)
  if (
    sharedPcmBytes !== undefined &&
    (ownedJsBytes === undefined || sharedPcmBytes > ownedJsBytes)
  )
    throw new Error('Shared PCM exceeds owned buffers')
  return {
    type: choice(v.type, ['status']),
    ...(sharedPcmBytes === undefined ? {} : { sharedPcmBytes }),
    ...(capturePosition === undefined ? {} : { capturePosition }),
    ...(v.captureEpoch === undefined
      ? {}
      : { captureEpoch: integer(v.captureEpoch) }),
    key,
    capturedSamples,
    analyzedThroughSample: integer(v.analyzedThroughSample, LIMITS.samples),
    queuedBlocks: integer(v.queuedBlocks, 2),
    processingMs: number(v.processingMs, 0, 120000),
    wasmBytes: integer(v.wasmBytes, LIMITS.wasmBytes),
    ...(v.ownedJsBytes === undefined
      ? {}
      : { ownedJsBytes: integer(v.ownedJsBytes, LIMITS.jsBytes) }),
    ...(v.queuedHighWater === undefined
      ? {}
      : { queuedHighWater: integer(v.queuedHighWater, 2) }),
    ...(v.skippedWindows === undefined
      ? {}
      : { skippedWindows: integer(v.skippedWindows) }),
  }
}

/** Main-thread facade carries metadata only; PCM and Rust stay in dedicated workers. */
export function createLiveRuntime(
  onEvent: (event: RuntimeEvent) => void,
): LiveRuntime {
  let worker: Worker | null = null,
    key: Key | null = null,
    nextId = 0,
    disposed = false,
    prepared = false,
    stopPromise: ReturnType<LiveRuntime['stop']> | null = null
  let exported: Promise<{ pcm: Blob; pcmSha256: string }> | null = null
  let exportedBytes = 0
  let lastStatus: Extract<RuntimeEvent, { type: 'status' }> | null = null
  const reportBuffers = () => {
    if (lastStatus)
      onEvent({
        ...lastStatus,
        ...(lastStatus.ownedJsBytes === undefined
          ? {}
          : {
              ownedJsBytes: lastStatus.ownedJsBytes + exportedBytes,
              sharedPcmBytes: exportedBytes,
            }),
      })
  }
  const pending = new Map<number, Pending>(),
    revisions = new Map<number, number>()
  const terminate = (reason: Error) => {
    if (worker) {
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
      worker = null
    }
    for (const p of pending.values()) {
      clearTimeout(p.timer)
      p.cleanup()
      p.reject(reason)
    }
    pending.clear()
    prepared = false
  }
  const rpc = (
    type: string,
    fields: Record<string, unknown> = {},
    transfer: Transferable[] = [],
    signal?: AbortSignal,
    timeout = 16000,
  ): Promise<unknown> => {
    if (!worker || !key || disposed)
      return Promise.reject(
        error('Listening runtime is unavailable', 'CANCELED'),
      )
    if (signal?.aborted)
      return Promise.reject(error('Operation canceled', 'CANCELED'))
    if (pending.size >= 8)
      return Promise.reject(
        error('Too many local operations', 'LIMIT_EXCEEDED'),
      )
    const requestId = ++nextId
    return new Promise((resolve, reject) => {
      const abort = () => {
        const p = pending.get(requestId)
        if (!p) return
        pending.delete(requestId)
        clearTimeout(p.timer)
        p.cleanup()
        if (type === 'refine' || type === 'retry_retained_refinement')
          worker?.postMessage({
            ...key,
            type: 'cancel_refinement',
            refinementRequestId: requestId,
            cleanupDeadline: Date.now() + 100,
          })
        else if (type === 'restore' || type === 'prepare')
          terminate(error('Operation canceled', 'CANCELED'))
        reject(error('Operation canceled', 'CANCELED'))
      }
      const timer = setTimeout(() => {
        const p = pending.get(requestId)
        if (!p) return
        pending.delete(requestId)
        p.cleanup()
        if (type === 'refine' || type === 'retry_retained_refinement')
          worker?.postMessage({
            ...key,
            type: 'cancel_refinement',
            refinementRequestId: requestId,
            cleanupDeadline: Date.now() + 100,
          })
        reject(
          error(
            'Local operation timed out; retained audio may still be exported',
            type === 'refine' || type === 'retry_retained_refinement'
              ? 'CANCELED'
              : 'ENGINE_CRASH',
          ),
        )
        if (type === 'prepare' || type === 'restore')
          terminate(error('Worker operation timed out', 'ENGINE_CRASH'))
      }, timeout)
      pending.set(requestId, {
        operation: type,
        resolve,
        reject,
        timer,
        cleanup: () => signal?.removeEventListener('abort', abort),
      })
      signal?.addEventListener('abort', abort, { once: true })
      try {
        worker?.postMessage({ ...key, type, requestId, ...fields }, transfer)
      } catch {
        pending.delete(requestId)
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        reject(error('Worker transport failed', 'PROTOCOL_MISMATCH'))
      }
    })
  }
  const prepare = async (
    nextKey: Key,
    options: AnalysisOptions,
    signal?: AbortSignal,
  ) => {
    const parsedKey = parseKey(nextKey),
      parsedOptions = parseOptions(options)
    if (key && parsedKey.generation <= key.generation)
      throw error('Session generation must increase', 'INVALID_INPUT')
    terminate(error('Session replaced', 'CANCELED'))
    disposed = false
    key = parsedKey
    stopPromise = null
    exported = null
    exportedBytes = 0
    lastStatus = null
    revisions.clear()
    const owned = new Worker(new URL('./ingest.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker = owned
    owned.onerror = () => {
      terminate(error('Local ingestion worker crashed', 'ENGINE_CRASH'))
      if (key)
        onEvent({
          type: 'error',
          key,
          code: 'ENGINE_CRASH',
          message: 'Local audio worker stopped. Start a new capture.',
        })
    }
    owned.onmessageerror = () =>
      terminate(error('Invalid local worker transport', 'PROTOCOL_MISMATCH'))
    owned.onmessage = (message: MessageEvent<unknown>) => {
      if (worker !== owned || !key) return
      let event: RuntimeEvent | null = null
      try {
        const v = object(message.data)
        if (v.type === 'event') {
          const rawEvent = object(v.event)
          if (
            !sameKey(
              parseKey(
                rawEvent.type === 'timeline' ? rawEvent.patch : rawEvent.key,
              ),
              key,
            )
          )
            return
          // Only the matching RPC reply can commit refinement. Ingestion also
          // emits a completion event, but it has no request identity.
          if (rawEvent.type === 'refined') return
          event = parseRuntimeEvent(rawEvent)
          if (event.type === 'status') {
            lastStatus = event
            event = {
              ...event,
              ...(event.ownedJsBytes === undefined
                ? {}
                : {
                    ownedJsBytes: event.ownedJsBytes + exportedBytes,
                    sharedPcmBytes: exportedBytes,
                  }),
            }
          }
          const eventKey = event.type === 'timeline' ? event.patch : event.key
          if (!sameKey(key, eventKey)) return
          if (event.type === 'timeline') {
            const patch = event.patch
            if (patch.revision <= (revisions.get(patch.segmentId) ?? 0)) return
            revisions.set(patch.segmentId, patch.revision)
          }
        } else {
          if (v.type !== 'reply' || !sameKey(parseKey(v), key)) return
          const requestId = integer(v.requestId),
            p = pending.get(requestId)
          if (!p) return
          // Validate before removing the pending request so malformed success
          // replies still reject it when the transport is terminated below.
          if (
            v.ok === true &&
            (p.operation === 'refine' ||
              p.operation === 'retry_retained_refinement')
          )
            event = {
              type: 'refined',
              key,
              analysis: parseLocalAnalysis(v.value),
            }
          pending.delete(requestId)
          clearTimeout(p.timer)
          p.cleanup()
          if (v.ok === true)
            p.resolve(event?.type === 'refined' ? event.analysis : v.value)
          else if (v.ok === false)
            p.reject(error(string(v.message, 1000), parseCode(v.code)))
          else {
            p.reject(error('Invalid reply status', 'PROTOCOL_MISMATCH'))
            throw new Error('Invalid reply status')
          }
        }
      } catch {
        terminate(error('Invalid local worker response', 'PROTOCOL_MISMATCH'))
        return
      }
      if (event) onEvent(event)
    }
    await rpc('prepare', { options: parsedOptions }, [], signal)
    if (worker !== owned || !key || !sameKey(key, parsedKey))
      throw error('Session replaced', 'CANCELED')
    prepared = true
  }
  return {
    prepare,
    async restore(nextKey, saved, pcm, pcmSha256, signal, options) {
      const validated = parseLocalAnalysis(saved),
        hash = parseHash(pcmSha256)
      if (!(pcm instanceof Blob) || pcm.size !== validated.durationSamples * 4)
        throw error('Saved audio size mismatch', 'INVALID_INPUT')
      if (signal.aborted) throw error('Restore canceled', 'CANCELED')
      await prepare(nextKey, validated.options, signal)
      if (!key || !sameKey(key, parseKey(nextKey)))
        throw error('Restore replaced', 'CANCELED')
      if (signal.aborted) {
        terminate(error('Restore canceled', 'CANCELED'))
        throw error('Restore canceled', 'CANCELED')
      }
      await rpc(
        'restore',
        {
          saved: validated,
          pcm,
          pcmSha256: hash,
          allowEngineChange: options?.allowEngineChange === true,
        },
        [],
        signal,
      )
      if (!key || !sameKey(key, parseKey(nextKey)))
        throw error('Restore replaced', 'CANCELED')
      stopPromise = Promise.resolve(validated)
      exported = Promise.resolve({ pcm, pcmSha256: hash })
      exportedBytes = pcm.size
      reportBuffers()
    },
    attachCapturePort(port, options) {
      if (!prepared)
        throw error('Wait for local engine readiness', 'WASM_LOAD_FAILED')
      const channel = choice(options?.channel ?? 'mean', [
        'mean',
        'left',
        'right',
      ])
      void rpc('attach', { port, channel }, [port]).catch((e) => {
        if (key)
          onEvent({
            type: 'error',
            key,
            code: 'PROTOCOL_MISMATCH',
            message: e instanceof Error ? e.message : 'Capture port failed',
          })
      })
    },
    stop() {
      if (!stopPromise)
        stopPromise = rpc('stop', {}, [], undefined, 8000).then(
          parseLocalAnalysis,
        )
      return stopPromise
    },
    async refine(signal) {
      return parseLocalAnalysis(await rpc('refine', {}, [], signal, 121000))
    },
    async retryRetainedRefinement(signal) {
      return parseLocalAnalysis(
        await rpc('retry_retained_refinement', {}, [], signal, 121000),
      )
    },
    exportPcm(signal) {
      if (signal.aborted)
        return Promise.reject(error('Export canceled', 'CANCELED'))
      if (exported) return exported
      const exportKey = key
      const operation = rpc('export', {}, [], signal, 15000)
        .then((value) => {
          if (!key || !exportKey || !sameKey(key, exportKey) || disposed)
            throw error('Export replaced', 'CANCELED')
          const v = object(value)
          if (
            !(v.pcm instanceof Blob) ||
            v.pcm.size > LIMITS.samples * 4 ||
            v.pcm.size % 4
          )
            throw error('Invalid exported PCM', 'PROTOCOL_MISMATCH')
          const pcmSha256 = parseHash(v.pcmSha256)
          exportedBytes = v.pcm.size
          reportBuffers()
          return { pcm: v.pcm, pcmSha256 }
        })
        .catch((error) => {
          if (exported === operation) exported = null
          throw error
        })
      exported = operation
      return exported
    },
    cancelRefinement() {
      for (const [id, p] of pending)
        if (
          p.operation === 'refine' ||
          p.operation === 'retry_retained_refinement'
        ) {
          worker?.postMessage({
            ...key,
            type: 'cancel_refinement',
            refinementRequestId: id,
            cleanupDeadline: Date.now() + 100,
          })
          pending.delete(id)
          clearTimeout(p.timer)
          p.cleanup()
          p.reject(error('Refinement canceled', 'CANCELED'))
        }
    },
    dispose() {
      disposed = true
      exported = null
      exportedBytes = 0
      terminate(error('Listening session disposed', 'CANCELED'))
      if (lastStatus)
        onEvent({
          ...lastStatus,
          capturePosition: undefined,
          ownedJsBytes: 0,
          sharedPcmBytes: 0,
        })
      lastStatus = null
    },
  }
}
