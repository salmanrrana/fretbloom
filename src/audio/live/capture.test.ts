import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveCapture } from './capture'
import type { LiveRuntime } from './protocol'

class Track extends EventTarget {
  readyState = 'live'
  muted = false
  stop = vi.fn(() => {
    this.readyState = 'ended'
  })
  readonly kind: 'audio' | 'video'
  constructor(kind: 'audio' | 'video') {
    super()
    this.kind = kind
  }
  getSettings() {
    return { channelCount: 2 }
  }
}
class Stream {
  readonly tracks: Track[]
  constructor(tracks: Track[]) {
    this.tracks = tracks
  }
  getTracks() {
    return this.tracks
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio')
  }
}
class Context extends EventTarget {
  static all: Context[] = []
  sampleRate = 48000
  state = 'running'
  destination = {}
  audioWorklet = { addModule: vi.fn(async () => {}) }
  node = { connect: vi.fn(), disconnect: vi.fn() }
  constructor() {
    super()
    Context.all.push(this)
  }
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createMediaStreamSource = vi.fn(() => this.node)
}
class Node {
  static all: Node[] = []
  port = new EventTargetPort()
  connect = vi.fn()
  disconnect = vi.fn()
  constructor() {
    Node.all.push(this)
  }
}
class EventTargetPort extends EventTarget {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  close = vi.fn()
  start = vi.fn()
  postMessage = vi.fn()
  reply(data: unknown) {
    const event = new MessageEvent('message', { data })
    this.dispatchEvent(event)
    this.onmessage?.(event)
  }
}
const key = { sessionId: '35e8c4cf-27f6-4ada-b570-d4cba025f799', generation: 1 }
function runtime(): LiveRuntime {
  return {
    attachCapturePort: vi.fn(),
    prepare: vi.fn(),
    restore: vi.fn(),
    stop: vi.fn(),
    refine: vi.fn(),
    retryRetainedRefinement: vi.fn(),
    exportPcm: vi.fn(),
    cancelRefinement: vi.fn(),
    dispose: vi.fn(),
  }
}
beforeEach(() => {
  Context.all = []
  Node.all = []
  vi.stubGlobal('AudioContext', Context)
  vi.stubGlobal('AudioWorkletNode', Node)
  vi.stubGlobal('MediaStream', Stream)
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = new EventTargetPort()
      port2 = new EventTargetPort()
    },
  )
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', new EventTarget())
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function media(get: () => Promise<Stream>) {
  const devices = Object.assign(new EventTarget(), {
    getDisplayMedia: vi.fn(get),
    getUserMedia: vi.fn(get),
  })
  vi.stubGlobal('navigator', { mediaDevices: devices })
  return devices
}
describe('capture lease', () => {
  it('calls the tab picker in the direct handler and stops all late tracks after cancellation', async () => {
    let resolve: (stream: Stream) => void = () => {}
    const devices = media(
      () =>
        new Promise<Stream>((done) => {
          resolve = done
        }),
    )
    const capture = new LiveCapture(() => {})
    const pending = capture.start('tab', key, runtime(), 'mean')
    expect(devices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: true,
    })
    capture.dispose()
    const audio = new Track('audio')
    const video = new Track('video')
    resolve(new Stream([audio, video]))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(audio.stop).toHaveBeenCalled()
    expect(video.stop).toHaveBeenCalled()
    expect(Context.all[0].close).toHaveBeenCalled()
  })
  it('distinguishes no shared audio from a live silent track and keeps video owned until stop', async () => {
    const video = new Track('video')
    media(async () => new Stream([video]))
    await expect(
      new LiveCapture(() => {}).start('tab', key, runtime(), 'mean'),
    ).rejects.toThrow('No audio was shared')
    expect(video.stop).toHaveBeenCalled()
    const audio = new Track('audio')
    const keptVideo = new Track('video')
    media(async () => new Stream([audio, keptVideo]))
    const capture = new LiveCapture(() => {})
    await capture.start('tab', key, runtime(), 'mean')
    expect(keptVideo.stop).not.toHaveBeenCalled()
    const stopped = capture.stop()
    expect(audio.stop).toHaveBeenCalled()
    expect(keptVideo.stop).toHaveBeenCalled()
    // A local posted end is not sufficient. Ingestion must send the acknowledgment back.
    let settled = false
    void stopped.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    Node.all
      .at(-1)
      ?.port.reply({ type: 'boundary_ack', action: 'end', sequence: 0 })
    expect(await stopped).toBe(true)
    expect(Context.all.at(-1)?.close).toHaveBeenCalled()
  })
  it('requests unprocessed mic audio, passes channel selection once, and disposes a pending barrier promptly', async () => {
    const audio = new Track('audio')
    const devices = media(async () => new Stream([audio]))
    const engine = runtime()
    const capture = new LiveCapture(() => {})
    await capture.start('microphone', key, engine, 'right', 'interface')
    expect(devices.getUserMedia).toHaveBeenCalledWith({
      video: false,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        deviceId: { exact: 'interface' },
      },
    })
    expect(engine.attachCapturePort).toHaveBeenCalledWith(
      expect.any(EventTargetPort),
      { channel: 'right' },
    )
    const stopped = capture.stop()
    capture.dispose()
    expect(await stopped).toBe(false)
    expect(Node.all[0].disconnect).toHaveBeenCalled()
    expect(Node.all[0].port.close).toHaveBeenCalled()
  })
  it('rejects rates outside 8–96 kHz and cleans tracks and context', async () => {
    const audio = new Track('audio')
    media(async () => new Stream([audio]))
    let resolve: (stream: Stream) => void = () => {}
    media(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const capture = new LiveCapture(() => {})
    const pending = capture.start('microphone', key, runtime(), 'left')
    Context.all[0].sampleRate = 192000
    resolve(new Stream([audio]))
    await expect(pending).rejects.toThrow('unsupported')
    expect(audio.stop).toHaveBeenCalled()
  })
})
