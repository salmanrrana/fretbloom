/** Streaming 64-tap windowed sinc. Output positions use the original source clock. */
export class SincResampler {
  readonly inputRate: number
  private data: Float32Array = new Float32Array(0)
  private base = 0
  private total = 0
  private output = 0
  private ended = false
  constructor(inputRate: number) {
    if (!Number.isInteger(inputRate) || inputRate < 8000 || inputRate > 96000)
      throw new Error('Unsupported source sample rate')
    this.inputRate = inputRate
  }
  push(input: Float32Array): Float32Array {
    if (this.ended) throw new Error('Resampler ended')
    if (input.length > 96000) throw new Error('Resampler block too large')
    for (const x of input)
      if (!Number.isFinite(x)) throw new Error('Nonfinite source sample')
    const next = new Float32Array(this.data.length + input.length)
    next.set(this.data)
    next.set(input, this.data.length)
    this.data = next
    this.total += input.length
    return this.drain(false)
  }
  finish(): Float32Array {
    if (this.ended) return new Float32Array(0)
    this.ended = true
    return this.drain(true)
  }
  get inputFrames(): number {
    return this.total
  }
  get outputSamples(): number {
    return this.output
  }
  get ownedBytes(): number {
    return this.data.byteLength
  }
  private drain(final: boolean): Float32Array {
    const ratio = this.inputRate / 24000,
      target = Math.floor((this.total * 24000) / this.inputRate)
    const count = final
      ? target
      : Math.max(
          this.output,
          Math.min(target, Math.ceil((this.total - 32) / ratio)),
        )
    const out = new Float32Array(count - this.output),
      cutoff = (0.45 * Math.min(this.inputRate, 24000)) / this.inputRate
    for (let j = 0; j < out.length; j++) {
      const position = this.output * ratio,
        center = Math.floor(position)
      let sum = 0,
        weight = 0
      for (let tap = -31; tap <= 32; tap++) {
        const index = center + tap,
          distance = index - position,
          u = distance / 32
        const window =
          Math.abs(u) >= 1
            ? 0
            : 0.42 +
              0.5 * Math.cos(Math.PI * u) +
              0.08 * Math.cos(2 * Math.PI * u)
        const sinc =
          distance === 0
            ? 2 * cutoff
            : Math.sin(2 * Math.PI * cutoff * distance) / (Math.PI * distance)
        const w = sinc * window
        weight += w
        if (index >= 0 && index < this.total)
          sum += this.data[index - this.base] * w
      }
      out[j] = sum / weight
      this.output++
    }
    const keep = Math.max(this.base, Math.floor(this.output * ratio) - 32),
      consumed = Math.min(this.data.length, keep - this.base)
    this.data = this.data.slice(consumed)
    this.base += consumed
    return out
  }
}
