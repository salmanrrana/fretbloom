import { recognizeChords } from './chordRecognition'

import type { SongAnalysis, SongFrame } from './songAnalysisTypes'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_DURATION_SECONDS = 10 * 60
const ANALYSIS_SAMPLE_RATE = 12_000
const DEFAULT_HOP_SECONDS = 1024 / ANALYSIS_SAMPLE_RATE
const FFT_SIZE = 4096

export interface AnalyzeSongOptions {
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export interface AnalyzeSamplesOptions extends AnalyzeSongOptions {
  hopSeconds?: number
  minMidi?: number
  maxMidi?: number
  minRms?: number
}

interface PitchEstimate {
  midi: number | null
  confidence: number
}

interface WorkerResultMessage {
  type: 'result'
  analysis: SongAnalysis
}

interface WorkerProgressMessage {
  type: 'progress'
  progress: number
}

interface WorkerErrorMessage {
  type: 'error'
  message: string
}

type WorkerMessage =
  WorkerResultMessage | WorkerProgressMessage | WorkerErrorMessage

function abortError(): DOMException {
  return new DOMException('Song analysis was cancelled.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

function reportProgress(
  callback: ((progress: number) => void) | undefined,
  value: number,
): void {
  callback?.(Math.max(0, Math.min(1, value)))
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const cancel = (): void => reject(abortError())
    signal.addEventListener('abort', cancel, { once: true })
    void promise.then(
      (value) => {
        signal.removeEventListener('abort', cancel)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', cancel)
        reject(error)
      },
    )
  })
}

function readFile(
  file: File,
  signal: AbortSignal | undefined,
  onProgress: (value: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    const cancel = (): void => reader.abort()
    signal?.addEventListener('abort', cancel, { once: true })

    const finish = (): void => signal?.removeEventListener('abort', cancel)
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(event.loaded / event.total)
    }
    reader.onload = () => {
      finish()
      if (signal?.aborted) {
        reject(abortError())
      } else if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('The selected recording could not be read.'))
      }
    }
    reader.onerror = () => {
      finish()
      reject(new Error('The selected recording could not be read.'))
    }
    reader.onabort = () => {
      finish()
      reject(abortError())
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Mix every channel equally and reduce the sample rate before crossing the
 * worker boundary. Averaging each source interval also acts as a modest
 * anti-alias filter and keeps a ten-minute recording below 29 MB of PCM.
 */
function downmixAndResample(
  audio: AudioBuffer,
  signal: AbortSignal | undefined,
  onProgress: (value: number) => void,
): { samples: Float32Array; sampleRate: number } {
  const sampleRate = Math.min(ANALYSIS_SAMPLE_RATE, audio.sampleRate)
  const ratio = audio.sampleRate / sampleRate
  const outputLength = Math.ceil(audio.length / ratio)
  const output = new Float32Array(outputLength)
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  )

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex++) {
    if ((outputIndex & 0x1ffff) === 0) {
      throwIfAborted(signal)
      onProgress(outputIndex / outputLength)
    }
    const start = Math.floor(outputIndex * ratio)
    const end = Math.min(
      audio.length,
      Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)),
    )
    let sum = 0
    for (let channel = 0; channel < channels.length; channel++) {
      const data = channels[channel]
      for (let sourceIndex = start; sourceIndex < end; sourceIndex++)
        sum += data[sourceIndex]
    }
    output[outputIndex] = sum / ((end - start) * channels.length)
  }
  onProgress(1)
  return { samples: output, sampleRate }
}

function analyzeInWorker(
  samples: Float32Array,
  sampleRate: number,
  { signal, onProgress }: AnalyzeSongOptions,
): Promise<SongAnalysis> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const worker = new Worker(
      new URL('./songAnalysis.worker.ts', import.meta.url),
      { type: 'module' },
    )
    let settled = false

    const cleanup = (): void => {
      signal?.removeEventListener('abort', cancel)
      worker.terminate()
    }
    const succeed = (analysis: SongAnalysis): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(analysis)
    }
    const fail = (error: Error | DOMException): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const cancel = (): void => fail(abortError())

    signal?.addEventListener('abort', cancel, { once: true })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress')
        reportProgress(onProgress, message.progress)
      if (message.type === 'result') succeed(message.analysis)
      if (message.type === 'error') fail(new Error(message.message))
    }
    worker.onerror = () =>
      fail(new Error('The recording could not be analyzed.'))
    worker.postMessage(
      { type: 'analyze', samples: samples.buffer, sampleRate },
      [samples.buffer],
    )
  })
}

/** Decode and analyze a user-selected recording without uploading it. */
export async function analyzeSongFile(
  file: File,
  options: AnalyzeSongOptions = {},
): Promise<SongAnalysis> {
  if (file.size === 0) throw new Error('The selected recording is empty.')
  if (file.size > MAX_FILE_BYTES)
    throw new Error('Choose a recording smaller than 50 MB.')
  throwIfAborted(options.signal)
  reportProgress(options.onProgress, 0)
  throwIfAborted(options.signal)

  const encoded = await readFile(file, options.signal, (progress) =>
    reportProgress(options.onProgress, progress * 0.12),
  )
  throwIfAborted(options.signal)
  reportProgress(options.onProgress, 0.14)

  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await abortable(context.decodeAudioData(encoded), options.signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new Error(
      'This browser could not decode that recording. Try an MP3, M4A, OGG, or WAV file it supports.',
    )
  } finally {
    void context.close()
  }

  throwIfAborted(options.signal)
  if (
    !Number.isFinite(decoded.duration) ||
    decoded.duration <= 0 ||
    decoded.length === 0
  ) {
    throw new Error('The selected recording contains no decodable audio.')
  }
  if (decoded.duration > MAX_DURATION_SECONDS)
    throw new Error('Choose a recording no longer than 10 minutes.')
  reportProgress(options.onProgress, 0.26)

  const prepared = downmixAndResample(decoded, options.signal, (progress) => {
    reportProgress(options.onProgress, 0.26 + progress * 0.14)
  })
  throwIfAborted(options.signal)

  const analysis = await analyzeInWorker(
    prepared.samples,
    prepared.sampleRate,
    {
      signal: options.signal,
      onProgress: (progress) =>
        reportProgress(options.onProgress, 0.4 + progress * 0.6),
    },
  )
  reportProgress(options.onProgress, 1)
  return analysis
}

function fft(real: Float64Array, imaginary: Float64Array): void {
  const length = real.length
  for (let index = 1, reversed = 0; index < length; index++) {
    let bit = length >> 1
    while (reversed & bit) {
      reversed ^= bit
      bit >>= 1
    }
    reversed ^= bit
    if (index < reversed) {
      const realValue = real[index]
      real[index] = real[reversed]
      real[reversed] = realValue
      const imaginaryValue = imaginary[index]
      imaginary[index] = imaginary[reversed]
      imaginary[reversed] = imaginaryValue
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const angle = (-2 * Math.PI) / size
    const stepReal = Math.cos(angle)
    const stepImaginary = Math.sin(angle)
    const half = size >> 1
    for (let offset = 0; offset < length; offset += size) {
      let twiddleReal = 1
      let twiddleImaginary = 0
      for (let index = 0; index < half; index++) {
        const even = offset + index
        const odd = even + half
        const oddReal =
          real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary
        const oddImaginary =
          real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal
        real[odd] = real[even] - oddReal
        imaginary[odd] = imaginary[even] - oddImaginary
        real[even] += oddReal
        imaginary[even] += oddImaginary
        const nextReal =
          twiddleReal * stepReal - twiddleImaginary * stepImaginary
        twiddleImaginary =
          twiddleReal * stepImaginary + twiddleImaginary * stepReal
        twiddleReal = nextReal
      }
    }
  }
}

function magnitudeAt(
  magnitudes: Float64Array,
  frequency: number,
  sampleRate: number,
): number {
  const bin = (frequency * FFT_SIZE) / sampleRate
  const lower = Math.floor(bin)
  if (lower < 1 || lower + 1 >= magnitudes.length) return 0
  const fraction = bin - lower
  return magnitudes[lower] * (1 - fraction) + magnitudes[lower + 1] * fraction
}

function pitchFeatures(
  magnitudes: Float64Array,
  rms: number,
  sampleRate: number,
  minMidi: number,
  maxMidi: number,
  minRms: number,
): { chroma: number[]; pitch: PitchEstimate } {
  const chroma = Array.from({ length: 12 }, () => 0)
  if (rms < minRms) return { chroma, pitch: { midi: null, confidence: 0 } }

  const lowestBin = Math.max(1, Math.ceil((55 * FFT_SIZE) / sampleRate))
  const highestBin = Math.min(
    magnitudes.length - 1,
    Math.floor((1800 * FFT_SIZE) / sampleRate),
  )
  let arithmeticMean = 0
  let logMean = 0
  let bins = 0
  for (let bin = lowestBin; bin <= highestBin; bin++) {
    const value = magnitudes[bin] + 1e-12
    arithmeticMean += value
    logMean += Math.log(value)
    bins++
  }
  arithmeticMean /= Math.max(1, bins)
  const flatness =
    Math.exp(logMean / Math.max(1, bins)) / Math.max(1e-12, arithmeticMean)

  const saliences: { midi: number; value: number; fundamental: number }[] = []
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const frequency = 440 * 2 ** ((midi - 69) / 12)
    const fundamental = magnitudeAt(magnitudes, frequency, sampleRate)
    const value =
      fundamental +
      0.42 * magnitudeAt(magnitudes, frequency * 2, sampleRate) +
      0.24 * magnitudeAt(magnitudes, frequency * 3, sampleRate) +
      0.14 * magnitudeAt(magnitudes, frequency * 4, sampleRate)
    saliences.push({ midi, value, fundamental })
    // Linear salience keeps the chroma broad enough for chord templates;
    // squaring it let one bass or vocal note swamp the other chord tones.
    chroma[((midi % 12) + 12) % 12] += value
  }

  const chromaTotal = chroma.reduce((sum, value) => sum + value, 0)
  if (chromaTotal > 0) {
    for (let pitchClass = 0; pitchClass < chroma.length; pitchClass++)
      chroma[pitchClass] /= chromaTotal
  }

  saliences.sort((left, right) => right.value - left.value)
  const strongest = saliences[0]
  if (!strongest) return { chroma, pitch: { midi: null, confidence: 0 } }
  const competitor = saliences.find(
    (candidate) => Math.abs(candidate.midi - strongest.midi) > 1,
  )
  const dominance =
    strongest.value / Math.max(1e-12, competitor?.value ?? arithmeticMean)
  const peakToMean = strongest.fundamental / Math.max(1e-12, arithmeticMean)
  const tonal = flatness < 0.38 && peakToMean > 5
  const unambiguous = dominance > 1.38
  const confidence = Math.max(
    0,
    Math.min(
      1,
      0.52 * Math.min(1, (dominance - 1) / 1.1) +
        0.3 * Math.min(1, peakToMean / 16) +
        0.18 * (1 - flatness),
    ),
  )

  return {
    chroma,
    pitch: {
      midi: tonal && unambiguous ? strongest.midi : null,
      confidence: tonal && unambiguous ? confidence : 0,
    },
  }
}

function detectedNotes(
  frames: SongFrame[],
  confidences: number[],
  duration: number,
  hopSeconds: number,
): SongAnalysis['notes'] {
  const notes: SongAnalysis['notes'] = []
  let start = 0
  while (start < frames.length) {
    const midi = frames[start].midi
    if (midi === null) {
      start++
      continue
    }

    let end = start + 1
    let confidence = confidences[start]
    while (end < frames.length) {
      const next = frames[end].midi
      const bridgesOneUncertainFrame =
        next === null && frames[end + 1]?.midi === midi
      if (next !== midi && !bridgesOneUncertainFrame) break
      if (next === midi) confidence += confidences[end]
      end++
    }

    const soundingFrames = frames
      .slice(start, end)
      .filter((frame) => frame.midi === midi).length
    const noteStart = Math.max(0, frames[start].time - hopSeconds / 2)
    const noteEnd = Math.min(duration, frames[end - 1].time + hopSeconds / 2)
    if (soundingFrames >= 2 && noteEnd - noteStart >= 0.12) {
      notes.push({
        midi,
        start: noteStart,
        end: noteEnd,
        confidence: confidence / soundingFrames,
      })
    }
    start = end
  }
  return notes
}

/**
 * Lightweight local analysis for synchronization evidence. Chroma remains
 * useful for chords; `midi` is deliberately null unless one pitch dominates.
 * `chords` is a sheet-independent chord timeline read from the chroma.
 */
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  options: AnalyzeSamplesOptions = {},
): SongAnalysis {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error('Sample rate must be positive.')
  if (samples.length / sampleRate > MAX_DURATION_SECONDS)
    throw new Error('Audio cannot be longer than 10 minutes.')

  const hopSeconds = options.hopSeconds ?? DEFAULT_HOP_SECONDS
  if (!Number.isFinite(hopSeconds) || hopSeconds <= 0)
    throw new Error('Hop length must be positive.')
  const minMidi = Math.round(options.minMidi ?? 40)
  const maxMidi = Math.round(options.maxMidi ?? 88)
  const minRms = options.minRms ?? 0.004
  if (minMidi >= maxMidi) throw new Error('The MIDI analysis range is invalid.')
  if (!Number.isFinite(minRms) || minRms < 0)
    throw new Error('The silence threshold is invalid.')

  throwIfAborted(options.signal)
  reportProgress(options.onProgress, 0)
  throwIfAborted(options.signal)
  const duration = samples.length / sampleRate
  if (samples.length === 0)
    return { duration: 0, hopSeconds, frames: [], notes: [], chords: [] }

  const hopSize = Math.max(1, Math.round(hopSeconds * sampleRate))
  const frameCount = Math.max(1, Math.ceil(samples.length / hopSize))
  const window = new Float64Array(FFT_SIZE)
  for (let index = 0; index < FFT_SIZE; index++)
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1))

  const real = new Float64Array(FFT_SIZE)
  const imaginary = new Float64Array(FFT_SIZE)
  const magnitudes = new Float64Array(FFT_SIZE / 2 + 1)
  const frames: SongFrame[] = []
  const confidences: number[] = []

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    if ((frameIndex & 0x0f) === 0) {
      throwIfAborted(options.signal)
      reportProgress(options.onProgress, frameIndex / frameCount)
    }
    const start = frameIndex * hopSize
    const available = Math.min(FFT_SIZE, samples.length - start)
    let mean = 0
    for (let index = 0; index < available; index++)
      mean += samples[start + index]
    mean /= Math.max(1, available)

    let squareSum = 0
    real.fill(0)
    imaginary.fill(0)
    for (let index = 0; index < available; index++) {
      const value = samples[start + index] - mean
      squareSum += value * value
      real[index] = value * window[index]
    }
    const rms = Math.sqrt(squareSum / Math.max(1, available))
    fft(real, imaginary)
    for (let bin = 0; bin < magnitudes.length; bin++)
      magnitudes[bin] = Math.hypot(real[bin], imaginary[bin])

    const { chroma, pitch } = pitchFeatures(
      magnitudes,
      rms,
      sampleRate,
      minMidi,
      maxMidi,
      minRms,
    )
    frames.push({
      time: Math.min(duration, (start + available / 2) / sampleRate),
      chroma,
      midi: pitch.midi,
      rms,
    })
    confidences.push(pitch.confidence)
  }

  reportProgress(options.onProgress, 1)
  const hop = hopSize / sampleRate
  return {
    duration,
    hopSeconds: hop,
    frames,
    notes: detectedNotes(frames, confidences, duration, hop),
    chords: recognizeChords(frames, hop, duration),
  }
}
