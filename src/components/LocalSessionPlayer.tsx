import { serializePcmOperation } from '../data/pcmOperations'
import type { Ref } from 'react'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'

/** WAV is a separate quantized playback/export copy; refinement always uses original f32 PCM. */
async function buildWav(
  pcm: Blob,
  onBytes?: (bytes: number) => void,
): Promise<Blob> {
  if (pcm.size > 28800000 || pcm.size % 4 !== 0)
    throw new Error('Invalid retained audio size.')
  const samples = pcm.size / 4
  const bytes = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(bytes)
  onBytes?.(bytes.byteLength + Math.min(pcm.size, 65536 * 4))
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 24000, true)
  view.setUint32(28, 48000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let base = 0; base < samples; base += 65536) {
    const source = new DataView(
      await pcm
        .slice(base * 4, Math.min(samples, base + 65536) * 4)
        .arrayBuffer(),
    )
    for (let i = 0; i < source.byteLength / 4; i++) {
      const value = source.getFloat32(i * 4, true)
      if (!Number.isFinite(value))
        throw new Error('Retained audio contains invalid samples.')
      const clipped = Math.max(-1, Math.min(1, value))
      view.setInt16(
        44 + (base + i) * 2,
        Math.round(clipped * (clipped < 0 ? 32768 : 32767)),
        true,
      )
    }
  }
  // Blob construction copies the WAV buffer; account both until this function returns.
  onBytes?.(bytes.byteLength * 2)
  return new Blob([bytes], { type: 'audio/wav' })
}
export function pcmToWav(
  pcm: Blob,
  onBytes?: (bytes: number) => void,
): Promise<Blob> {
  return serializePcmOperation(() => buildWav(pcm, onBytes))
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  const timer = setTimeout(() => URL.revokeObjectURL(url), 1000)
  return () => {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
}
export type LocalPlaybackHandle = { release: () => void }
export function LocalSessionPlayer({
  ref,
  onOwnedBytes,
  sessionId,
  getPcm,
  disabled,
  available,
  onError,
  onBusyChange,
}: {
  ref?: Ref<LocalPlaybackHandle>
  onOwnedBytes: (bytes: number) => void
  sessionId: string
  getPcm: () => Promise<Blob>
  disabled: boolean
  available: boolean
  onError: (message: string) => void
  onBusyChange: (busy: boolean) => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const wav = useRef<Blob | null>(null)
  const downloadCleanup = useRef<(() => void) | null>(null)
  useImperativeHandle(
    ref,
    () => ({
      release: () => {
        ++generation.current
        audio.current?.pause()
        audio.current?.removeAttribute('src')
        audio.current?.load()
        downloadCleanup.current?.()
        downloadCleanup.current = null
        wav.current = null
        if (url) URL.revokeObjectURL(url)
        setUrl(null)
        setBusy(false)
        onBusyChange(false)
        onOwnedBytes(0)
      },
    }),
    [url, onOwnedBytes, onBusyChange],
  )
  useEffect(() => {
    const lifetime = generation
    ++lifetime.current
    wav.current = null
    setUrl(null)
    setBusy(false)
    const element = audio.current
    return () => {
      ++lifetime.current
      element?.pause()
      downloadCleanup.current?.()
      onOwnedBytes(0)
      onBusyChange(false)
    }
  }, [sessionId, onBusyChange, onOwnedBytes])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  useEffect(() => {
    if (disabled) audio.current?.pause()
  }, [disabled])
  async function create(download: boolean) {
    const version = generation.current
    setBusy(true)
    onBusyChange(true)
    try {
      const blob = wav.current ?? (await pcmToWav(await getPcm(), onOwnedBytes))
      if (version !== generation.current) return
      wav.current = blob
      onOwnedBytes(blob.size)
      if (download) {
        downloadCleanup.current?.()
        downloadCleanup.current = downloadBlob(blob, 'fretbloom-capture.wav')
      } else setUrl((previous) => previous ?? URL.createObjectURL(blob))
    } catch (error) {
      if (version === generation.current) {
        onOwnedBytes(wav.current?.size ?? 0)
        onError(
          error instanceof Error
            ? error.message
            : 'Audio could not be prepared.',
        )
      }
    } finally {
      if (version === generation.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }
  return (
    <section className="live-local-player" aria-label="Captured audio playback">
      <div className="live-actions">
        <button
          disabled={!available || disabled || busy}
          onClick={() => void create(false)}
        >
          {busy ? 'Preparing audio…' : 'Play captured audio'}
        </button>
        <button
          disabled={!available || disabled || busy}
          onClick={() => void create(true)}
        >
          Download WAV
        </button>
      </div>
      {url && (
        <audio
          ref={audio}
          controls
          preload="metadata"
          src={url}
          aria-label="Captured gap-compacted audio"
        />
      )}
      <p>
        Playback follows capture time, with interruptions removed. Gap markers
        remain in the timeline. Audio never plays during a new capture.
      </p>
    </section>
  )
}
