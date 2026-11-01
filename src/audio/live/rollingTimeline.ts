import type {
  AlignmentFeatures,
  AnalysisOptions,
  AnalysisResult,
  HarmonyEvent,
  NoteEvent,
} from '../analysisV1'
import { LIMITS } from './protocol'
import type { Key, TimelinePatch } from './protocol'

export type LiveNote = NoteEvent & { id: string }
type OriginNote = NoteEvent & { originStartSample: number }
type Span = { start: number; end: number }
function clipped<T extends Span>(
  events: T[],
  from: number,
  to: number,
  offset = 0,
): T[] {
  return events.flatMap((e) => {
    const start = Math.max(from, Math.round(e.start * 24000) + offset),
      end = Math.min(to, Math.round(e.end * 24000) + offset)
    return start < end ? [{ ...e, start: start / 24000, end: end / 24000 }] : []
  })
}
/** Retain the engine's attack boundary before clipping a window into cells. */
function clippedNotes(
  events: NoteEvent[],
  from: number,
  to: number,
  offset: number,
): OriginNote[] {
  return clipped(
    events.map((event) => ({
      ...event,
      originStartSample: Math.round(event.start * 24000) + offset,
    })),
    from,
    to,
    offset,
  )
}
function harmonyIdentity(h: HarmonyEvent): string {
  return JSON.stringify({
    kind: h.kind,
    bass: h.bass === null ? null : [h.bass.midi, h.bass.pitchClass],
    ...('reason' in h ? { reason: h.reason } : {}),
    ...('primary' in h ? { primary: h.primary.chord } : {}),
    ...('alternatives' in h
      ? { alternatives: h.alternatives.map((a) => a.chord) }
      : {}),
  })
}
function coalesceHarmony(events: HarmonyEvent[]): HarmonyEvent[] {
  const out: HarmonyEvent[] = []
  for (const e of events) {
    const prior = out.at(-1)
    if (
      prior &&
      Math.abs(prior.end - e.start) < 1 / 48000 &&
      harmonyIdentity(prior) === harmonyIdentity(e)
    )
      prior.end = e.end
    else out.push({ ...e })
  }
  return out
}
/** Mutable evidence is sampled onto 20 ms cells before coalescing into intervals. */
function evidenceCells<T extends Span>(
  events: T[],
  from: number,
  to: number,
  origin = 0,
): T[] {
  const out: T[] = []
  for (
    let cell = origin + Math.floor((from - origin) / 480) * 480;
    cell < to;
    cell += 480
  ) {
    const a = Math.max(from, cell),
      b = Math.min(to, cell + 480)
    // Keep distinct supported pitches; a release at the boundary never creates support in the next cell.
    for (const e of events) {
      const start = Math.max(a, Math.round(e.start * 24000)),
        end = Math.min(b, Math.round(e.end * 24000))
      if (start < end)
        out.push({ ...e, start: start / 24000, end: end / 24000 })
    }
  }
  return out
}
function mergeNotes(
  prefix: LiveNote[],
  events: OriginNote[],
  segmentId: number,
  stream: string,
): LiveNote[] {
  const out = prefix.map((n) => ({ ...n }))
  const tails = new Map(out.map((note) => [note.midi, note]))
  for (const { originStartSample, ...e } of events.sort(
    (a, b) => a.start - b.start || a.midi - b.midi,
  )) {
    const prior = tails.get(e.midi)
    // A clipped continuation may extend the prior event. An original attack
    // remains a boundary even when the same pitch ends at that exact sample.
    if (
      prior &&
      Math.abs(prior.end - e.start) < 1 / 48000 &&
      originStartSample < Math.round(e.start * 24000)
    )
      prior.end = e.end
    else {
      const note = {
        ...e,
        id: `${segmentId}:${stream}:${e.midi}:${Math.round(e.start * 24000)}`,
      }
      out.push(note)
      tails.set(note.midi, note)
    }
  }
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi)
}
export class RollingTimeline {
  settledThrough: number
  revision = 0
  private harmony: HarmonyEvent[] = []
  private mono: LiveNote[] = []
  private poly: LiveNote[] = []
  private warnings: AnalysisResult['warnings'] = []
  private lastEnd: number
  readonly missed: {
    segmentId: number
    startSample: number
    endSample: number
  }[] = []
  readonly key: Key
  readonly segmentId: number
  readonly segmentStart: number
  constructor(key: Key, segmentId: number, segmentStart: number) {
    this.key = key
    this.segmentId = segmentId
    this.segmentStart = segmentStart
    this.settledThrough = segmentStart
    this.lastEnd = segmentStart
  }
  fork(): RollingTimeline {
    const copy = new RollingTimeline(
      this.key,
      this.segmentId,
      this.segmentStart,
    )
    copy.settledThrough = this.settledThrough
    copy.revision = this.revision
    copy.lastEnd = this.lastEnd
    copy.harmony = this.harmony.map((h) => ({ ...h }))
    copy.mono = this.mono.map((n) => ({ ...n }))
    copy.poly = this.poly.map((n) => ({ ...n }))
    copy.warnings = this.warnings
    copy.missed.push(...this.missed.map((i) => ({ ...i })))
    return copy
  }
  apply(
    result: AnalysisResult,
    startSample: number,
    endSample: number,
    final = false,
  ): TimelinePatch | null {
    const validFrom =
      startSample === this.segmentStart
        ? this.segmentStart
        : startSample + LIMITS.warmup
    const from = Math.max(this.settledThrough, validFrom),
      to = final ? endSample : endSample - LIMITS.future
    if (to <= from) return null
    if (from > this.lastEnd)
      this.missed.push({
        segmentId: this.segmentId,
        startSample: this.lastEnd,
        endSample: from,
      })
    const harmony = coalesceHarmony(
      evidenceCells(
        clipped(result.harmony, from, to, startSample),
        from,
        to,
        this.segmentStart,
      ),
    )
    const mono = evidenceCells(
      clippedNotes(result.monophonicNotes, from, to, startSample),
      from,
      to,
      this.segmentStart,
    )
    const poly = evidenceCells(
      clippedNotes(result.polyphonicNotes, from, to, startSample),
      from,
      to,
      this.segmentStart,
    )
    const newHarmony = coalesceHarmony([
      ...clipped(this.harmony, this.segmentStart, from),
      ...harmony,
    ])
    const newMono = mergeNotes(
      clipped(this.mono, this.segmentStart, from),
      mono,
      this.segmentId,
      'mono',
    )
    const newPoly = mergeNotes(
      clipped(this.poly, this.segmentStart, from),
      poly,
      this.segmentId,
      'poly',
    )
    if (
      newHarmony.length > LIMITS.harmony ||
      newMono.length > LIMITS.notes ||
      newPoly.length > LIMITS.notes
    )
      throw new Error('Live event cap exceeded')
    this.harmony = newHarmony
    this.mono = newMono
    this.poly = newPoly
    this.lastEnd = to
    this.warnings = result.warnings
    this.settledThrough = Math.max(
      from,
      Math.min(to, final ? to : endSample - LIMITS.warmup),
    )
    return {
      ...this.key,
      revision: ++this.revision,
      segmentId: this.segmentId,
      replaceFromSample: from,
      replaceToSample: to,
      settledThroughSample: this.settledThrough,
      harmony,
      monophonicNotes: clipped(newMono, from, to),
      polyphonicNotes: clipped(newPoly, from, to),
      warnings: this.warnings,
      missedLiveIntervals: this.missed.map((i) => ({ ...i })),
    }
  }
  snapshot(
    endSample: number,
    engineVersion: string,
    options: AnalysisOptions,
  ): { result: AnalysisResult; features: AlignmentFeatures } {
    // Unanalyzed cells are explicit unknown evidence, never silent/no_chord claims.
    const complete: HarmonyEvent[] = []
    let cursor = this.segmentStart
    for (const h of this.harmony) {
      const start = Math.round(h.start * 24000)
      if (start > cursor)
        complete.push({
          start: cursor / 24000,
          end: start / 24000,
          bass: null,
          kind: 'unknown',
          reason: 'insufficient_evidence',
          alternatives: [],
        })
      complete.push(h)
      cursor = Math.round(h.end * 24000)
    }
    if (cursor < endSample)
      complete.push({
        start: cursor / 24000,
        end: endSample / 24000,
        bass: null,
        kind: 'unknown',
        reason: 'insufficient_evidence',
        alternatives: [],
      })
    const duration = (endSample - this.segmentStart) / 24000
    const relative = <T extends Span>(events: T[]) =>
      events.map((e) => ({
        ...e,
        start: (Math.round(e.start * 24000) - this.segmentStart) / 24000,
        end: (Math.round(e.end * 24000) - this.segmentStart) / 24000,
      }))
    return {
      result: {
        schemaVersion: 1,
        engineVersion,
        options,
        duration,
        sampleRateHz: 24000,
        timingResolutionSeconds: 0.02,
        tuning: { referenceHz: options.concertAHz, estimatedOffsetCents: null },
        harmony: relative(complete),
        monophonicNotes: relative(this.mono),
        polyphonicNotes: relative(this.poly),
        warnings: this.warnings,
      },
      features: {
        schemaVersion: 1,
        engineVersion,
        duration,
        hopSeconds: 0.08,
        frames: [],
      },
    }
  }
  get analyzedEnd(): number {
    return this.lastEnd
  }
}
