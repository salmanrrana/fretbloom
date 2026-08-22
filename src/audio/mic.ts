export interface MicrophoneOption {
  deviceId: string
  label: string
}

/** Shared microphone capture: one stream, one analyser, many readers. */
export class MicInput {
  private ctx: AudioContext
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private buf: Float32Array<ArrayBuffer> | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  get active(): boolean {
    return this.analyser !== null
  }

  async start(deviceId?: string): Promise<void> {
    if (this.analyser) return
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is unavailable in this browser.')
    }

    // iOS requires resume() to happen inside the tap that starts capture.
    if (this.ctx.state === 'suspended') await this.ctx.resume()

    const supported = navigator.mediaDevices.getSupportedConstraints()
    const audio: MediaTrackConstraints = {}
    if (deviceId) audio.deviceId = { exact: deviceId }
    if (supported.channelCount) audio.channelCount = { ideal: 1 }
    if (supported.echoCancellation) audio.echoCancellation = false
    if (supported.noiseSuppression) audio.noiseSuppression = false
    if (supported.autoGainControl) audio.autoGainControl = false

    const stream = await navigator.mediaDevices.getUserMedia({ audio })
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      const source = this.ctx.createMediaStreamSource(stream)
      const analyser = this.ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      this.stream = stream
      this.source = source
      this.analyser = analyser
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop())
      throw error
    }
  }

  /** Available inputs become fully labeled after the user grants permission. */
  async inputs(): Promise<MicrophoneOption[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const devices = await navigator.mediaDevices.enumerateDevices()
    let unnamed = 0
    return devices
      .filter((device) => device.kind === 'audioinput' && device.deviceId !== 'default')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${++unnamed}`,
      }))
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
    this.stream?.getTracks().forEach((track) => track.stop())
    this.source?.disconnect()
    this.stream = null
    this.source = null
    this.analyser = null
    this.buf = null
  }
}
