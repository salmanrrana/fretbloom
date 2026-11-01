import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_OPTIONS, choice, parseOptions } from '../audio/analysisV1'
import type { AnalysisOptions } from '../audio/analysisV1'
import {
  LiveCapture,
  captureCapabilities,
  captureErrorMessage,
} from '../audio/live/capture'
import type { CaptureChannel, CaptureSource } from '../audio/live/capture'
import { createLiveRuntime } from '../audio/live/runtime'
import type {
  Key,
  LiveRuntime,
  LocalAnalysis,
  RuntimeEvent,
} from '../audio/live/protocol'
import {
  exportListeningJson,
  loadListeningPcm,
  saveListeningSession,
} from '../data/listeningSessions'
import type {
  SavedListeningSession,
  VideoAnchor,
} from '../data/listeningSessions'
import {
  EMPTY_TIMELINE,
  LiveTimeline,
  applyTimelinePatch,
  captureTime,
  timelineFromAnalysis,
} from './LiveTimeline'
import { LocalSessionPlayer, downloadBlob } from './LocalSessionPlayer'
import type { LocalPlaybackHandle } from './LocalSessionPlayer'
import { ListeningSessions } from './ListeningSessions'
import { LiveVideo } from './LiveVideo'

type Phase =
  | 'preparing'
  | 'ready'
  | 'requesting'
  | 'capturing'
  | 'paused'
  | 'stopping'
  | 'captured'
  | 'refining'
  | 'unavailable'
type RetainedPcm = { pcm: Blob; pcmSha256: string }
export function LiveListen() {
  const capabilities = captureCapabilities()
  const [phase, setPhase] = useState<Phase>('preparing')
  const phaseRef = useRef<Phase>('preparing')
  const [source, setSource] = useState<CaptureSource>(() =>
    capabilities.tab ? 'tab' : 'microphone',
  )
  const [channel, setChannel] = useState<CaptureChannel>('mean')
  const [deviceId, setDeviceId] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [options, setOptions] = useState<AnalysisOptions>({
    ...DEFAULT_OPTIONS,
  })
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Preparing the local music engine…')
  const [warnings, setWarnings] = useState<string[]>([])
  const [level, setLevel] = useState(0)
  const [capturedSamples, setCapturedSamples] = useState(0)
  const [analyzedThrough, setAnalyzedThrough] = useState(0)
  const [processingMs, setProcessingMs] = useState(0)
  const [queued, setQueued] = useState(0)
  const [wasmBytes, setWasmBytes] = useState(0)
  const [timeline, setTimeline] = useState(EMPTY_TIMELINE)
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null)
  const [engineVersion, setEngineVersion] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [title, setTitle] = useState('Untitled capture')
  const [keepAudio, setKeepAudio] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collectionRevision, setCollectionRevision] = useState(0)
  const player = useRef<LocalPlaybackHandle>(null)
  const [pcmBytes, setPcmBytes] = useState(0)
  const [playbackBytes, setPlaybackBytes] = useState(0)
  const [playerBusy, setPlayerBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const sessionSource = useRef<CaptureSource>('tab')
  const [refineAvailable, setRefineAvailable] = useState(false)
  const [diagnostics, setDiagnostics] = useState<{
    ownedJsBytes?: number
    sharedPcmBytes?: number
    queuedHighWater?: number
    skippedWindows?: number
  }>({})
  const [audioAvailable, setAudioAvailable] = useState(false)
  const [anchors, setAnchors] = useState<VideoAnchor[]>([])
  const [refineSeconds, setRefineSeconds] = useState(0)
  const [capturePosition, setCapturePosition] =
    useState<Extract<RuntimeEvent, { type: 'status' }>['capturePosition']>()
  const captureEpoch = useRef(0)
  const resuming = useRef(false)
  const [verificationBytes, setVerificationBytes] = useState(0)
  const key = useRef<Key>({ sessionId: '', generation: 0 })
  const runtime = useRef<LiveRuntime | null>(null)
  const capture = useRef<LiveCapture | null>(null)
  const pcm = useRef<RetainedPcm | null>(null)
  const sharedPcm = useRef<{ blob: Blob; generation: number } | null>(null)
  const refinementAttempted = useRef(false)
  const retainedRetry = useRef(false)
  const upgradeApproved = useRef(false)
  const operation = useRef<AbortController | null>(null)
  const stopped = useRef<Promise<void> | null>(null)
  const stopAction = useRef<() => Promise<void>>(async () => {})
  const startButton = useRef<HTMLButtonElement>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  const createdAt = useRef(new Date().toISOString())
  const mounted = useRef(true)
  function transition(next: Phase, message: string) {
    if (next !== 'capturing') setCapturePosition(undefined)
    phaseRef.current = next
    setPhase(next)
    setStatus(message)
  }
  const current = (candidate: Key) =>
    mounted.current &&
    candidate.sessionId === key.current.sessionId &&
    candidate.generation === key.current.generation
  function release() {
    player.current?.release()
    setPcmBytes(0)
    setPlaybackBytes(0)
    operation.current?.abort()
    operation.current = null
    capture.current?.dispose()
    capture.current = null
    runtime.current?.dispose()
    runtime.current = null
    pcm.current = null
    sharedPcm.current = null
    refinementAttempted.current = false
    retainedRetry.current = false
    upgradeApproved.current = false
    key.current = { sessionId: '', generation: key.current.generation + 1 }
  }
  function runtimeEvent(event: RuntimeEvent) {
    const eventKey = event.type === 'timeline' ? event.patch : event.key
    if (!current(eventKey)) return
    if (event.type === 'ready') {
      setEngineVersion(event.engineVersion)
      return
    }
    if (event.type === 'timeline') {
      setTimeline((previous) => applyTimelinePatch(previous, event.patch))
      for (const warning of event.patch.warnings) warn(warning.message)
    } else if (event.type === 'status') {
      setCapturedSamples(event.capturedSamples)
      setCapturePosition(
        phaseRef.current === 'capturing' &&
          event.captureEpoch === captureEpoch.current
          ? event.capturePosition
          : undefined,
      )
      setAnalyzedThrough(event.analyzedThroughSample)
      setDiagnostics({
        ownedJsBytes: event.ownedJsBytes,
        sharedPcmBytes: event.sharedPcmBytes,
        queuedHighWater: event.queuedHighWater,
        skippedWindows: event.skippedWindows,
      })
      setProcessingMs(event.processingMs)
      setQueued(event.queuedBlocks)
      setWasmBytes(event.wasmBytes)
      if (
        event.capturedSamples >= 7200000 &&
        ['capturing', 'paused'].includes(phaseRef.current)
      ) {
        warn(
          'The five-minute audio limit was reached. Captured results are kept.',
        )
        void stopAction.current()
      }
    } else if (event.type === 'error') {
      setError(`${event.code}: ${event.message}`)
      if (['capturing', 'paused', 'requesting'].includes(phaseRef.current))
        void stopAction.current()
    }
  }
  function warn(message: string) {
    setWarnings((previous) =>
      previous.includes(message) ? previous : [...previous.slice(-63), message],
    )
  }
  const prepare = useCallback(async () => {
    release()
    stopped.current = null
    if (!capabilities.available) {
      transition(
        'unavailable',
        capabilities.reason ?? 'Local capture is unavailable.',
      )
      return
    }
    const next: Key = {
      sessionId: crypto.randomUUID(),
      generation: key.current.generation + 1,
    }
    key.current = next
    setSessionId(next.sessionId)
    createdAt.current = new Date().toISOString()
    sessionSource.current = source
    setDiagnostics({})
    setAnalysis(null)
    setTimeline(EMPTY_TIMELINE)
    setCapturedSamples(0)
    setAnalyzedThrough(0)
    setLevel(0)
    setWarnings([])
    setAnchors([])
    setSaved(false)
    setAudioAvailable(false)
    setRefineAvailable(false)
    setError(null)
    setCapturePosition(undefined)
    captureEpoch.current = 0
    resuming.current = false
    transition('preparing', 'Preparing the local music engine…')
    const engine = createLiveRuntime(runtimeEvent)
    runtime.current = engine
    try {
      await engine.prepare(next, options)
      if (current(next))
        transition('ready', 'Ready. Choose your source and start capture.')
    } catch (reason) {
      if (current(next)) {
        setError(captureErrorMessage(reason))
        transition(
          'unavailable',
          'The local engine could not prepare. Retry to load it again.',
        )
      }
    }
    // The engine callback filters all replies by this operation's key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, source, channel, deviceId])
  useEffect(() => {
    mounted.current = true
    void prepare()
    const onPageHide = () => release()
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void prepare()
    }
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      mounted.current = false
      release()
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [prepare])
  const isCapturing = phase === 'capturing'
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    let active = true
    const refresh = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then((items) => {
          if (!active) return
          const inputs = items.filter((item) => item.kind === 'audioinput')
          setDevices(inputs)
          if (
            deviceId &&
            !inputs.some((item) => item.deviceId === deviceId) &&
            ['capturing', 'paused'].includes(phaseRef.current)
          ) {
            capture.current?.pause('device_changed')
            transition(
              'paused',
              'The chosen audio input was removed. Stop, reconnect it, and start a new capture.',
            )
            setError(
              'Audio input disconnected. Capture will not switch to another microphone automatically.',
            )
          }
        })
        .catch(() => {})
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      active = false
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [deviceId, isCapturing])
  useEffect(() => {
    if (phase !== 'refining') return
    const at = performance.now()
    setRefineSeconds(0)
    const timer = setInterval(
      () => setRefineSeconds(Math.floor((performance.now() - at) / 1000)),
      1000,
    )
    return () => clearInterval(timer)
  }, [phase])

  function start() {
    const engine = runtime.current
    if (!engine || phaseRef.current !== 'ready') return
    const next = { ...key.current }
    sessionSource.current = source
    setError(null)
    transition(
      'requesting',
      source === 'tab'
        ? 'Choose a tab and enable Share audio in your browser.'
        : 'Waiting for microphone permission…',
    )
    const lease = new LiveCapture((event) => {
      if (!current(next)) return
      if (event.type === 'level') {
        setLevel(event.rms)
        if (event.droppedFrames)
          warn(
            'Some input frames were dropped. Transport gaps are marked; refine the retained audio after stopping.',
          )
      } else if (event.type === 'paused') transition('paused', event.message)
      else if (event.type === 'ended') {
        warn(event.message)
        void stopAction.current()
      } else if (event.type === 'warning') warn(event.message)
      else if (event.type === 'started')
        warn(
          `Capture input: ${event.sampleRateHz.toLocaleString()} Hz, ${event.channels} channel${event.channels === 1 ? '' : 's'}.`,
        )
    })
    capture.current = lease
    // No awaited preparation before this call: picker and context resume retain user activation.
    void lease
      .start(source, next, engine, channel, deviceId)
      .then(() => {
        if (!current(next) || phaseRef.current === 'stopping') {
          lease.dispose()
          return
        }
        if (phaseRef.current !== 'paused')
          transition('capturing', 'Capturing locally. Recent notes may change.')
        stopButton.current?.focus()
      })
      .catch((reason: unknown) => {
        if (!current(next) || phaseRef.current === 'stopping') return
        setError(captureErrorMessage(reason))
        transition('ready', 'Sharing did not start. Choose a source again.')
        startButton.current?.focus()
      })
  }
  async function stop() {
    if (stopped.current) return stopped.current
    const next = { ...key.current }
    const engine = runtime.current
    if (!engine) return
    if (phaseRef.current === 'requesting') {
      capture.current?.dispose()
      capture.current = null
      void prepare()
      return
    }
    transition('stopping', 'Stopping capture and keeping the latest results…')
    stopped.current = (async () => {
      try {
        const acknowledged = await capture.current?.stop()
        if (!current(next)) return
        if (!acknowledged)
          warn(
            'The capture end acknowledgment timed out. This session may be partial.',
          )
        const result = await engine.stop()
        if (!current(next)) return
        setAnalysis(result)
        setTimeline(timelineFromAnalysis(result))
        setCapturedSamples(result.durationSamples)
        setAudioAvailable(result.durationSamples > 0)
        setRefineAvailable(result.durationSamples > 0)
        setSaved(false)
        transition(
          'captured',
          result.durationSamples < 15360
            ? 'Too short to settle. Capture a longer passage for useful evidence.'
            : 'Capture stopped. Review, refine, play, or save on this browser.',
        )
        startButton.current?.focus()
      } catch (reason) {
        if (current(next)) {
          setError(captureErrorMessage(reason))
          setAudioAvailable(true)
          setRefineAvailable(true)
          transition(
            'captured',
            'Capture stopped. Available live results remain visible. Retained audio can be exported or refined.',
          )
        }
      }
    })()
    return stopped.current
  }
  stopAction.current = stop
  async function resume() {
    if (resuming.current || phaseRef.current !== 'paused') return
    resuming.current = true
    setCapturePosition(undefined)
    // Ingest increments this epoch only when it processes the resume boundary.
    // Queued statuses from before Resume cannot authorize a new annotation.
    ++captureEpoch.current
    const next = { ...key.current }
    try {
      await capture.current?.resume()
      if (current(next) && phaseRef.current === 'paused')
        transition('capturing', 'Capturing resumed in a new segment.')
    } catch (reason) {
      if (current(next) && phaseRef.current === 'paused') {
        --captureEpoch.current
        setError(captureErrorMessage(reason))
      }
    } finally {
      if (current(next)) resuming.current = false
    }
  }
  async function refine(reanalyze = false) {
    player.current?.release()
    let engine = runtime.current
    if (
      (!analysis && reanalyze) ||
      (!refineAvailable && !reanalyze) ||
      (reanalyze && !pcm.current) ||
      !engine
    )
      return
    if (reanalyze) upgradeApproved.current = true
    const mustRestore =
      reanalyze || (refinementAttempted.current && !retainedRetry.current)
    const retry = !mustRestore && retainedRetry.current
    let next = { ...key.current }
    const controller = new AbortController()
    let refinementRequested = false
    operation.current = controller
    setError(null)
    transition(
      'refining',
      'Refining the retained recording. Current results stay visible; you can cancel.',
    )
    try {
      if (mustRestore) {
        if (!analysis)
          throw new Error(
            'A valid session snapshot is needed to retry refinement. Download the retained audio instead.',
          )
        await getPcm(controller.signal)
        if (controller.signal.aborted || !current(next) || !pcm.current) return
        next = { ...key.current, generation: key.current.generation + 1 }
        key.current = next
        engine.dispose()
        engine = createLiveRuntime(runtimeEvent)
        runtime.current = engine
        await engine.restore(
          next,
          analysis,
          pcm.current.pcm,
          pcm.current.pcmSha256,
          controller.signal,
          upgradeApproved.current ? { allowEngineChange: true } : undefined,
        )
        if (!current(next) || controller.signal.aborted) return
        sharedPcm.current = {
          blob: pcm.current.pcm,
          generation: next.generation,
        }
        setPcmBytes(pcm.current.pcm.size)
        setRefineAvailable(true)
      }
      refinementAttempted.current = true
      refinementRequested = true
      const result = retry
        ? await engine.retryRetainedRefinement(controller.signal)
        : await engine.refine(controller.signal)
      if (!current(next) || controller.signal.aborted) return
      retainedRetry.current = false
      setAnalysis(result)
      setTimeline(timelineFromAnalysis(result))
      setSaved(false)
      transition(
        'captured',
        'Refinement complete. Review the updated evidence before saving.',
      )
    } catch (reason) {
      if (!current(next) || operation.current !== controller) return
      // Aborting restore disposes its runtime before it has a refinement to retry.
      retainedRetry.current =
        controller.signal.aborted && refinementRequested && !reanalyze
      if (!controller.signal.aborted) setError(captureErrorMessage(reason))
      transition(
        'captured',
        controller.signal.aborted
          ? 'Refinement canceled. Previous results are kept.'
          : 'Refinement failed. Previous results are kept.',
      )
    } finally {
      const ownsOperation = operation.current === controller
      if (ownsOperation) operation.current = null
      if (
        ownsOperation &&
        current(next) &&
        controller.signal.aborted &&
        phaseRef.current === 'refining'
      )
        transition(
          'captured',
          'Refinement canceled. Previous results are kept.',
        )
    }
  }
  async function getPcm(externalSignal?: AbortSignal): Promise<Blob> {
    if (pcm.current) return pcm.current.pcm
    const engine = runtime.current
    if (!engine) throw new Error('No retained audio is available.')
    const next = { ...key.current }
    const controller = new AbortController()
    if (!externalSignal) operation.current = controller
    const signal = externalSignal ?? controller.signal
    const result = await engine.exportPcm(signal)
    if (!current(next) || signal.aborted)
      throw new DOMException('Audio export canceled.', 'AbortError')
    pcm.current = result
    sharedPcm.current = { blob: result.pcm, generation: next.generation }
    setPcmBytes(result.pcm.size)
    if (operation.current === controller) operation.current = null
    return result.pcm
  }
  function metadata(): SavedListeningSession {
    if (!analysis) throw new Error('Stop capture before saving results.')
    return {
      schemaVersion: 1,
      id: sessionId,
      title: title.trim() || 'Untitled capture',
      createdAt: createdAt.current,
      updatedAt: new Date().toISOString(),
      source: sessionSource.current,
      analysis,
      anchors,
      captureWarnings: warnings,
      pcm:
        keepAudio && pcm.current
          ? {
              sha256: pcm.current.pcmSha256,
              byteLength: pcm.current.pcm.size,
              sampleRateHz: 24000,
              format: 'f32le',
            }
          : null,
    }
  }
  async function save() {
    player.current?.release()
    const controller = new AbortController()
    operation.current = controller
    const next = { ...key.current }
    setBusy(true)
    setError(null)
    try {
      const audio = keepAudio ? await getPcm(controller.signal) : null
      if (!current(next)) return
      await saveListeningSession(metadata(), audio, {
        signal: controller.signal,
        onWorkingBytes: setVerificationBytes,
      })
      if (!current(next)) return
      setSaved(true)
      setCollectionRevision((value) => value + 1)
      setStatus('Saved on this browser. Nothing was uploaded.')
    } catch (reason) {
      if (current(next)) {
        setError(captureErrorMessage(reason))
        setSaved(false)
      }
    } finally {
      if (operation.current === controller) operation.current = null
      if (current(next)) setBusy(false)
    }
  }
  async function openSaved(savedSession: SavedListeningSession) {
    release()
    stopped.current = null
    setBusy(true)
    setError(null)
    const next = {
      sessionId: savedSession.id,
      generation: key.current.generation + 1,
    }
    key.current = next
    sessionSource.current = savedSession.source
    setRefineAvailable(false)
    setSessionId(savedSession.id)
    setTitle(savedSession.title)
    createdAt.current = savedSession.createdAt
    setAnalysis(savedSession.analysis)
    setCapturedSamples(savedSession.analysis.durationSamples)
    setTimeline(timelineFromAnalysis(savedSession.analysis))
    setWarnings(savedSession.captureWarnings)
    setAnchors(savedSession.anchors)
    setSaved(true)
    setKeepAudio(!!savedSession.pcm)
    setAudioAvailable(false)
    transition('captured', 'Saved results opened. Checking any retained audio…')
    const controller = new AbortController()
    operation.current = controller
    try {
      const audio = await loadListeningPcm(savedSession, {
        signal: controller.signal,
        onWorkingBytes: setVerificationBytes,
      })
      if (!current(next)) return
      if (audio && savedSession.pcm) {
        pcm.current = { pcm: audio, pcmSha256: savedSession.pcm.sha256 }
        setPcmBytes(audio.size)
        setAudioAvailable(true)
        const engine = createLiveRuntime(runtimeEvent)
        runtime.current = engine
        await engine.restore(
          next,
          savedSession.analysis,
          audio,
          savedSession.pcm.sha256,
          controller.signal,
        )
        if (current(next)) {
          sharedPcm.current = { blob: audio, generation: next.generation }
          setPcmBytes(audio.size)
          setRefineAvailable(true)
        }
      }
      if (current(next))
        setStatus(
          audio
            ? 'Saved results and verified audio opened.'
            : 'Saved results opened. Audio was not kept for this session.',
        )
    } catch (reason) {
      if (current(next)) setError(captureErrorMessage(reason))
    } finally {
      if (current(next)) {
        setBusy(false)
        operation.current = null
      }
    }
  }
  const capturing = ['capturing', 'paused'].includes(phase)
  const locked =
    playerBusy ||
    [
      'preparing',
      'requesting',
      'capturing',
      'paused',
      'stopping',
      'refining',
    ].includes(phase) ||
    busy
  const overlapBytes =
    sharedPcm.current?.blob === pcm.current?.pcm &&
    sharedPcm.current?.generation === key.current.generation
      ? Math.min(pcmBytes, diagnostics.sharedPcmBytes ?? 0)
      : 0
  const ownedAudioBytes =
    diagnostics.ownedJsBytes === undefined ||
    diagnostics.sharedPcmBytes === undefined
      ? undefined
      : diagnostics.ownedJsBytes +
        pcmBytes -
        overlapBytes +
        playbackBytes +
        verificationBytes
  const lag = Math.max(0, (capturedSamples - analyzedThrough) / 24000)
  return (
    <section className="panel live-listen" aria-label="Capture music">
      <h2>Capture music</h2>
      <p>
        Share music from a tab, or listen through a microphone or audio
        interface. Notes and harmony appear while you listen. Dense recordings
        can remain unclear.
      </p>
      <fieldset disabled={locked || phase === 'captured' || !!analysis}>
        <legend>Audio source</legend>
        <div className="live-actions">
          <label className="live-check">
            <input
              type="radio"
              name="live-source"
              checked={(analysis ? sessionSource.current : source) === 'tab'}
              onChange={() => setSource('tab')}
              disabled={!capabilities.tab || locked || !!analysis}
            />
            Browser tab
          </label>
          <label className="live-check">
            <input
              type="radio"
              name="live-source"
              checked={
                (analysis ? sessionSource.current : source) === 'microphone'
              }
              onChange={() => setSource('microphone')}
              disabled={!capabilities.microphone || locked || !!analysis}
            />
            Microphone / interface
          </label>
        </div>
        {source === 'microphone' && (
          <label>
            Audio input
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
            >
              <option value="">System default input</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label ||
                    'Audio input (allow permission to see its name)'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Input channel
          <select
            value={channel}
            onChange={(event) =>
              setChannel(choice(event.target.value, ['mean', 'left', 'right']))
            }
          >
            <option value="mean">
              Mono / stereo mean (cancellation checked)
            </option>
            <option value="left">Left / interface channel 1</option>
            <option value="right">Right / interface channel 2</option>
          </select>
        </label>
      </fieldset>
      {source === 'tab' && (
        <p>
          Your browser will ask which tab to share. Select the music tab and
          enable audio.
          {!capabilities.tab &&
            ' Tab audio capture is unavailable here; choose microphone / interface in a supported secure browser.'}
        </p>
      )}
      <p>
        Captured audio stays temporarily in memory until you discard it or
        leave. Audio is saved on this browser only if you select Keep audio. No
        screen images are stored.
      </p>
      <details>
        <summary>Analysis options</summary>
        <fieldset
          disabled={locked || phase === 'captured' || !!analysis}
          className="live-field-row"
        >
          <label>
            Music mode
            <select
              value={options.mode}
              onChange={(event) =>
                setOptions(
                  parseOptions({ ...options, mode: event.target.value }),
                )
              }
            >
              <option value="auto">Automatic</option>
              <option value="monophonic">Single notes</option>
              <option value="polyphonic">Layered notes</option>
            </select>
          </label>
          <label>
            Concert A (Hz)
            <input
              type="number"
              min={432}
              max={446}
              step={1}
              value={options.concertAHz}
              onChange={(event) => {
                const hz = Number(event.target.value)
                if (Number.isFinite(hz) && hz >= 432 && hz <= 446)
                  setOptions(parseOptions({ ...options, concertAHz: hz }))
              }}
            />
          </label>
          <label>
            Note spelling
            <select
              value={options.spelling}
              onChange={(event) =>
                setOptions(
                  parseOptions({ ...options, spelling: event.target.value }),
                )
              }
            >
              <option value="sharps">Sharps</option>
              <option value="flats">Flats</option>
            </select>
          </label>
        </fieldset>
        <p>
          Source, channels, and analysis options are fixed per capture. Start a
          new capture to change them.
        </p>
      </details>
      <div className="live-capture-controls">
        <div className="live-actions">
          {phase === 'ready' && (
            <button
              ref={startButton}
              className="mic-btn"
              disabled={
                source === 'tab' ? !capabilities.tab : !capabilities.microphone
              }
              onClick={start}
            >
              Start capture
            </button>
          )}
          {(capturing || phase === 'requesting' || phase === 'stopping') && (
            <button
              ref={stopButton}
              className="mic-btn live-stop"
              disabled={phase === 'stopping'}
              onClick={() => void stop()}
            >
              {phase === 'requesting'
                ? 'Cancel sharing'
                : phase === 'stopping'
                  ? 'Stopping…'
                  : 'Stop capture'}
            </button>
          )}
          {phase === 'capturing' && (
            <button onClick={() => capture.current?.pause()}>Pause</button>
          )}
          {phase === 'paused' && (
            <button onClick={() => void resume()}>Resume capture</button>
          )}
          {phase === 'unavailable' && (
            <button onClick={() => void prepare()}>Retry local engine</button>
          )}
        </div>
        <div className="live-signal">
          <label htmlFor="live-input-level">Input level</label>
          <meter id="live-input-level" value={level} min={0} max={1} />{' '}
          <span>
            {capturing && level < 0.001
              ? 'No sound yet'
              : capturing
                ? 'Receiving audio'
                : 'Input stopped'}
          </span>
        </div>
        <p className="live-time">
          {captureTime(capturedSamples / 24000)} captured · five-minute audio
          limit
        </p>
      </div>
      <p role="status" className="live-status">
        {status}
        {phase === 'refining'
          ? ` ${refineSeconds} seconds elapsed (up to 120 seconds).`
          : ''}
      </p>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <details>
          <summary>Capture notices ({warnings.length})</summary>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <LiveTimeline
        timeline={timeline}
        durationSamples={capturedSamples}
        segments={analysis?.segments}
        active={capturing || phase === 'stopping'}
        refined={analysis?.completeness === 'refined'}
      />
      {!analysis && phase === 'captured' && audioAvailable && (
        <section aria-label="Recover retained capture">
          <h3>Keep the captured audio</h3>
          <p>
            Final analysis did not validate. The live timeline is kept; retained
            audio can still be exported or refined. No invalid result is saved.
          </p>
          <button disabled={busy || playerBusy} onClick={() => void prepare()}>
            Discard current / new capture
          </button>
          <button disabled={busy || playerBusy} onClick={() => void refine()}>
            Refine recording
          </button>
          <LocalSessionPlayer
            ref={player}
            onOwnedBytes={setPlaybackBytes}
            key={sessionId}
            sessionId={sessionId}
            getPcm={getPcm}
            available={audioAvailable}
            disabled={busy}
            onError={setError}
            onBusyChange={setPlayerBusy}
          />
        </section>
      )}
      {!analysis && phase === 'refining' && (
        <button
          onClick={() => {
            operation.current?.abort()
            runtime.current?.cancelRefinement()
          }}
        >
          Cancel refinement
        </button>
      )}
      {analysis && (
        <section className="live-results" aria-label="Review and save capture">
          <h3>Keep this passage</h3>
          <p>
            {analysis.completeness === 'refined'
              ? 'Refined evidence'
              : analysis.completeness === 'partial'
                ? 'Partial recording / analysis'
                : 'Live evidence'}{' '}
            · Engine {analysis.engineVersion}
          </p>
          <div className="live-actions">
            <button
              disabled={
                !refineAvailable ||
                busy ||
                playerBusy ||
                phase === 'refining' ||
                !runtime.current
              }
              onClick={() => void refine()}
            >
              Refine recording
            </button>
            {audioAvailable &&
              !refineAvailable &&
              engineVersion !== analysis.engineVersion && (
                <button
                  disabled={busy || playerBusy || phase === 'refining'}
                  onClick={() => void refine(true)}
                >
                  Reanalyze with current engine
                </button>
              )}
            {phase === 'refining' && (
              <button
                onClick={() => {
                  operation.current?.abort()
                  runtime.current?.cancelRefinement()
                }}
              >
                Cancel refinement
              </button>
            )}
            <button disabled={locked} onClick={() => void prepare()}>
              Discard current / new capture
            </button>
          </div>
          <LocalSessionPlayer
            ref={player}
            onOwnedBytes={setPlaybackBytes}
            key={sessionId}
            sessionId={sessionId}
            getPcm={getPcm}
            available={audioAvailable}
            disabled={phase === 'refining' || busy}
            onError={setError}
            onBusyChange={setPlayerBusy}
          />
          <label>
            Session name
            <input
              maxLength={200}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setSaved(false)
              }}
            />
          </label>
          <label className="live-check">
            <input
              type="checkbox"
              checked={keepAudio}
              disabled={!audioAvailable || locked}
              onChange={(event) => {
                setKeepAudio(event.target.checked)
                setSaved(false)
              }}
            />
            Keep audio for playback and refinement (
            {((analysis.durationSamples * 4) / 1048576).toFixed(1)} MiB)
          </label>
          <p>
            Results-only saves can be reopened without audio. Downloaded JSON
            contains results and annotations; download WAV separately to keep
            audio.
          </p>
          <div className="live-actions">
            <button disabled={locked} onClick={() => void save()}>
              {busy
                ? 'Saving…'
                : saved
                  ? 'Saved on this browser'
                  : 'Save on this browser'}
            </button>
            <button
              disabled={locked}
              onClick={() => {
                try {
                  downloadBlob(
                    exportListeningJson(metadata()),
                    'fretbloom-listening.json',
                  )
                } catch (reason) {
                  setError(captureErrorMessage(reason))
                }
              }}
            >
              Download results
            </button>
          </div>
        </section>
      )}
      <LiveVideo
        key={sessionId}
        capturePosition={capturePosition}
        anchors={anchors}
        onRemoveAnchor={(index) => {
          setAnchors((previous) => previous.filter((_, i) => i !== index))
          setSaved(false)
        }}
        capturing={phase === 'capturing'}
        onAnchor={(anchor) =>
          setAnchors((previous) => [...previous.slice(-63), anchor])
        }
        onBreak={() => capture.current?.pause('background_interruption')}
      />
      <details
        className="live-diagnostics"
        data-ui-audio-bytes={pcmBytes + playbackBytes + verificationBytes}
        data-pcm-bytes={pcmBytes}
        data-playback-bytes={playbackBytes}
        data-verification-bytes={verificationBytes}
        data-shared-pcm-bytes={diagnostics.sharedPcmBytes}
        data-owned-audio-bytes={ownedAudioBytes}
        data-runtime-js-bytes={diagnostics.ownedJsBytes}
      >
        <summary>Local engine details</summary>
        <p>
          {((pcmBytes + playbackBytes + verificationBytes) / 1048576).toFixed(
            2,
          )}{' '}
          MiB shared PCM and UI/verification audio buffers (PCM Blob counted
          once, WAV/copy and verification buffers). Native browser storage and
          process overhead are separate.
        </p>
        <p>
          {engineVersion ? `Engine ${engineVersion}` : 'Engine not ready'} ·{' '}
          {processingMs.toFixed(0)} ms latest analysis · {lag.toFixed(2)} s
          captured beyond analyzed evidence · {queued} queued blocks ·{' '}
          {(wasmBytes / 1048576).toFixed(1)} MiB WASM memory.
        </p>
        <p>
          {diagnostics.ownedJsBytes === undefined
            ? 'Owned JS buffer bytes unavailable'
            : `${(diagnostics.ownedJsBytes / 1048576).toFixed(1)} MiB runtime-owned JS buffers`}{' '}
          ·{' '}
          {diagnostics.queuedHighWater === undefined
            ? 'Queue high-water unavailable'
            : `${diagnostics.queuedHighWater} queue high-water`}{' '}
          ·{' '}
          {diagnostics.skippedWindows === undefined
            ? 'Skipped-window count unavailable'
            : `${diagnostics.skippedWindows} skipped live windows`}
        </p>
        <p>
          Capture, wall, and optional video clocks are separate. Evidence scores
          are not accuracy percentages.
        </p>
      </details>
      <ListeningSessions
        revision={collectionRevision}
        disabled={locked}
        onOpen={(session) => void openSaved(session)}
      />
    </section>
  )
}
