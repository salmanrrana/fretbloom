import { useState } from 'react'
import type { HarmonyEvent } from '../audio/analysisV1'
import type {
  CaptureSegment,
  LocalAnalysis,
  TimelinePatch,
  LiveNoteEvent,
  MissedLiveInterval,
} from '../audio/live/protocol'

export type TimelineItem =
  | { segmentId: number; stream: 'harmony'; event: HarmonyEvent }
  | {
      segmentId: number
      stream: 'monophonic' | 'polyphonic'
      event: LiveNoteEvent
    }
export type LiveTimelineState = {
  items: TimelineItem[]
  settled: Record<number, number>
  revisions: Record<number, number>
  missed: MissedLiveInterval[]
}
export const EMPTY_TIMELINE: LiveTimelineState = {
  items: [],
  settled: {},
  revisions: {},
  missed: [],
}
function clipItem(
  item: TimelineItem,
  start: number,
  end: number,
): TimelineItem {
  if (item.stream === 'harmony')
    return { ...item, event: { ...item.event, start, end } }
  return { ...item, event: { ...item.event, start, end } }
}
export function applyTimelinePatch(
  previous: LiveTimelineState,
  patch: TimelinePatch,
): LiveTimelineState {
  if (patch.revision <= (previous.revisions[patch.segmentId] ?? -1))
    return previous
  const start = patch.replaceFromSample / 24000
  const end = patch.replaceToSample / 24000
  const kept = previous.items.flatMap((item): TimelineItem[] => {
    if (
      item.segmentId !== patch.segmentId ||
      item.event.end <= start ||
      item.event.start >= end
    )
      return [item]
    const parts: TimelineItem[] = []
    if (item.event.start < start)
      parts.push(clipItem(item, item.event.start, start))
    if (item.event.end > end) parts.push(clipItem(item, end, item.event.end))
    return parts
  })
  const incoming: TimelineItem[] = [
    ...patch.harmony.map((event): TimelineItem => ({
      segmentId: patch.segmentId,
      stream: 'harmony',
      event,
    })),
    ...patch.monophonicNotes.map((event): TimelineItem => ({
      segmentId: patch.segmentId,
      stream: 'monophonic',
      event,
    })),
    ...patch.polyphonicNotes.map((event): TimelineItem => ({
      segmentId: patch.segmentId,
      stream: 'polyphonic',
      event,
    })),
  ]
  const joined: TimelineItem[] = []
  const byId = new Map<string, number>()
  for (const item of [...kept, ...incoming].sort(
    (a, b) => a.event.start - b.event.start,
  )) {
    const id =
      item.stream === 'harmony' || !item.event.id
        ? undefined
        : `${item.segmentId}-${item.stream}-${item.event.id}`
    const priorIndex = id === undefined ? undefined : byId.get(id)
    const prior = priorIndex === undefined ? undefined : joined[priorIndex]
    if (
      prior &&
      priorIndex !== undefined &&
      Math.abs(prior.event.end - item.event.start) < 1e-8
    ) {
      joined[priorIndex] = clipItem(prior, prior.event.start, item.event.end)
    } else {
      if (id !== undefined) byId.set(id, joined.length)
      joined.push(item)
    }
  }
  return {
    missed:
      patch.missedLiveIntervals === undefined
        ? previous.missed
        : [
            ...previous.missed.filter(
              (interval) => interval.segmentId !== patch.segmentId,
            ),
            ...patch.missedLiveIntervals,
          ],
    revisions: { ...previous.revisions, [patch.segmentId]: patch.revision },
    settled: {
      ...previous.settled,
      [patch.segmentId]: patch.settledThroughSample,
    },
    items: joined.sort(
      (a, b) =>
        a.event.start - b.event.start || a.stream.localeCompare(b.stream),
    ),
  }
}
export function timelineFromAnalysis(
  analysis: LocalAnalysis,
): LiveTimelineState {
  const items: TimelineItem[] = []
  for (const segment of analysis.results) {
    const offset = segment.offsetSample / 24000
    for (const event of segment.result.harmony)
      items.push({
        segmentId: segment.segmentId,
        stream: 'harmony',
        event: {
          ...event,
          start: event.start + offset,
          end: event.end + offset,
        },
      })
    for (const stream of ['monophonic', 'polyphonic'] as const) {
      for (const event of segment.result[
        stream === 'monophonic' ? 'monophonicNotes' : 'polyphonicNotes'
      ])
        items.push({
          segmentId: segment.segmentId,
          stream,
          event: {
            ...event,
            start: event.start + offset,
            end: event.end + offset,
          },
        })
    }
  }
  return {
    missed: analysis.missedLiveIntervals ?? [],
    items: items.sort((a, b) => a.event.start - b.event.start),
    settled: Object.fromEntries(
      analysis.segments.map((segment) => [segment.id, segment.endSample]),
    ),
    revisions: {},
  }
}
export function timelineLabel(item: TimelineItem): string {
  if (item.stream !== 'harmony')
    return `${item.event.name} · MIDI ${item.event.midi} · ${item.stream} notes`
  const event = item.event
  const alternatives =
    event.kind !== 'no_chord' && event.alternatives.length
      ? ` · alternatives: ${event.alternatives.map((candidate) => candidate.label).join(', ')}`
      : ''
  return (
    (event.kind === 'chord'
      ? event.primary.label
      : event.kind === 'unknown'
        ? 'Unclear chord'
        : 'No chord') + alternatives
  )
}
export function captureTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}
export function LiveTimeline({
  timeline,
  durationSamples,
  segments = [],
  active,
  refined = false,
}: {
  timeline: LiveTimelineState
  durationSamples: number
  segments?: CaptureSegment[]
  active: boolean
  refined?: boolean
}) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<TimelineItem | null>(null)
  const pixelsPerSecond = Math.max(
    36,
    600 / Math.max(5, durationSamples / 24000),
  )
  const width = Math.max(600, (durationSamples / 24000) * pixelsPerSecond)
  const pages = Math.max(1, Math.ceil(timeline.items.length / 50))
  const currentPage = Math.min(page, pages - 1)
  const settled = (item: TimelineItem) =>
    item.event.end * 24000 <= (timeline.settled[item.segmentId] ?? 0)
  return (
    <section className="live-timeline" aria-label="Notes and harmony">
      <h3>Notes &amp; harmony</h3>
      <p>
        Time since capture started · {active ? 'Recent notes may change. ' : ''}
        Settled means stable in the live view, not verified.
      </p>
      {timeline.items.length === 0 && (
        <p className="live-empty">
          {durationSamples < 30720
            ? 'Still settling. The first events need at least 1.28 seconds of continuous sound.'
            : 'No note or harmony events yet. Quiet and unclear passages may remain empty.'}
        </p>
      )}
      <div
        className="live-timeline-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable timeline. Use arrow keys to move between events."
      >
        <div className="live-timeline-track" style={{ width }}>
          <div className="live-lane-labels" aria-hidden="true">
            <span>Harmony</span>
            <span>Single notes</span>
            <span>Layered notes</span>
          </div>
          {segments
            .filter((part) => part.precedingGap)
            .map((part) => (
              <span
                className="live-gap"
                key={part.id}
                style={{
                  left: (part.startSample / 24000) * pixelsPerSecond,
                }}
                title={part.precedingGap?.reason}
              >
                Gap
              </span>
            ))}
          {!refined &&
            timeline.missed.map((interval) => (
              <span
                className="live-missed"
                key={`${interval.segmentId}-${interval.startSample}`}
                style={{
                  left: (interval.startSample / 24000) * pixelsPerSecond,
                  width: Math.max(
                    8,
                    ((interval.endSample - interval.startSample) / 24000) *
                      pixelsPerSecond,
                  ),
                }}
              >
                Not analyzed live
              </span>
            ))}
          {timeline.items.map((item, index) => (
            <button
              key={
                item.stream !== 'harmony' && item.event.id
                  ? `${item.event.id}-${item.event.start}`
                  : `${item.segmentId}-${item.stream}-${item.event.start}-${index}`
              }
              className={`live-event ${settled(item) ? 'settled' : 'tentative'} ${item.stream}`}
              style={{
                left: `${item.event.start * pixelsPerSecond}px`,
                width: Math.max(
                  16,
                  (item.event.end - item.event.start) * pixelsPerSecond,
                ),
                top:
                  item.stream === 'harmony'
                    ? 34
                    : item.stream === 'monophonic'
                      ? 90
                      : 146,
              }}
              aria-label={`${captureTime(item.event.start)} to ${captureTime(item.event.end)}: ${timelineLabel(item)}. ${settled(item) ? 'Settled' : 'Still settling'}`}
              onClick={() => setSelected(item)}
              onKeyDown={(event) => {
                if (
                  !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return
                event.preventDefault()
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '.live-event',
                  )
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? timeline.items.length - 1
                      : index + (event.key === 'ArrowRight' ? 1 : -1)
                buttons?.[
                  Math.max(0, Math.min(timeline.items.length - 1, next))
                ]?.focus()
              }}
            >
              <span>
                {item.stream === 'harmony'
                  ? item.event.kind === 'chord'
                    ? item.event.primary.label
                    : item.event.kind === 'unknown'
                      ? 'Unclear'
                      : 'No chord'
                  : item.event.name}
              </span>
              <small>{settled(item) ? 'Settled' : 'Settling'}</small>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <p className="live-event-detail">
          {captureTime(selected.event.start)}–{captureTime(selected.event.end)}{' '}
          · {timelineLabel(selected)} ·{' '}
          {settled(selected) ? 'Settled' : 'Still settling'}
        </p>
      )}
      {timeline.missed.length > 0 && (
        <p>
          {refined
            ? 'Live analysis skipped some intervals; refinement now supplies their recorded evidence.'
            : 'Not analyzed live: ' +
              timeline.missed
                .map(
                  (interval) =>
                    `${captureTime(interval.startSample / 24000)}–${captureTime(interval.endSample / 24000)}`,
                )
                .join(', ') +
              '. Retained audio can be refined after stopping.'}
        </p>
      )}
      <details>
        <summary>Read event list ({timeline.items.length})</summary>
        <ol className="live-event-list" start={currentPage * 50 + 1}>
          {timeline.items
            .slice(currentPage * 50, currentPage * 50 + 50)
            .map((item, index) => (
              <li key={index}>
                <time>
                  {captureTime(item.event.start)}–{captureTime(item.event.end)}
                </time>{' '}
                {timelineLabel(item)}{' '}
                <em>{settled(item) ? 'Settled' : 'Still settling'}</em>
              </li>
            ))}
        </ol>
        {pages > 1 && (
          <div className="live-actions">
            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous events
            </button>
            <span>
              Page {currentPage + 1} of {pages}
            </span>
            <button
              disabled={currentPage + 1 === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next events
            </button>
          </div>
        )}
      </details>
      {segments.some((part) => part.precedingGap) && (
        <ul className="live-gap-list">
          {segments
            .filter((part) => part.precedingGap)
            .map((part) => (
              <li key={part.id}>
                {captureTime(part.startSample / 24000)}: gap ·{' '}
                {part.precedingGap?.reason.replaceAll('_', ' ')}
                {part.precedingGap?.wallDurationMs != null
                  ? ` (${(part.precedingGap.wallDurationMs / 1000).toFixed(1)} seconds wall time)`
                  : ''}
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}
