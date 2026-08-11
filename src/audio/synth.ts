import { midiToFreq } from './notes'

/**
 * Plucked-string synth. Each note is rendered once with Karplus-Strong
 * into an AudioBuffer and cached, so triggering a chord is just
 * sample-accurate buffer playback — no per-frame work, no lag.
 */
export class PluckSynth {
  private ctx: AudioContext
  private cache = new Map<string, AudioBuffer>()
  readonly out: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0.9
  }

  private renderPluck(midi: number, seconds: number): AudioBuffer {
    const key = `${midi}:${seconds}`
    const hit = this.cache.get(key)
    if (hit) return hit

    const sr = this.ctx.sampleRate
    const length = Math.floor(sr * seconds)
    const buffer = this.ctx.createBuffer(1, length, sr)
    const data = buffer.getChannelData(0)

    const freq = midiToFreq(midi)
    const period = Math.max(2, Math.round(sr / freq))
    const delay = new Float32Array(period)
    // Excitation: noise, gently lowpassed so high strings aren't harsh.
    let prevNoise = 0
    for (let i = 0; i < period; i++) {
      const n = Math.random() * 2 - 1
      prevNoise = 0.55 * n + 0.45 * prevNoise
      delay[i] = prevNoise
    }

    // Karplus-Strong loop with a slight damping factor for a warm decay.
    const damp = 0.996
    let idx = 0
    let prev = 0
    for (let i = 0; i < length; i++) {
      const cur = delay[idx]
      const next = damp * 0.5 * (cur + prev)
      prev = cur
      delay[idx] = next
      data[i] = cur
      idx = (idx + 1) % period
    }

    // Fade the very end to avoid clicks.
    const fade = Math.min(length, Math.floor(sr * 0.02))
    for (let i = 0; i < fade; i++) {
      data[length - 1 - i] *= i / fade
    }

    this.cache.set(key, buffer)
    return buffer
  }

  /** Schedule a single plucked note at an absolute AudioContext time. */
  pluck(midi: number, when: number, gain = 0.5, seconds = 2.2): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.renderPluck(midi, seconds)
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(this.out)
    src.start(Math.max(when, this.ctx.currentTime))
  }

  /** Strum a set of midi notes with a small per-string stagger. */
  strum(midis: number[], when: number, spread = 0.045, gain = 0.42): void {
    midis.forEach((midi, i) => this.pluck(midi, when + i * spread, gain))
  }

  /** Arpeggiate notes evenly across a duration. */
  arpeggio(midis: number[], when: number, duration: number, gain = 0.5): void {
    const gap = duration / midis.length
    midis.forEach((midi, i) => this.pluck(midi, when + i * gap, gain, Math.min(3, duration)))
  }
}
