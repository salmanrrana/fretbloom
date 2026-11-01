import { choice, object, parseHash, parseOptions, string } from '../analysisV1'
import type {
  AlignmentFeatures,
  AnalysisOptions,
  AnalysisResult,
} from '../analysisV1'
import { LIMITS } from './protocol'
import type {
  CaptureReply,
  CaptureSegment,
  EngineReply,
  InputFence,
  Key,
  LiveErrorCode,
  LocalAnalysis,
  RuntimeEvent,
} from './protocol'
import {
  finitePcm,
  integer,
  optionsEqual,
  parseCaptureMessage,
  parseEngineReply,
  parseInputFence,
  parseKey,
  parseLocalAnalysis,
  parseOutput,
  sameKey,
} from './validation'
import { SincResampler } from './resampler'
import { RollingTimeline } from './rollingTimeline'

type AnalysisWorker = {
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null
}
type Job = {
  segmentId: number
  startSample: number
  endSample: number
  final: boolean
}
type Waiter = {
  resolve: (value: EngineReply) => void
  reject: (reason: Error) => void
  id: number
  samples: number
  options: AnalysisOptions
  timer: ReturnType<typeof setTimeout>
  fence: InputFence
  reply: EngineReply | null
  canceled: boolean
  release: Promise<void>
  releaseResolve: () => void
  releaseReject: (error: Error) => void
  cleanupTimer: ReturnType<typeof setTimeout> | null
}
const CHUNK = 16384
/** Chunked recording avoids repeated full-session copies; the separate ring bounds live reads. */
export class Recording {
  private chunks: Float32Array[] = []
  ring = new Float32Array(LIMITS.ring)
  length = 0
  append(input: Float32Array): void {
    if (this.length + input.length > LIMITS.samples)
      throw new Error('PCM duration limit')
    for (let i = 0; i < input.length;) {
      const slot = Math.floor(this.length / CHUNK),
        offset = this.length % CHUNK
      if (!this.chunks[slot])
        this.chunks.push(
          new Float32Array(Math.min(CHUNK, LIMITS.samples - slot * CHUNK)),
        )
      const count = Math.min(
        input.length - i,
        this.chunks[slot].length - offset,
      )
      this.chunks[slot].set(input.subarray(i, i + count), offset)
      for (let j = 0; j < count; j++)
        this.ring[(this.length + j) % LIMITS.ring] = input[i + j]
      this.length += count
      i += count
    }
  }
  copy(start: number, end: number): Float32Array<ArrayBuffer> {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end > this.length ||
      end < start
    )
      throw new Error('Invalid recording extent')
    const out = new Float32Array(end - start)
    for (let i = start; i < end;) {
      const slot = Math.floor(i / CHUNK),
        offset = i % CHUNK,
        count = Math.min(end - i, this.chunks[slot].length - offset)
      out.set(this.chunks[slot].subarray(offset, offset + count), i - start)
      i += count
    }
    return out
  }
  release(): void {
    this.chunks = []
    this.ring = new Float32Array(0)
    this.length = 0
  }
  get ownedBytes(): number {
    return (
      this.chunks.reduce((n, c) => n + c.byteLength, 0) + this.ring.byteLength
    )
  }
}
function failure(
  message: string,
  code: LiveErrorCode = 'INVALID_INPUT',
): Error & { code: LiveErrorCode } {
  return Object.assign(new Error(message), { code })
}
function errorCode(error: unknown): LiveErrorCode {
  if (error instanceof Error && 'code' in error) {
    try {
      return choice(error.code, [
        'INVALID_INPUT',
        'LIMIT_EXCEEDED',
        'CANCELED',
        'SERIALIZATION_FAILED',
        'ENGINE_CRASH',
        'WASM_LOAD_FAILED',
        'PROTOCOL_MISMATCH',
        'ANALYSIS_TOO_SLOW',
        'CAPTURE_OVERFLOW',
        'UNSUPPORTED_SAMPLE_RATE',
      ])
    } catch {
      /* Generic failure below. */
    }
  }
  return 'INVALID_INPUT'
}
function message(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1000)
    : 'Local analysis failed'
}
function coalesceMissed(
  intervals: NonNullable<LocalAnalysis['missedLiveIntervals']>,
) {
  const out: typeof intervals = []
  for (const i of intervals.sort((a, b) => a.startSample - b.startSample)) {
    const prior = out.at(-1)
    if (
      prior &&
      prior.segmentId === i.segmentId &&
      i.startSample <= prior.endSample
    )
      prior.endSample = Math.max(prior.endSample, i.endSample)
    else out.push({ ...i })
  }
  if (out.length > 1024)
    throw failure('Missed interval cap exceeded', 'LIMIT_EXCEEDED')
  return out
}

/** Ingestion stays responsive while the synchronous engine is occupied in its own worker. */
export class IngestRuntime {
  private key: Key | null = null
  private options: AnalysisOptions | null = null
  private engine: AnalysisWorker | null = null
  private engineGeneration = 0
  private childId = 0
  private inputBlocked = false
  private refinePromise: Promise<LocalAnalysis> | null = null
  private refineOutcome:
    'unused' | 'running' | 'canceled' | 'complete' | 'failed' = 'unused'
  private retryQueued = false
  private engineVersion = ''
  private engineReady: Promise<void> | null = null
  private waiter: Waiter | null = null
  private nextEngineRequest = 0
  private engineBootTimer: ReturnType<typeof setTimeout> | null = null
  private engineBootReject: ((e: Error) => void) | null = null
  private port: MessagePort | null = null
  private recording = new Recording()
  private segments: CaptureSegment[] = []
  private timelines = new Map<number, RollingTimeline>()
  private active: CaptureSegment | null = null
  private captureEpoch = 0
  private resampler: SincResampler | null = null
  private channel: 'mean' | 'left' | 'right' = 'mean'
  private chosen: 'mean' | 'left' | 'right' = 'mean'
  private sessionChosen: 'mean' | 'left' | 'right' | null = null
  private decision: Float32Array[] = []
  private decisionFrames = 0
  private sourceChannels = 1
  private rate = 24000
  private decided = false
  private lastSequence = -1
  private expectedFrame = 0
  private paused = false
  private ended = false
  private stopped = false
  private partial = false
  private gap: CaptureSegment['precedingGap'] = null
  private gapAt: number | null = null
  private pending: Job | null = null
  private running: Job | null = null
  private nextWindow: number = LIMITS.first
  private drainWaiters: (() => void)[] = []
  private stoppedAnalysis: LocalAnalysis | null = null
  private stopPromise: Promise<LocalAnalysis> | null = null
  private allowEngineChange = false
  private refineUsed = false
  private refining = false
  private cancelRefine = false
  private heavy = false
  private highWater = 0
  private skipped = 0
  private lagReports = 0
  private processingMs = 0
  private wasmBytes = 0
  private transferBytes = 0
  private operationBytes = 0
  private begunAt = 0
  private statusTimer: ReturnType<typeof setInterval> | null = null
  private stopWatchdog: ReturnType<typeof setTimeout> | null = null
  private resolveEnd: (() => void) | null = null
  private readonly send: (value: unknown, transfer?: Transferable[]) => void
  private readonly workerFactory: () => AnalysisWorker
  constructor(
    send: (value: unknown, transfer?: Transferable[]) => void,
    workerFactory: () => AnalysisWorker = () =>
      new Worker(new URL('./analysis.worker.ts', import.meta.url), {
        type: 'module',
      }),
  ) {
    this.send = send
    this.workerFactory = workerFactory
  }
  private event(event: RuntimeEvent): void {
    this.send({ type: 'event', event })
  }
  private getKey(): Key {
    if (!this.key) throw failure('Runtime not prepared')
    return this.key
  }
  private getOptions(): AnalysisOptions {
    if (!this.options) throw failure('Runtime not prepared')
    return this.options
  }
  private fail(error: unknown): void {
    if (!this.key) return
    this.partial = true
    this.event({
      type: 'error',
      key: this.key,
      code: errorCode(error),
      message: message(error),
    })
  }
  private killEngine(reason: Error): void {
    if (this.engine) {
      this.engine.onmessage = null
      this.engine.onerror = null
      this.engine.onmessageerror = null
      this.engine.terminate()
    }
    if (this.engineBootTimer) clearTimeout(this.engineBootTimer)
    this.engineBootTimer = null
    this.engine = null
    this.engineGeneration++
    this.engineBootReject?.(reason)
    this.engineBootReject = null
    this.engineReady = null
    if (this.waiter) {
      const w = this.waiter
      this.waiter = null
      clearTimeout(w.timer)
      if (w.cleanupTimer) clearTimeout(w.cleanupTimer)
      // Terminate is not an input-release proof. Preserve the reservation.
      this.inputBlocked = true
      w.releaseReject(reason)
      w.reject(reason)
    }
  }
  private bootEngine(): Promise<void> {
    if (this.inputBlocked)
      return Promise.reject(
        failure(
          'Analysis input release is unproved; retry/export refused',
          'ENGINE_CRASH',
        ),
      )
    if (this.engineReady) return this.engineReady
    const childId = ++this.childId,
      generation = this.engineGeneration,
      key = { ...this.getKey(), generation }
    const worker = this.workerFactory()
    this.engine = worker
    this.engineReady = new Promise<void>((resolve, reject) => {
      this.engineBootReject = reject
      const timer = setTimeout(() => {
        this.killEngine(
          failure('Local Rust engine did not load', 'WASM_LOAD_FAILED'),
        )
      }, 15000)
      this.engineBootTimer = timer
      const failed = (error: Error) => {
        clearTimeout(timer)
        reject(error)
        this.engineBootReject = null
      }
      worker.onerror = () => {
        const e = failure(
          'Local Rust worker crashed; captured audio retained',
          'ENGINE_CRASH',
        )
        failed(e)
        this.killEngine(e)
      }
      worker.onmessageerror = () => {
        const e = failure('Invalid worker transport', 'PROTOCOL_MISMATCH')
        failed(e)
        this.killEngine(e)
      }
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (this.engine !== worker || generation !== this.engineGeneration)
          return
        try {
          const v = object(event.data)
          if (!sameKey(parseKey(v), key) || v.childId !== childId) return
          if (v.type === 'engine_ready') {
            if (this.engineBootReject === null)
              throw failure('Duplicate engine readiness', 'PROTOCOL_MISMATCH')
            const version = string(v.engineVersion, 100)
            if (this.engineVersion && version !== this.engineVersion)
              throw failure(
                'Engine changed during session',
                'PROTOCOL_MISMATCH',
              )
            this.engineVersion = version
            this.wasmBytes = integer(v.wasmBytes, LIMITS.wasmBytes)
            clearTimeout(timer)
            this.engineBootTimer = null
            this.engineBootReject = null
            resolve()
            return
          }
          if (v.type === 'engine_failed') {
            const e = failure(string(v.message, 1000), 'WASM_LOAD_FAILED')
            failed(e)
            this.killEngine(e)
            return
          }
          const waiter = this.waiter
          if (!waiter) return
          const fence = parseInputFence(v)
          if (
            fence.requestId !== waiter.id ||
            fence.childId !== waiter.fence.childId
          )
            return
          if (v.type === 'input_released') {
            // Exact registered child object, engine key, request and watermark.
            // Normal completion additionally requires its matching staged reply.
            if (!waiter.canceled && !waiter.reply)
              throw new Error('Release before result')
            clearTimeout(waiter.timer)
            if (waiter.cleanupTimer) clearTimeout(waiter.cleanupTimer)
            this.waiter = null
            this.transferBytes = 0
            waiter.releaseResolve()
            if (waiter.canceled)
              this.killEngine(failure('Refinement canceled', 'CANCELED'))
            else if (waiter.reply) waiter.resolve(waiter.reply)
            return
          }
          if (waiter.canceled || waiter.reply) return
          const reply = parseEngineReply(v)
          if (reply.type === 'result') {
            parseOutput(reply, waiter.samples, this.engineVersion)
            if (!optionsEqual(reply.result.options, waiter.options))
              throw failure('Engine options mismatch', 'PROTOCOL_MISMATCH')
            this.processingMs = reply.computeMs
            this.wasmBytes = reply.wasmBytes
          }
          waiter.reply = reply
          this.startReleaseDeadline(waiter)
        } catch {
          const e = failure('Invalid Rust worker reply', 'PROTOCOL_MISMATCH')
          failed(e)
          this.killEngine(e)
        }
      }
      worker.postMessage({ ...key, childId, type: 'init' })
    })
    return this.engineReady
  }
  private async analyze(
    job: Job,
    purpose: 'live' | 'refine',
    deadline: number,
  ): Promise<{ result: AnalysisResult; features: AlignmentFeatures }> {
    await this.bootEngine()
    if (this.waiter)
      throw failure('Analysis already running', 'PROTOCOL_MISMATCH')
    if (this.cancelRefine && purpose === 'refine')
      throw failure('Refinement canceled', 'CANCELED')
    if (this.inputBlocked)
      throw failure('Analysis input release is unproved', 'ENGINE_CRASH')
    const bytes = (job.endSample - job.startSample) * 4
    this.checkBudget(bytes)
    const pcm = this.recording.copy(job.startSample, job.endSample),
      id = ++this.nextEngineRequest,
      key = { ...this.getKey(), generation: this.engineGeneration },
      fence = {
        ...key,
        childId: this.childId,
        requestId: id,
        throughRequestId: id,
      },
      options = this.getOptions()
    this.transferBytes = bytes
    let releaseResolve!: () => void
    let releaseReject!: (error: Error) => void
    const release = new Promise<void>((resolve, reject) => {
      releaseResolve = resolve
      releaseReject = reject
    })
    // Cancellation can reject the user operation before a retry/export joins release.
    void release.catch(() => {})
    const reply = await new Promise<EngineReply>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.cancelInput(
            failure(
              purpose === 'live'
                ? 'Live analysis exceeded five seconds; audio retained'
                : 'Refinement exceeded 120 seconds',
              purpose === 'live' ? 'ANALYSIS_TOO_SLOW' : 'CANCELED',
            ),
          ),
        Math.max(1, deadline - performance.now()),
      )
      this.waiter = {
        resolve,
        reject,
        id,
        samples: pcm.length,
        options,
        timer,
        fence,
        release,
        releaseResolve,
        releaseReject,
        reply: null,
        canceled: false,
        cleanupTimer: null,
      }
      try {
        this.engine?.postMessage(
          {
            ...fence,
            type: 'analyze',
            purpose,
            segmentId: job.segmentId,
            startSample: job.startSample,
            pcm: pcm.buffer,
            options,
          },
          [pcm.buffer],
        )
        if (pcm.byteLength !== 0)
          throw new Error('Analysis input transfer did not detach')
      } catch {
        this.killEngine(
          failure('Uncertain analysis input transfer', 'PROTOCOL_MISMATCH'),
        )
      }
    })
    if (reply.type === 'error') {
      const reason = failure(reply.message, reply.code)
      this.killEngine(reason)
      throw reason
    }
    return { result: reply.result, features: reply.features }
  }
  private startReleaseDeadline(
    waiter: Waiter,
    deadline = Date.now() + 100,
  ): void {
    if (waiter.cleanupTimer) return
    waiter.cleanupTimer = setTimeout(
      () => {
        if (this.waiter === waiter)
          this.killEngine(
            failure(
              'Analysis input release was not proved within cleanup deadline; retry/export refused',
              'ENGINE_CRASH',
            ),
          )
      },
      Math.max(0, deadline - Date.now()),
    )
  }
  private cancelInput(reason: Error, deadline = Date.now() + 100): void {
    const waiter = this.waiter
    if (!waiter || waiter.canceled) return
    waiter.canceled = true
    clearTimeout(waiter.timer)
    this.startReleaseDeadline(waiter, deadline)
    waiter.reject(reason)
    try {
      this.engine?.postMessage({ ...waiter.fence, type: 'cancel_input' })
    } catch {
      this.killEngine(
        failure('Analysis cleanup transport failed', 'ENGINE_CRASH'),
      )
    }
  }
  private async awaitInputRelease(): Promise<void> {
    if (this.inputBlocked)
      throw failure(
        'Analysis input release is unproved; retry/export refused',
        'ENGINE_CRASH',
      )
    if (this.waiter) await this.waiter.release
    if (this.inputBlocked)
      throw failure(
        'Analysis input release is unproved; retry/export refused',
        'ENGINE_CRASH',
      )
  }
  private ownedBytes(): number {
    return (
      this.recording.ownedBytes +
      this.transferBytes +
      this.operationBytes +
      this.decision.reduce((n, c) => n + c.byteLength, 0) +
      (this.resampler?.ownedBytes ?? 0) +
      8 * 2048 * 2 * 4
    )
  }
  private checkBudget(extra = 0): void {
    if (this.ownedBytes() + extra > LIMITS.jsBytes)
      throw failure('Local audio buffer budget exceeded', 'LIMIT_EXCEEDED')
  }
  async prepare(key: Key, options: AnalysisOptions): Promise<void> {
    if (this.key) throw failure('Session already prepared')
    this.key = key
    this.options = options
    this.engineGeneration = key.generation
    await this.bootEngine()
    this.event({ type: 'ready', key, engineVersion: this.engineVersion })
    this.statusTimer = setInterval(() => this.status(true), 500)
  }
  attach(port: MessagePort, channel: 'mean' | 'left' | 'right'): void {
    this.getKey()
    if (this.port || this.stopped)
      throw failure('Capture already attached or stopped')
    this.channel = channel
    this.port = port
    this.begunAt = performance.now()
    port.onmessage = (event: MessageEvent<unknown>) => {
      let recycled: ArrayBuffer | null = null,
        sequence = -1
      try {
        const raw = object(event.data)
        // Even rejected PCM returns its owned credit; stale keys never mutate the ledger.
        if (
          raw.interleaved instanceof ArrayBuffer &&
          raw.interleaved.byteLength <= 16384
        ) {
          recycled = raw.interleaved
          sequence = integer(raw.sequence)
        }
        if (!sameKey(parseKey(raw), this.getKey())) return
        const input = parseCaptureMessage(raw)
        if (input.sequence <= this.lastSequence)
          throw failure(
            'Repeated or out-of-order capture block',
            'PROTOCOL_MISMATCH',
          )
        const sequenceLost = input.sequence !== this.lastSequence + 1
        this.lastSequence = input.sequence
        if (this.ended || this.stopped) {
          if (input.type === 'boundary' && input.action === 'end')
            port.postMessage({
              ...this.getKey(),
              type: 'boundary_ack',
              sequence: input.sequence,
              action: 'end',
            } satisfies CaptureReply)
          return
        }
        if (input.type === 'pcm') {
          if (input.firstFrame < this.expectedFrame)
            throw failure(
              'Source frame clock moved backward',
              'PROTOCOL_MISMATCH',
            )
          if (
            sequenceLost ||
            (!this.paused && input.firstFrame !== this.expectedFrame)
          )
            this.discontinuity('transport_overflow')
          if (this.paused)
            throw failure(
              'PCM received before resume boundary',
              'PROTOCOL_MISMATCH',
            )
          if (
            this.active &&
            (input.sampleRateHz !== this.rate ||
              input.channels !== this.sourceChannels)
          )
            this.discontinuity('device_changed')
          this.rate = input.sampleRateHz
          this.sourceChannels = input.channels
          if (!this.active) this.openSegment()
          const samples = new Float32Array(
            input.interleaved,
            0,
            input.frameCount * input.channels,
          )
          this.acceptSource(samples)
          this.expectedFrame = input.firstFrame + input.frameCount
        } else {
          if (input.frame < this.expectedFrame)
            throw failure(
              'Boundary frame clock moved backward',
              'PROTOCOL_MISMATCH',
            )
          if (
            (sequenceLost ||
              (!this.paused && input.frame !== this.expectedFrame)) &&
            !this.ended
          )
            this.discontinuity('transport_overflow')
          this.expectedFrame = input.frame
          if (input.action === 'pause') {
            this.discontinuity(
              input.reason === 'user_stop' ? 'paused' : input.reason,
            )
            this.paused = true
          }
          if (input.action === 'resume') {
            ++this.captureEpoch
            this.paused = false
          }
          if (input.action === 'end') {
            this.closeSegment()
            this.ended = true
            this.paused = true
            this.resolveEnd?.()
            this.resolveEnd = null
          }
          const ack: CaptureReply = {
            ...this.getKey(),
            type: 'boundary_ack',
            sequence: input.sequence,
            action: input.action,
          }
          this.status()
          port.postMessage(ack)
        }
      } catch (error) {
        this.fail(error)
        this.forceStop()
      } finally {
        if (recycled) {
          const reply: CaptureReply = {
            ...this.getKey(),
            type: 'credit',
            sequence,
            recycled,
          }
          port.postMessage(reply, [recycled])
        }
      }
    }
    port.onmessageerror = () => {
      this.fail(failure('Capture transport failed', 'CAPTURE_OVERFLOW'))
      this.forceStop()
    }
    port.start()
  }
  private openSegment(): void {
    if (this.segments.length >= LIMITS.segments)
      throw failure('Recording reached 64 separate segments', 'LIMIT_EXCEEDED')
    if (this.gap && this.gapAt !== null)
      this.gap.wallDurationMs = Math.min(
        1800000,
        performance.now() - this.gapAt,
      )
    this.active = {
      id: this.segments.length,
      startSample: this.recording.length,
      endSample: this.recording.length,
      sourceRateHz: this.rate,
      channel: this.channel,
      precedingGap: this.segments.length
        ? (this.gap ?? { reason: 'transport_overflow', wallDurationMs: null })
        : null,
    }
    this.resampler = new SincResampler(this.rate)
    this.decided = this.sessionChosen !== null
    this.decision = []
    this.decisionFrames = 0
    this.chosen = this.sessionChosen ?? this.channel
    this.active.channel = this.chosen
    this.nextWindow = this.active.startSample + LIMITS.first
  }
  private acceptSource(samples: Float32Array): void {
    if (!this.decided) {
      this.decision.push(samples.slice())
      this.decisionFrames += samples.length / this.sourceChannels
      if (this.decisionFrames >= this.rate / 2) this.chooseChannel()
    } else this.downmix(samples)
  }
  private chooseChannel(): void {
    if (this.decided) return
    let left = 0,
      right = 0,
      mean = 0
    if (this.channel === 'mean' && this.sourceChannels === 2) {
      for (const chunk of this.decision)
        for (let i = 0; i < chunk.length; i += 2) {
          left += chunk[i] ** 2
          right += chunk[i + 1] ** 2
          mean += ((chunk[i] + chunk[i + 1]) / 2) ** 2
        }
      if (mean < 0.05 * Math.max(left, right) && Math.max(left, right) > 1e-8)
        this.chosen = left >= right ? 'left' : 'right'
    }
    this.decided = true
    this.sessionChosen = this.chosen
    if (this.active) this.active.channel = this.chosen
    for (const chunk of this.decision) this.downmix(chunk)
    this.decision = []
    this.decisionFrames = 0
  }
  private downmix(samples: Float32Array): void {
    const mono = new Float32Array(samples.length / this.sourceChannels)
    for (let i = 0; i < mono.length; i++)
      mono[i] =
        this.sourceChannels === 1
          ? samples[i]
          : this.chosen === 'left'
            ? samples[2 * i]
            : this.chosen === 'right'
              ? samples[2 * i + 1]
              : (samples[2 * i] + samples[2 * i + 1]) / 2
    if (!this.resampler) throw failure('Missing source resampler')
    this.acceptCanonical(this.resampler.push(mono))
  }
  private acceptCanonical(samples: Float32Array): void {
    const remaining = LIMITS.samples - this.recording.length
    this.recording.append(samples.subarray(0, remaining))
    if (this.active) {
      this.active.endSample = this.recording.length
      if (this.recording.length >= this.nextWindow) {
        const end =
          this.active.startSample +
          Math.floor(
            (this.recording.length - this.active.startSample) / LIMITS.hop,
          ) *
            LIMITS.hop
        this.queue({
          segmentId: this.active.id,
          startSample: Math.max(this.active.startSample, end - LIMITS.window),
          endSample: end,
          final: false,
        })
        this.nextWindow = end + LIMITS.hop
      }
    }
    if (samples.length >= remaining && !this.ended) {
      this.partial = true
      this.fail(failure('Five-minute audio limit reached', 'LIMIT_EXCEEDED'))
      queueMicrotask(() => this.forceStop())
    }
  }
  private closeSegment(): void {
    if (!this.active) return
    this.chooseChannel()
    if (this.resampler) this.acceptCanonical(this.resampler.finish())
    const segment = this.active
    segment.endSample = this.recording.length
    if (segment.endSample > segment.startSample) {
      this.segments.push(segment)
      if (segment.endSample - segment.startSample >= LIMITS.short)
        this.queue({
          segmentId: segment.id,
          startSample: Math.max(
            segment.startSample,
            segment.startSample +
              Math.floor(
                (segment.endSample - segment.startSample - LIMITS.window) / 480,
              ) *
                480,
          ),
          endSample: segment.endSample,
          final: true,
        })
    }
    this.active = null
    this.resampler = null
    this.decision = []
  }
  private discontinuity(
    reason: NonNullable<CaptureSegment['precedingGap']>['reason'],
  ): void {
    this.closeSegment()
    this.gap = { reason, wallDurationMs: null }
    this.gapAt = performance.now()
  }
  private timeline(segmentId: number): RollingTimeline {
    let ledger = this.timelines.get(segmentId)
    const segment =
      this.segments.find((s) => s.id === segmentId) ??
      (this.active?.id === segmentId ? this.active : null)
    if (!segment) throw failure('Missing segment ledger')
    if (!ledger) {
      ledger = new RollingTimeline(
        this.getKey(),
        segmentId,
        segment.startSample,
      )
      this.timelines.set(segmentId, ledger)
    }
    return ledger
  }
  private queue(job: Job): void {
    if (this.stopped || this.ended) return
    if (this.pending) this.skipped++
    this.pending = job
    this.highWater = Math.max(this.highWater, (this.running ? 1 : 0) + 1)
    void this.pump()
  }
  private async pump(): Promise<void> {
    if (this.running || this.refining || !this.pending) return
    const job = this.pending
    this.pending = null
    this.running = job
    try {
      const output = await this.analyze(job, 'live', performance.now() + 5000)
      const previous = this.timeline(job.segmentId),
        ledger = previous.fork()
      if (
        (this.segments.find((s) => s.id === job.segmentId)?.channel ??
          this.active?.channel) !== this.channel
      )
        output.result.warnings.push({
          code: 'channel_cancellation',
          message: `Stereo cancellation detected; using the ${this.chosen} channel for this segment.`,
        })
      if (
        (this.segments.find((s) => s.id === job.segmentId)?.sourceRateHz ??
          this.rate) < 24000
      )
        output.result.warnings.push({
          code: 'limited_bandwidth',
          message:
            'The source rate is below 24 kHz; high-frequency evidence is limited.',
        })
      const patch = ledger.apply(
        output.result,
        job.startSample,
        job.endSample,
        job.final,
      )
      this.timelines.set(job.segmentId, ledger)
      try {
        this.snapshot(true)
      } catch (error) {
        this.timelines.set(job.segmentId, previous)
        throw error
      }
      if (patch) this.event({ type: 'timeline', patch })
    } catch (error) {
      this.fail(error)
      this.pending = null
      this.forceStop()
    } finally {
      this.running = null
      if (this.pending) void this.pump()
      else {
        for (const resolve of this.drainWaiters) resolve()
        this.drainWaiters = []
      }
    }
  }
  private status(checkHealth = false): void {
    if (!this.key) return
    const analyzedThroughSample = Math.max(
      0,
      ...[...this.timelines.values()].map((l) => l.settledThrough),
    )
    if (checkHealth && this.begunAt && !this.ended && !this.paused) {
      this.lagReports =
        this.recording.length - analyzedThroughSample > 72000
          ? this.lagReports + 1
          : 0
      if (this.lagReports >= 3) {
        this.fail(
          failure(
            'Live analysis cannot keep up; captured audio retained',
            'ANALYSIS_TOO_SLOW',
          ),
        )
        this.forceStop()
      }
      if (performance.now() - this.begunAt >= 1800000) {
        this.fail(
          failure('Thirty-minute session limit reached', 'LIMIT_EXCEEDED'),
        )
        this.forceStop()
      }
    }
    this.event({
      type: 'status',
      key: this.key,
      capturedSamples: this.recording.length,
      captureEpoch: this.captureEpoch,
      ...(this.active &&
      !this.paused &&
      !this.ended &&
      this.recording.length > this.active.startSample
        ? {
            capturePosition: {
              segmentId: this.active.id,
              sample: this.recording.length,
            },
          }
        : {}),
      analyzedThroughSample,
      queuedBlocks: (this.running ? 1 : 0) + (this.pending ? 1 : 0),
      processingMs: this.processingMs,
      wasmBytes: this.wasmBytes,
      ownedJsBytes: this.ownedBytes(),
      queuedHighWater: this.highWater,
      skippedWindows: this.skipped,
    })
  }
  private forceStop(): void {
    if (this.ended) return
    this.ended = true
    this.closeSegment()
    this.paused = true
    this.resolveEnd?.()
    this.resolveEnd = null
    void this.stop().catch((error) => this.fail(error))
  }
  stop(): Promise<LocalAnalysis> {
    if (this.stopPromise) return this.stopPromise
    this.stopPromise = (async () => {
      if (!this.ended)
        await new Promise<void>((resolve) => {
          this.resolveEnd = resolve
          this.stopWatchdog = setTimeout(() => {
            this.partial = true
            this.closeSegment()
            this.ended = true
            this.paused = true
            resolve()
            this.resolveEnd = null
          }, 1000)
        })
      if (this.stopWatchdog) clearTimeout(this.stopWatchdog)
      if (this.running || this.pending)
        await new Promise<void>((resolve) => this.drainWaiters.push(resolve))
      this.stopped = true
      this.stoppedAnalysis = this.snapshot()
      this.event({
        type: 'stopped',
        key: this.getKey(),
        analysis: this.stoppedAnalysis,
      })
      return this.stoppedAnalysis
    })()
    return this.stopPromise
  }
  private snapshot(includeActive = false): LocalAnalysis {
    const results: LocalAnalysis['results'] = [],
      missed: NonNullable<LocalAnalysis['missedLiveIntervals']> = []
    const segments = [
      ...this.segments,
      ...(includeActive &&
      this.active &&
      this.active.endSample > this.active.startSample
        ? [this.active]
        : []),
    ]
    for (const segment of segments) {
      const ledger = this.timelines.get(segment.id)
      if (ledger) {
        results.push({
          segmentId: segment.id,
          offsetSample: segment.startSample,
          ...ledger.snapshot(
            segment.endSample,
            this.engineVersion,
            this.getOptions(),
          ),
        })
        missed.push(...ledger.missed)
        if (ledger.analyzedEnd < segment.endSample)
          missed.push({
            segmentId: segment.id,
            startSample: ledger.analyzedEnd,
            endSample: segment.endSample,
          })
      } else
        missed.push({
          segmentId: segment.id,
          startSample: segment.startSample,
          endSample: segment.endSample,
        })
    }
    return parseLocalAnalysis({
      schemaVersion: 1,
      engineVersion: this.engineVersion,
      options: this.getOptions(),
      durationSamples: this.recording.length,
      segments,
      results,
      missedLiveIntervals: coalesceMissed(missed),
      completeness: this.partial ? 'partial' : 'live',
    })
  }
  refine(): Promise<LocalAnalysis> {
    return this.beginRefinement(false)
  }
  async retryRetainedRefinement(
    canceled: () => boolean = () => false,
  ): Promise<LocalAnalysis> {
    if (this.retryQueued || !this.cancelRefine || !this.refinePromise)
      throw failure('No canceled refinement is available for retained retry')
    this.retryQueued = true
    try {
      await this.refinePromise.catch(() => {})
      await this.awaitInputRelease()
      if (canceled()) throw failure('Retained retry canceled', 'CANCELED')
      if (this.refineOutcome !== 'canceled')
        throw failure('Previous refinement did not settle canceled')
      return await this.beginRefinement(true)
    } finally {
      this.retryQueued = false
    }
  }
  private beginRefinement(retry: boolean): Promise<LocalAnalysis> {
    if (
      this.refineOutcome === 'running' ||
      (this.refineUsed && !retry) ||
      this.heavy
    )
      return Promise.reject(
        failure('Refinement already requested or audio export busy'),
      )
    this.refineOutcome = 'running'
    const operation = this.runRefinement().catch((error: unknown) => {
      this.refineOutcome = this.cancelRefine ? 'canceled' : 'failed'
      throw error
    })
    this.refinePromise = operation
    return operation
  }
  private async runRefinement(): Promise<LocalAnalysis> {
    if (!this.stoppedAnalysis || !this.stopped)
      throw failure('Stop capture before refinement')
    if (
      this.stoppedAnalysis.engineVersion !== this.engineVersion &&
      !this.allowEngineChange
    )
      throw failure(
        'Saved engine version differs; explicitly reanalyze in a new session',
        'PROTOCOL_MISMATCH',
      )
    this.refineUsed = true
    this.refining = true
    this.cancelRefine = false
    this.heavy = true
    const deadline = performance.now() + 120000,
      results: LocalAnalysis['results'] = []
    try {
      await this.awaitInputRelease()
      for (const segment of this.segments) {
        if (this.cancelRefine) throw failure('Refinement canceled', 'CANCELED')
        if (segment.endSample - segment.startSample < LIMITS.short) continue
        const output = await this.analyze(
          {
            segmentId: segment.id,
            startSample: segment.startSample,
            endSample: segment.endSample,
            final: true,
          },
          'refine',
          deadline,
        )
        results.push({
          segmentId: segment.id,
          offsetSample: segment.startSample,
          ...output,
        })
      }
      if (this.cancelRefine) throw failure('Refinement canceled', 'CANCELED')
      const analysis = parseLocalAnalysis({
        ...this.stoppedAnalysis,
        engineVersion: this.engineVersion,
        results,
        completeness: this.segments.some(
          (s) => s.endSample - s.startSample < LIMITS.short,
        )
          ? 'partial'
          : 'refined',
      })
      this.stoppedAnalysis = analysis
      this.event({ type: 'refined', key: this.getKey(), analysis })
      this.refineOutcome = 'complete'
      return analysis
    } catch (error) {
      this.refineOutcome = this.cancelRefine ? 'canceled' : 'failed'
      throw error
    } finally {
      this.refining = false
      this.heavy = false
    }
  }
  cancelRefinement(deadline = Date.now() + 100): void {
    if (this.refining) {
      this.cancelRefine = true
      if (this.waiter)
        this.cancelInput(failure('Refinement canceled', 'CANCELED'), deadline)
      else if (this.engineBootReject) {
        this.inputBlocked = true
        this.killEngine(
          failure(
            'Canceled during engine initialization; release unproved',
            'CANCELED',
          ),
        )
      }
    }
  }
  async exportPcm(): Promise<{ pcm: Blob; pcmSha256: string }> {
    if (this.refining && this.refinePromise)
      await this.refinePromise.catch(() => {})
    await this.awaitInputRelease()
    if (!this.stopped || this.heavy)
      throw failure(
        'Stop capture and wait for refinement before exporting audio',
      )
    this.heavy = true
    try {
      const bytes = this.recording.length * 4
      // Canonical + f32 export + immutable Blob + subsequent UI WAV stay below 96 MiB at 300 s.
      this.checkBudget(bytes * 2)
      this.operationBytes = bytes * 2
      this.status()
      const samples = this.recording.copy(0, this.recording.length)
      const view = new DataView(samples.buffer)
      for (let i = 0; i < samples.length; i++)
        view.setFloat32(i * 4, samples[i], true)
      const digest = await crypto.subtle.digest('SHA-256', samples.buffer)
      const pcmSha256 = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
      return {
        pcm: new Blob([samples.buffer], { type: 'application/octet-stream' }),
        pcmSha256,
      }
    } finally {
      this.heavy = false
      this.operationBytes = 0
      this.status()
    }
  }
  async restore(
    saved: LocalAnalysis,
    pcm: Blob,
    sha: string,
    allowEngineChange = false,
  ): Promise<void> {
    if (saved.engineVersion !== this.engineVersion && !allowEngineChange)
      throw failure(
        'Saved engine version differs; choose Reanalyze with current engine',
        'PROTOCOL_MISMATCH',
      )
    this.allowEngineChange = allowEngineChange
    if (this.port || this.recording.length || this.stopped || this.heavy)
      throw failure('Cannot restore an active session')
    if (pcm.size !== saved.durationSamples * 4 || pcm.size > LIMITS.samples * 4)
      throw failure('Saved PCM size mismatch')
    this.heavy = true
    try {
      this.checkBudget(pcm.size * 2)
      this.operationBytes = pcm.size * 2
      this.status()
      const bytes = await pcm.arrayBuffer(),
        digest = await crypto.subtle.digest('SHA-256', bytes)
      const hash = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
      if (hash !== sha) throw failure('Saved PCM hash mismatch')
      const view = new DataView(bytes)
      // Decode little endian explicitly even on a host with another byte order.
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK * 4) {
        const samples = new Float32Array(
          Math.min(CHUNK, (bytes.byteLength - offset) / 4),
        )
        for (let i = 0; i < samples.length; i++)
          samples[i] = view.getFloat32(offset + i * 4, true)
        finitePcm(samples)
        this.recording.append(samples)
      }
      this.options = saved.options
      this.segments = saved.segments
      this.stoppedAnalysis = saved
      this.stopped = true
      this.ended = true
      this.stopPromise = Promise.resolve(saved)
    } finally {
      this.heavy = false
      this.operationBytes = 0
      this.status()
    }
  }
  dispose(): void {
    this.cancelRefinement()
    this.killEngine(failure('Session disposed', 'CANCELED'))
    if (this.statusTimer) clearInterval(this.statusTimer)
    if (this.stopWatchdog) clearTimeout(this.stopWatchdog)
    this.resolveEnd?.()
    this.resolveEnd = null
    this.port?.close()
    this.port = null
    this.recording.release()
    this.timelines.clear()
    this.segments = []
    this.decision = []
  }
}

// Worker RPC: no queue of expensive operations; the facade also caps pending requests.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const runtime = new IngestRuntime((value, transfer = []) =>
    self.postMessage(value, { transfer }),
  )
  let current: Key | null = null
  const requests = new Set<number>()
  let lastRequestId = -1
  let activeRefinement: { id: number; canceled: boolean } | null = null
  self.onmessage = (event: MessageEvent<unknown>) => {
    void (async () => {
      let requestId = -1,
        key: Key | null = null
      let added = false
      try {
        const v = object(event.data)
        key = parseKey(v)
        if (v.type === 'cancel_refinement') {
          if (
            current &&
            sameKey(current, key) &&
            activeRefinement &&
            activeRefinement.id === v.refinementRequestId
          ) {
            activeRefinement.canceled = true
            runtime.cancelRefinement(integer(v.cleanupDeadline))
          }
          return
        }
        requestId = integer(v.requestId)
        if (current && !sameKey(current, key)) return
        if (
          requestId <= lastRequestId ||
          requests.has(requestId) ||
          requests.size >= 8
        )
          throw failure(
            'Runtime request capacity exceeded',
            'PROTOCOL_MISMATCH',
          )
        requests.add(requestId)
        added = true
        lastRequestId = requestId
        let value: unknown = null
        if (v.type === 'prepare') {
          if (current) throw failure('Already prepared')
          current = key
          await runtime.prepare(key, parseOptions(v.options))
        } else if (v.type === 'attach') {
          if (!(v.port instanceof MessagePort))
            throw failure('Invalid capture port')
          runtime.attach(v.port, choice(v.channel, ['mean', 'left', 'right']))
        } else if (v.type === 'stop') value = await runtime.stop()
        else if (
          v.type === 'refine' ||
          v.type === 'retry_retained_refinement'
        ) {
          // Only an explicit retry may take over a canceled request's route.
          // A rejected concurrent request must not replace the live owner.
          if (
            activeRefinement &&
            !(
              activeRefinement.canceled &&
              v.type === 'retry_retained_refinement'
            )
          )
            throw failure('Refinement already requested', 'PROTOCOL_MISMATCH')
          const attempt = { id: requestId, canceled: false }
          activeRefinement = attempt
          try {
            value =
              v.type === 'refine'
                ? await runtime.refine()
                : await runtime.retryRetainedRefinement(() => attempt.canceled)
          } finally {
            if (activeRefinement === attempt) activeRefinement = null
          }
        } else if (v.type === 'export') value = await runtime.exportPcm()
        else if (v.type === 'restore') {
          if (!(v.pcm instanceof Blob)) throw failure('Invalid saved PCM')
          await runtime.restore(
            parseLocalAnalysis(v.saved),
            v.pcm,
            parseHash(v.pcmSha256),
            v.allowEngineChange === true,
          )
        } else throw failure('Unknown runtime request', 'PROTOCOL_MISMATCH')
        self.postMessage({ ...key, type: 'reply', requestId, ok: true, value })
      } catch (error) {
        if (key && requestId >= 0)
          self.postMessage({
            ...key,
            type: 'reply',
            requestId,
            ok: false,
            code: errorCode(error),
            message: message(error),
          })
      } finally {
        if (added) requests.delete(requestId)
      }
    })()
  }
}
