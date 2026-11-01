import workletUrl from './capture.worklet.js?url'
import type { GapReason, Key, LiveRuntime } from './protocol'

export type CaptureSource = 'tab' | 'microphone'
export type CaptureChannel = 'mean' | 'left' | 'right'
export type CaptureNotice =
  | { type: 'level'; rms: number; droppedFrames: number }
  | { type: 'paused'; reason: GapReason; message: string }
  | { type: 'ended'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'started'; sampleRateHz: number; channels: number }
export type CaptureCapabilities = {
  available: boolean
  tab: boolean
  microphone: boolean
  reason: string | null
}
export function captureCapabilities(): CaptureCapabilities {
  const available =
    globalThis.isSecureContext === true &&
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof WebAssembly !== 'undefined'
  return {
    available,
    tab:
      available &&
      typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    microphone:
      available && typeof navigator.mediaDevices?.getUserMedia === 'function',
    reason: available
      ? null
      : 'Local capture needs a secure browser with AudioWorklet and WebAssembly. Try current desktop Chrome or Edge.',
  }
}
function abortError() {
  return new DOMException('Capture canceled.', 'AbortError')
}
function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}
export function captureErrorMessage(error: unknown): string {
  if (
    error instanceof DOMException &&
    ['NotAllowedError', 'SecurityError'].includes(error.name)
  )
    return 'Sharing did not start. Choose a source again, or use a microphone. Check your browser’s audio permission.'
  if (
    error instanceof DOMException &&
    ['NotFoundError', 'OverconstrainedError'].includes(error.name)
  )
    return 'That audio input is unavailable. Reconnect it or choose another input.'
  return error instanceof Error
    ? error.message
    : 'Capture could not start. Choose a source again.'
}

/** Owns the entire capture lease, including late permission responses and unused video tracks. */
export class LiveCapture {
  private generation = 0
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private cleanups: (() => void)[] = []
  private stopped: Promise<boolean> | null = null
  private stopFinish: (() => void) | null = null
  private paused = false
  private ending = false
  private wallTimer: ReturnType<typeof setTimeout> | null = null
  private readonly notice: (event: CaptureNotice) => void
  constructor(notice: (event: CaptureNotice) => void) {
    this.notice = notice
  }

  // Called directly by the Start click: the picker is invoked before any await.
  async start(
    source: CaptureSource,
    key: Key,
    runtime: LiveRuntime,
    channel: CaptureChannel,
    deviceId = '',
  ): Promise<void> {
    this.dispose()
    const generation = ++this.generation
    this.ending = false
    this.stopped = null
    this.paused = false
    const devices = navigator.mediaDevices
    const pending =
      source === 'tab'
        ? devices.getDisplayMedia({ video: true, audio: true })
        : devices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            },
          })
    // Attach ownership immediately so even a context constructor failure cannot leak a late stream.
    const owned = pending.then((stream) => {
      if (generation !== this.generation || this.ending) {
        stopStream(stream)
        throw abortError()
      }
      this.stream = stream
      return stream
    })
    try {
      const context = new AudioContext()
      this.context = context
      const resume = context.resume()
      void resume.catch(() => {})
      const stream = await owned
      await resume
      this.assertCurrent(generation)
      const track = stream
        .getAudioTracks()
        .find((candidate) => candidate.readyState === 'live')
      if (!track)
        throw new Error(
          'No audio was shared. Choose a browser tab and turn on Share audio, or use a microphone.',
        )
      if (
        !Number.isInteger(context.sampleRate) ||
        context.sampleRate < 8000 ||
        context.sampleRate > 96000
      )
        throw new Error(
          'This input’s sample rate is unsupported. Choose an input between 8 and 96 kHz.',
        )
      const settings = track.getSettings()
      if (
        settings.echoCancellation ||
        settings.noiseSuppression ||
        settings.autoGainControl
      )
        this.notice({
          type: 'warning',
          message:
            'Your browser kept microphone processing enabled; it may alter the music.',
        })
      const channels = settings.channelCount ?? 2
      if (channels === 1 && channel !== 'mean')
        this.notice({
          type: 'warning',
          message:
            'This source exposes only one channel. The selected channel uses that mono input.',
        })
      if (channels > 2)
        this.notice({
          type: 'warning',
          message:
            'Using the first stereo pair of this multi-channel interface. Choose Left or Right for a single instrument.',
        })
      if (context.sampleRate < 24000)
        this.notice({
          type: 'warning',
          message: 'This input has limited bandwidth below 24 kHz.',
        })
      await context.audioWorklet.addModule(workletUrl)
      this.assertCurrent(generation)
      const node = new AudioWorkletNode(context, 'fretbloom-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: Math.min(2, channels),
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      })
      this.worklet = node
      const ports = new MessageChannel()
      runtime.attachCapturePort(ports.port2, { channel })
      node.port.postMessage(
        {
          type: 'init',
          key,
          port: ports.port1,
          channels: channel === 'mean' && channels > 1 ? 2 : 1,
          channel,
        },
        [ports.port1],
      )
      node.port.onmessage = (event: MessageEvent<unknown>) => {
        const v = event.data
        if (!v || typeof v !== 'object' || !('type' in v)) return
        if (
          v.type === 'meter' &&
          'rms' in v &&
          typeof v.rms === 'number' &&
          Number.isFinite(v.rms) &&
          'droppedFrames' in v &&
          typeof v.droppedFrames === 'number'
        )
          this.notice({
            type: 'level',
            rms: Math.max(0, Math.min(1, v.rms)),
            droppedFrames: v.droppedFrames,
          })
      }
      this.source = context.createMediaStreamSource(new MediaStream([track]))
      this.source.connect(node)
      node.connect(context.destination)
      const onEnded = () => {
        if (!this.ending) {
          this.notice({
            type: 'ended',
            message: 'The shared source ended. Captured results are kept.',
          })
          void this.stop()
        }
      }
      for (const ownedTrack of stream.getTracks())
        this.listen(ownedTrack, 'ended', onEnded)
      this.listen(track, 'mute', () =>
        this.interrupt(
          'muted',
          'Audio interrupted. Resume when the source is available.',
        ),
      )
      this.listen(track, 'unmute', () =>
        this.notice({
          type: 'warning',
          message:
            'Audio is available again. Choose Resume to continue in a new segment.',
        }),
      )
      this.listen(context, 'statechange', () => {
        if (context.state !== 'running' && !this.ending)
          this.interrupt(
            'context_suspended',
            'Audio context interrupted. Choose Resume to continue.',
          )
      })
      this.listen(navigator.mediaDevices, 'devicechange', () => {
        if (track.readyState === 'ended') onEnded()
      })
      this.listen(window, 'pagehide', () => this.dispose())
      this.listen(document, 'visibilitychange', () => {
        if (!document.hidden)
          this.notice({
            type: 'warning',
            message:
              'Returned to Listen. Background capture may have been interrupted; gaps are marked separately.',
          })
      })
      this.wallTimer = setTimeout(
        () => {
          this.notice({
            type: 'ended',
            message:
              'The 30-minute wall-time limit was reached. Captured results are kept.',
          })
          void this.stop()
        },
        30 * 60 * 1000,
      )
      if (track.muted)
        this.interrupt(
          'muted',
          'Audio interrupted. Choose Resume when your source is ready.',
        )
      this.notice({
        type: 'started',
        sampleRateHz: context.sampleRate,
        channels,
      })
    } catch (error) {
      if (generation === this.generation) this.dispose()
      void owned.catch(() => {})
      throw error
    }
  }
  private assertCurrent(generation: number) {
    if (generation !== this.generation || this.ending) throw abortError()
  }
  private listen(target: EventTarget, type: string, callback: EventListener) {
    target.addEventListener(type, callback)
    this.cleanups.push(() => target.removeEventListener(type, callback))
  }
  private interrupt(reason: GapReason, message: string) {
    if (this.ending || this.paused) return
    this.paused = true
    this.worklet?.port.postMessage({
      type: 'boundary',
      action: 'pause',
      reason,
    })
    this.notice({ type: 'paused', reason, message })
  }
  pause(reason: GapReason = 'paused') {
    this.interrupt(reason, 'Capture paused. Resume starts a new segment.')
  }
  async resume() {
    const generation = this.generation
    if (!this.context || !this.paused || this.ending) return
    if (
      this.stream
        ?.getAudioTracks()
        .some((track) => track.muted || track.readyState === 'ended')
    )
      throw new Error(
        'The input is still interrupted. Reconnect it or stop this capture.',
      )
    await this.context.resume()
    this.assertCurrent(generation)
    this.worklet?.port.postMessage({
      type: 'boundary',
      action: 'resume',
      reason: 'paused',
    })
    this.paused = false
  }
  stop(): Promise<boolean> {
    if (this.stopped) return this.stopped
    this.ending = true
    if (this.stream) stopStream(this.stream)
    if (!this.worklet) {
      this.dispose()
      return Promise.resolve(false)
    }
    const node = this.worklet
    this.stopped = new Promise<boolean>((resolve) => {
      let done = false
      const finish = (acknowledged: boolean) => {
        if (done) return
        done = true
        this.stopFinish = null
        clearTimeout(timer)
        node.port.removeEventListener('message', onAck)
        this.release()
        resolve(acknowledged)
      }
      const onAck = (event: MessageEvent<unknown>) => {
        const data = event.data
        if (
          data &&
          typeof data === 'object' &&
          'type' in data &&
          data.type === 'boundary_ack' &&
          'action' in data &&
          data.action === 'end'
        )
          finish(true)
      }
      this.stopFinish = () => finish(false)
      const timer = setTimeout(() => finish(false), 1000)
      node.port.addEventListener('message', onAck)
      node.port.postMessage({
        type: 'boundary',
        action: 'end',
        reason: 'user_stop',
      })
    })
    return this.stopped
  }
  private release() {
    if (this.wallTimer) clearTimeout(this.wallTimer)
    this.wallTimer = null
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    if (this.stream) stopStream(this.stream)
    this.stream = null
    this.source?.disconnect()
    this.source = null
    this.worklet?.disconnect()
    this.worklet?.port.close()
    this.worklet = null
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
  }
  dispose() {
    ++this.generation
    this.ending = true
    this.stopFinish?.()
    this.release()
  }
}
