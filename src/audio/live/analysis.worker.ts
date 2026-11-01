import * as portable from '../../generated/analysis-wasm/portable/fretbloom_wasm'
import portableUrl from '../../generated/analysis-wasm/portable/fretbloom_wasm_bg.wasm?url'
import {
  choice,
  number,
  object,
  string,
  AnalysisValidationError,
} from '../analysisV1'
import { LIMITS } from './protocol'
import type { EngineReply, EngineRequest, InputFence, Key } from './protocol'
import {
  parseEngineRequest,
  parseInputFence,
  parseKey,
  parseOutput,
  parseCode,
  sameKey,
} from './validation'

let state: 'new' | 'initializing' | 'ready' | 'busy' | 'failed' | 'closing' =
  'new'
let key: Key | null = null
let childId = -1
let lastRequestId = -1
let active: InputFence | null = null
let closeFailed = false
let version = ''
const send = (value: unknown) => self.postMessage(value)
function closeBackend(): boolean {
  try {
    portable.close()
    return true
  } catch {
    closeFailed = true
    return false
  }
}
async function initialize(initKey: Key) {
  try {
    await portable.initialize(portableUrl)
    const info = object(JSON.parse(portable.info()))
    choice(info.bridgeVersion, [2])
    choice(info.schemaVersion, [1])
    choice(info.sampleRateHz, [24000])
    choice(info.maxSamples, [LIMITS.samples])
    version = string(info.engineVersion, 100)
    state = 'ready'
    send({
      ...initKey,
      childId,
      type: 'engine_ready',
      engineVersion: version,
      wasmBytes: portable.memoryBytes(),
    })
  } catch {
    state = 'failed'
    closeBackend()
    send({
      ...initKey,
      childId,
      type: 'engine_failed',
      code: 'WASM_LOAD_FAILED',
      message: 'The local Rust engine could not load. Reload to retry.',
    })
  }
}
type Completion = { fence: InputFence; reply: EngineReply; releasable: boolean }
/** Sole payload helper. Its promise returns only metadata, never request/view/event roots. */
async function analyzeInput(
  request: EngineRequest,
  fence: InputFence,
): Promise<Completion> {
  let reply: EngineReply
  let releasable = true
  try {
    const start = performance.now()
    const pcm = new Float32Array(request.pcm)
    const text = await portable.analyze(
      pcm,
      24000,
      JSON.stringify(request.options),
    )
    const output = parseOutput(JSON.parse(text), pcm.length, version)
    if (portable.memoryBytes() > LIMITS.wasmBytes)
      throw new Error('WASM memory cap exceeded')
    reply = {
      ...fence,
      type: 'result',
      ...output,
      computeMs: number(performance.now() - start, 0, 120000),
      wasmBytes: portable.memoryBytes(),
    }
  } catch (error) {
    reply = {
      ...fence,
      type: 'error',
      code: 'ENGINE_CRASH',
      message:
        'The Rust engine stopped unexpectedly; retained audio is still available.',
    }
    if (error instanceof AnalysisValidationError)
      reply = {
        ...reply,
        code: 'PROTOCOL_MISMATCH',
        message:
          'The Rust engine returned invalid result boundaries; captured audio retained.',
      }
    if (typeof error === 'string') {
      try {
        const e = object(JSON.parse(error))
        reply = {
          ...reply,
          code: parseCode(e.code),
          message: string(e.message, 1000),
        }
      } catch {
        /* Keep the crash. */
      }
    }
    // A cancellation closes Asyncify before this helper unwinds. A trap or an
    // unrelated rejected initialization/suspension cannot certify release.
    releasable = state === 'closing' && !closeFailed
    if (state !== 'closing') {
      state = 'failed'
      closeBackend()
    }
  }
  return { fence, reply, releasable }
}
/** Runs only after analyzeInput has returned. No callback here closes over a payload. */
function finishInput(completion: Completion): void {
  const { fence, reply, releasable } = completion
  if (!active || active.requestId !== fence.requestId) return
  if (state !== 'closing') send(reply)
  active = null
  if (!releasable || closeFailed) return
  if (state === 'busy') state = 'ready'
  send({ ...fence, type: 'input_released' })
}
// This dispatcher is synchronous: it never retains MessageEvent across an await.
// Only one payload is accepted; no payload queue or .then closure captures it.
self.onmessage = (event: MessageEvent<unknown>) => {
  const v = object(event.data)
  if (v.type === 'init') {
    if (state !== 'new') return
    key = parseKey(v)
    childId = parseInputFence({
      ...v,
      requestId: 0,
      throughRequestId: 0,
    }).childId
    state = 'initializing'
    void initialize(key)
    return
  }
  if (!key || !sameKey(parseKey(v), key) || v.childId !== childId) return
  const fence = parseInputFence(v)
  if (v.type === 'cancel_input') {
    if (!active || active.requestId !== fence.requestId || state === 'closing')
      return
    state = 'closing'
    closeBackend()
    return
  }
  if (state !== 'ready' || fence.requestId <= lastRequestId) return
  const request = parseEngineRequest(v)
  active = fence
  lastRequestId = fence.requestId
  state = 'busy'
  void analyzeInput(request, fence).then(finishInput)
}
