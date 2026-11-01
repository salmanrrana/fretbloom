import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { parseCaptureMessage } from './validation'

class Port {
  sent: unknown[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  postMessage(data: unknown, transfer: ArrayBuffer[] = []) {
    this.sent.push(structuredClone(data, { transfer }))
  }
  start() {}
  deliver(data: unknown) {
    this.onmessage?.({ data })
  }
}
interface Processor {
  port: Port
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}
function worklet(channel: 'mean' | 'left' | 'right' = 'mean', channels = 2) {
  let processor: Processor | null = null
  runInNewContext(
    readFileSync(new URL('./capture.worklet.js', import.meta.url), 'utf8'),
    {
      AudioWorkletProcessor: class {
        port = new Port()
      },
      MessagePort: Port,
      ArrayBuffer,
      Float32Array,
      sampleRate: 48000,
      registerProcessor: (_name: string, Constructor: new () => Processor) => {
        processor = new Constructor()
      },
    },
  )
  if (!processor) throw new Error('Worklet did not register')
  const instance: Processor = processor
  const transport = new Port()
  const key = {
    sessionId: '35e8c4cf-27f6-4ada-b570-d4cba025f799',
    generation: 1,
  }
  instance.port.deliver({
    type: 'init',
    key,
    port: transport,
    channel,
    channels,
  })
  return { instance, transport, key }
}
it('bounds credits at eight, records exact dropped frames, flushes partial blocks, and waits for ingestion end acknowledgment', () => {
  const { instance, transport, key } = worklet()
  const output = new Float32Array(2048).fill(1)
  for (let i = 0; i < 8; i++)
    instance.process(
      [[new Float32Array(2048).fill(0.25), new Float32Array(2048).fill(0.5)]],
      [[output]],
    )
  expect(output.every((value) => value === 0)).toBe(true)
  instance.process([[new Float32Array(100)]], [[new Float32Array(100)]])
  expect(transport.sent).toHaveLength(8)
  const first = parseCaptureMessage(transport.sent[0])
  if (first.type !== 'pcm') throw new Error('Expected PCM')
  expect(first.firstFrame).toBe(0)
  expect(first.frameCount).toBe(2048)
  transport.deliver({
    ...key,
    type: 'credit',
    sequence: 0,
    recycled: first.interleaved,
  })
  instance.process(
    [[new Float32Array(137).fill(0.25), new Float32Array(137).fill(0.5)]],
    [[new Float32Array(137)]],
  )
  instance.port.deliver({
    type: 'boundary',
    action: 'end',
    reason: 'user_stop',
  })
  const partial = parseCaptureMessage(transport.sent[8])
  const end = parseCaptureMessage(transport.sent[9])
  expect(partial).toMatchObject({
    type: 'pcm',
    firstFrame: 16484,
    frameCount: 137,
    sequence: 8,
  })
  if (partial.type !== 'pcm' || end.type !== 'boundary')
    throw new Error('Expected partial/end')
  expect(partial.interleaved.byteLength).toBe(137 * 2 * 4)
  expect(end).toMatchObject({ frame: 16621, sequence: 9 })
  expect(
    instance.port.sent.some(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'boundary_ack',
    ),
  ).toBe(false)
  expect(instance.process([], [[new Float32Array(128)]])).toBe(true)
  transport.deliver({
    ...key,
    type: 'boundary_ack',
    sequence: 9,
    action: 'end',
  })
  expect(instance.port.sent.at(-1)).toMatchObject({
    type: 'boundary_ack',
    sequence: 9,
    action: 'end',
  })
  expect(instance.process([], [[new Float32Array(128)]])).toBe(false)
})
it('selects an interface channel exactly once and refuses duplicate recycled credits', () => {
  const { instance, transport, key } = worklet('right', 1)
  instance.process(
    [[new Float32Array(2048).fill(0.25), new Float32Array(2048).fill(0.5)]],
    [[new Float32Array(2048)]],
  )
  const block = parseCaptureMessage(transport.sent[0])
  if (block.type !== 'pcm') throw new Error('Expected PCM')
  expect(block.channels).toBe(1)
  expect(
    new Float32Array(block.interleaved).every((value) => value === 0.5),
  ).toBe(true)
  transport.deliver({
    ...key,
    type: 'credit',
    sequence: 0,
    recycled: block.interleaved,
  })
  transport.deliver({
    ...key,
    type: 'credit',
    sequence: 0,
    recycled: new ArrayBuffer(8192),
  })
  for (let i = 0; i < 9; i++)
    instance.process([[new Float32Array(2048)]], [[new Float32Array(2048)]])
  expect(transport.sent).toHaveLength(9)
})
