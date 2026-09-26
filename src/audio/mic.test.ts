import { afterEach, expect, test, vi } from 'vitest'
import { MicInput } from './mic'

afterEach(() => vi.unstubAllGlobals())

test('stopping a pending microphone request closes the late stream', async () => {
  let grant: ((stream: MediaStream) => void) | undefined
  const stop = vi.fn()
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getSupportedConstraints: () => ({}),
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve
        }),
    },
  })
  const createMediaStreamSource = vi.fn()
  const mic = new MicInput({
    state: 'running',
    createMediaStreamSource,
  } as unknown as AudioContext)
  const starting = mic.start()
  mic.stop()
  grant?.(stream)
  await expect(starting).rejects.toMatchObject({ name: 'AbortError' })
  expect(stop).toHaveBeenCalledOnce()
  expect(createMediaStreamSource).not.toHaveBeenCalled()
  expect(mic.active).toBe(false)
})
