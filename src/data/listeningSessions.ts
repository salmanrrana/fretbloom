import { verifyPcmInWorker } from './pcmVerification'
import type { PcmVerificationOptions } from './pcmVerification'
import {
  array,
  choice,
  number,
  object,
  parseHash,
  parseJobId,
  string,
} from '../audio/analysisV1'
import type { LocalAnalysis } from '../audio/live/protocol'
import { parseLocalAnalysis } from '../audio/live/validation'
import type { CaptureSource } from '../audio/live/capture'

export const LISTENING_DB = 'fretbloom-listening-v1'
export const MAX_SESSIONS = 20
export const MAX_METADATA_BYTES = 2 * 1024 * 1024
export const MAX_STORED_AUDIO_BYTES = 128 * 1024 * 1024
export type VideoAnchor = {
  videoId: string
  segmentId: number
  captureSample: number
  videoSeconds: number
  rate: number
  status: 'approximate'
  userConfirmed: true
}
export type SavedListeningSession = {
  schemaVersion: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  source: CaptureSource
  analysis: LocalAnalysis
  anchors: VideoAnchor[]
  captureWarnings: string[]
  pcm: null | {
    sha256: string
    byteLength: number
    sampleRateHz: 24000
    format: 'f32le'
  }
}
function iso(value: unknown) {
  const text = string(value, 30)
  if (
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString() !== text
  )
    throw new Error('Invalid session date.')
  return text
}
export function parseVideoAnchor(value: unknown): VideoAnchor {
  const v = object(value)
  const videoId = string(v.videoId, 11)
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || v.userConfirmed !== true)
    throw new Error('Invalid video annotation.')
  return {
    videoId,
    segmentId: number(v.segmentId, 0, 63, true),
    captureSample: number(v.captureSample, 0, 7200000, true),
    videoSeconds: number(v.videoSeconds, 0, 86400),
    rate: number(v.rate, 0.25, 2),
    status: choice(v.status, ['approximate']),
    userConfirmed: true,
  }
}
export function parseSavedListeningSession(
  value: unknown,
): SavedListeningSession {
  const v = object(value)
  const analysis = parseLocalAnalysis(v.analysis)
  const pcm = v.pcm === null ? null : object(v.pcm)
  const saved: SavedListeningSession = {
    schemaVersion: choice(v.schemaVersion, [1]),
    id: parseJobId(v.id),
    title: string(v.title, 200),
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
    source: choice(v.source, ['tab', 'microphone']),
    analysis,
    anchors: array(v.anchors, 64, parseVideoAnchor),
    captureWarnings: array(v.captureWarnings, 64, (warning) =>
      string(warning, 1000),
    ),
    pcm:
      pcm === null
        ? null
        : {
            sha256: parseHash(pcm.sha256),
            byteLength: number(pcm.byteLength, 4, 28800000, true),
            sampleRateHz: choice(pcm.sampleRateHz, [24000]),
            format: choice(pcm.format, ['f32le']),
          },
  }
  if (saved.updatedAt < saved.createdAt)
    throw new Error('Session update precedes its creation.')
  if (saved.pcm && saved.pcm.byteLength !== analysis.durationSamples * 4)
    throw new Error('Audio length does not match this session.')
  for (const anchor of saved.anchors) {
    const segment = analysis.segments.find(
      (part) => part.id === anchor.segmentId,
    )
    if (
      !segment ||
      anchor.captureSample < segment.startSample ||
      anchor.captureSample > segment.endSample
    )
      throw new Error('Video annotation is outside its capture segment.')
  }
  if (
    new TextEncoder().encode(JSON.stringify(saved)).byteLength >
    MAX_METADATA_BYTES
  )
    throw new Error(
      'These results exceed the 2 MiB metadata limit. Keep the current session in memory or shorten the recording.',
    )
  return saved
}
export function exportListeningJson(saved: SavedListeningSession): Blob {
  return new Blob(
    [JSON.stringify(parseSavedListeningSession(saved), null, 0)],
    { type: 'application/json' },
  )
}
export function verifyListeningPcm(
  pcm: Blob,
  metadata: NonNullable<SavedListeningSession['pcm']>,
  options?: PcmVerificationOptions,
): Promise<void> {
  return verifyPcmInWorker(pcm, metadata, options)
}
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error('Browser storage request failed.'))
  })
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error('The save was canceled. Nothing was saved.'))
    tx.onerror = () => {}
  })
}
async function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    throw new Error(
      'Browser storage is unavailable. Download your results instead.',
    )
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LISTENING_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('sessions', { keyPath: 'id' })
      req.result.createObjectStore('pcm')
    }
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close()
      resolve(req.result)
    }
    req.onerror = () =>
      reject(
        req.error ??
          new Error(
            'Browser storage could not open. Download your results instead.',
          ),
      )
    req.onblocked = () =>
      reject(
        new Error(
          'Browser storage is busy in another tab. Close it and try again.',
        ),
      )
  })
}
function storageError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return new Error(
      'Browser storage is full. Delete a saved session or turn off Keep audio, then try again. Your current results are still here.',
    )
  return error instanceof Error
    ? error
    : new Error('Browser storage failed. Download your results instead.')
}
export async function listListeningSessions(): Promise<
  SavedListeningSession[]
> {
  const db = await database()
  try {
    const tx = db.transaction('sessions', 'readonly')
    const done = completed(tx)
    const values: unknown[] = await request(tx.objectStore('sessions').getAll())
    await done
    if (values.length > MAX_SESSIONS)
      throw new Error(
        'The saved-session count exceeds the browser collection limit.',
      )
    return values
      .map(parseSavedListeningSession)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } finally {
    db.close()
  }
}
export async function saveListeningSession(
  value: SavedListeningSession,
  pcm: Blob | null,
  options?: PcmVerificationOptions,
): Promise<SavedListeningSession> {
  const saved = parseSavedListeningSession(value)
  if (!!pcm !== !!saved.pcm)
    throw new Error('Audio and its metadata must be saved together.')
  if (pcm && saved.pcm) await verifyListeningPcm(pcm, saved.pcm, options)
  // Estimate is advisory; transaction completion is the only successful-save signal.
  await navigator.storage?.estimate?.().catch(() => undefined)
  options?.signal?.throwIfAborted()
  const db = await database()
  try {
    options?.signal?.throwIfAborted()
    const tx = db.transaction(['sessions', 'pcm'], 'readwrite')
    const done = completed(tx)
    try {
      const values: unknown[] = await request(
        tx.objectStore('sessions').getAll(),
      )
      const others = values
        .map(parseSavedListeningSession)
        .filter((item) => item.id !== saved.id)
      if (others.length >= MAX_SESSIONS)
        throw new Error(
          'This browser already has 20 sessions. Delete one before saving another.',
        )
      const totalBytes = others.reduce(
        (sum, item) => sum + (item.pcm?.byteLength ?? 0),
        saved.pcm?.byteLength ?? 0,
      )
      if (totalBytes > MAX_STORED_AUDIO_BYTES)
        throw new Error(
          'Saved audio would exceed 128 MiB. Delete selected recordings or save without audio.',
        )
      tx.objectStore('sessions').put(saved)
      if (pcm) tx.objectStore('pcm').put(pcm, saved.id)
      else tx.objectStore('pcm').delete(saved.id)
    } catch (error) {
      tx.abort()
      await done.catch(() => {})
      throw error
    }
    await done
    return saved
  } catch (error) {
    throw storageError(error)
  } finally {
    db.close()
  }
}
export async function loadListeningPcm(
  saved: SavedListeningSession,
  options?: PcmVerificationOptions,
): Promise<Blob | null> {
  if (!saved.pcm) return null
  const db = await database()
  try {
    const tx = db.transaction('pcm', 'readonly')
    const done = completed(tx)
    const pcm: unknown = await request(tx.objectStore('pcm').get(saved.id))
    await done
    if (!(pcm instanceof Blob))
      throw new Error('Saved audio is missing. Results are still available.')
    await verifyListeningPcm(pcm, saved.pcm, options)
    return pcm
  } finally {
    db.close()
  }
}
export async function renameListeningSession(
  id: string,
  title: string,
): Promise<void> {
  const db = await database()
  try {
    const tx = db.transaction('sessions', 'readwrite')
    const done = completed(tx)
    try {
      const value: unknown = await request(
        tx.objectStore('sessions').get(parseJobId(id)),
      )
      const session = parseSavedListeningSession(value)
      tx.objectStore('sessions').put(
        parseSavedListeningSession({
          ...session,
          title,
          updatedAt: new Date().toISOString(),
        }),
      )
    } catch (error) {
      tx.abort()
      await done.catch(() => {})
      throw error
    }
    await done
  } finally {
    db.close()
  }
}
export async function deleteListeningSession(id: string): Promise<void> {
  const db = await database()
  try {
    const tx = db.transaction(['sessions', 'pcm'], 'readwrite')
    const done = completed(tx)
    tx.objectStore('sessions').delete(parseJobId(id))
    tx.objectStore('pcm').delete(id)
    await done
  } finally {
    db.close()
  }
}
export async function clearListeningSessions(): Promise<void> {
  const db = await database()
  try {
    const tx = db.transaction(['sessions', 'pcm'], 'readwrite')
    const done = completed(tx)
    tx.objectStore('sessions').clear()
    tx.objectStore('pcm').clear()
    await done
  } finally {
    db.close()
  }
}
