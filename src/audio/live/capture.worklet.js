// @ts-check
/// <reference path="./captureWorkletTypes.d.ts" />

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Copy-only transport. Eight reusable credits bound queued audio; output is always silent. */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    /** @type {MessagePort | null} */
    this.transport = null
    this.key = { sessionId: '', generation: 0 }
    this.channels = 2
    this.channel = 'mean'
    /** @type {ArrayBuffer[]} */
    this.pool = []
    /** @type {Float32Array | null} */
    this.block = null
    this.used = 0
    this.firstFrame = 0
    this.frame = 0
    this.sequence = 0
    this.paused = false
    this.ended = false
    this.meterFrames = 0
    this.energy = 0
    this.dropped = 0
    /** @type {Set<number>} */
    this.outstanding = new Set()
    /** @type {Map<number, string>} */
    this.boundaries = new Map()
    this.finished = false
    this.port.onmessage = (event) => {
      /** @type {unknown} */
      const data = event.data
      if (!record(data)) return
      if (
        data?.type === 'init' &&
        data.port instanceof MessagePort &&
        record(data.key) &&
        typeof data.key.sessionId === 'string' &&
        /^[a-f0-9-]{36}$/i.test(data.key.sessionId) &&
        typeof data.key.generation === 'number' &&
        Number.isSafeInteger(data.key.generation) &&
        data.key.generation >= 0 &&
        ['mean', 'left', 'right'].includes(String(data.channel)) &&
        (data.channels === 1 || data.channels === 2) &&
        !this.transport
      ) {
        this.key = {
          sessionId: data.key.sessionId,
          generation: data.key.generation,
        }
        this.channel = String(data.channel)
        this.channels = data.channels === 1 ? 1 : 2
        const transport = data.port
        this.transport = transport
        for (let i = 0; i < 8; i++)
          this.pool.push(new ArrayBuffer(2048 * this.channels * 4))
        transport.onmessage = (reply) => {
          /** @type {unknown} */
          const value = reply.data
          if (
            !record(value) ||
            typeof value.sequence !== 'number' ||
            !Number.isSafeInteger(value.sequence) ||
            value.sequence < 0
          )
            return
          if (
            value?.type === 'boundary_ack' &&
            value.sessionId === this.key.sessionId &&
            value.generation === this.key.generation &&
            this.boundaries.get(value.sequence) === value.action
          ) {
            this.boundaries.delete(value.sequence)
            if (value.action === 'end') this.finished = true
            this.port.postMessage(value)
            return
          }
          if (
            value?.type !== 'credit' ||
            value.sessionId !== this.key.sessionId ||
            value.generation !== this.key.generation ||
            !(value.recycled instanceof ArrayBuffer) ||
            !this.outstanding.has(value.sequence) ||
            this.pool.length >= 8 ||
            value.recycled.byteLength === 0 ||
            value.recycled.byteLength > 2048 * this.channels * 4
          )
            return
          this.outstanding.delete(value.sequence)
          this.pool.push(
            value.recycled.byteLength === 2048 * this.channels * 4
              ? value.recycled
              : new ArrayBuffer(2048 * this.channels * 4),
          )
        }
        transport.start()
        this.port.postMessage({ type: 'initialized' })
      } else if (
        data?.type === 'boundary' &&
        this.transport &&
        !this.ended &&
        typeof data.action === 'string' &&
        ['pause', 'resume', 'end'].includes(data.action) &&
        typeof data.reason === 'string' &&
        [
          'paused',
          'muted',
          'context_suspended',
          'transport_overflow',
          'device_changed',
          'background_interruption',
          'user_stop',
        ].includes(data.reason)
      ) {
        this.flush()
        const sequence = this.sequence++
        this.boundaries.set(sequence, data.action)
        this.transport.postMessage({
          ...this.key,
          type: 'boundary',
          sequence,
          frame: this.frame,
          action: data.action,
          reason: data.reason,
        })
        this.paused = data.action !== 'resume'
        this.ended = data.action === 'end'
        // Only ingestion acknowledges: a local post is not an end barrier.
      }
    }
  }

  flush() {
    if (!this.block || !this.used || !this.transport) return
    const interleaved =
      this.used === 2048
        ? this.block.buffer
        : this.block.buffer.slice(0, this.used * this.channels * 4)
    const sequence = this.sequence++
    this.outstanding.add(sequence)
    this.transport.postMessage(
      {
        ...this.key,
        type: 'pcm',
        sequence,
        firstFrame: this.firstFrame,
        frameCount: this.used,
        sampleRateHz: sampleRate,
        channels: this.channels,
        interleaved,
      },
      [interleaved],
    )
    this.block = null
    this.used = 0
  }

  /** @param {Float32Array[][]} inputs @param {Float32Array[][]} outputs */
  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0)
    if (this.finished) return false
    if (this.ended) return true
    const input = inputs[0]
    const frames = input?.[0]?.length ?? outputs[0]?.[0]?.length ?? 128
    if (!this.transport || this.paused) {
      this.frame += frames
      return true
    }
    for (let i = 0; i < frames; i++) {
      if (!this.block) {
        const buffer = this.pool.pop()
        if (!buffer) {
          this.dropped++
          this.frame++
          continue
        }
        this.block = new Float32Array(buffer)
        this.firstFrame = this.frame
      }
      const left = input?.[0]?.[i] ?? 0
      const right = input?.[1]?.[i] ?? left
      this.block[this.used * this.channels] =
        this.channel === 'right' ? right : left
      if (this.channels === 2) this.block[this.used * 2 + 1] = right
      this.energy += (left * left + right * right) / 2
      this.meterFrames++
      this.frame++
      if (++this.used === 2048) this.flush()
    }
    if (this.meterFrames >= sampleRate / 10) {
      this.port.postMessage({
        type: 'meter',
        rms: Math.sqrt(this.energy / this.meterFrames),
        droppedFrames: this.dropped,
        frame: this.frame,
      })
      this.energy = 0
      this.meterFrames = 0
    }
    return true
  }
}
registerProcessor('fretbloom-capture', CaptureProcessor)
