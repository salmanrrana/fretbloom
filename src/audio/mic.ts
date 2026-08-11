/** Shared microphone capture: one stream, one analyser, many readers. */
export class MicInput {
  private ctx: AudioContext
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private buf: Float32Array<ArrayBuffer> | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  get active(): boolean {
    return this.analyser !== null
  }

  async start(): Promise<void> {
    if (this.analyser) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const source = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 4096
    source.connect(this.analyser)
  }

  /** Latest time-domain frame, or null if the mic is off. */
  frame(): Float32Array<ArrayBuffer> | null {
    if (!this.analyser) return null
    if (!this.buf || this.buf.length !== this.analyser.fftSize) {
      this.buf = new Float32Array(this.analyser.fftSize)
    }
    this.analyser.getFloatTimeDomainData(this.buf)
    return this.buf
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.analyser = null
  }
}
