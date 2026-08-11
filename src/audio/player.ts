import type { Song } from '../data/songs'
import { chordMidiNotes } from '../data/chords'
import { PluckSynth } from './synth'

export interface PlayerPosition {
  stepIndex: number
  /** 0..1 progress through the current step. */
  stepProgress: number
  playing: boolean
}

/**
 * Web Audio lookahead scheduler (the classic "tale of two clocks" pattern).
 * Audio events are scheduled ahead on the AudioContext clock so UI jank can
 * never cause timing lag; the UI polls position() from rAF.
 */
export class SongPlayer {
  private ctx: AudioContext
  private synth: PluckSynth
  private song: Song | null = null
  private timer: number | null = null

  private stepStartTimes: number[] = []
  private songStart = 0
  private nextStepToSchedule = 0

  onEnded: (() => void) | null = null

  constructor(ctx: AudioContext, destination?: AudioNode) {
    this.ctx = ctx
    this.synth = new PluckSynth(ctx)
    this.synth.out.connect(destination ?? ctx.destination)
  }

  get isPlaying(): boolean {
    return this.timer !== null
  }

  private stepDuration(stepIndex: number): number {
    const song = this.song!
    return (song.steps[stepIndex].beats * 60) / song.bpm
  }

  private songDuration(): number {
    const song = this.song!
    return song.steps.reduce((sum, s) => sum + (s.beats * 60) / song.bpm, 0)
  }

  play(song: Song): void {
    this.stop()
    this.song = song
    this.songStart = this.ctx.currentTime + 0.15
    this.stepStartTimes = []
    let t = 0
    for (let i = 0; i < song.steps.length; i++) {
      this.stepStartTimes.push(t)
      t += this.stepDuration(i)
    }
    this.nextStepToSchedule = 0
    this.schedule()
    this.timer = window.setInterval(() => this.schedule(), 100)
  }

  private schedule(): void {
    const song = this.song
    if (!song) return
    const lookahead = 0.35
    const horizon = this.ctx.currentTime + lookahead
    const total = this.songDuration()

    while (true) {
      const loopCount = Math.floor(this.nextStepToSchedule / song.steps.length)
      if (!song.loop && loopCount > 0) {
        // Finished a non-looping song: stop once audio has drained.
        const endsAt = this.songStart + total
        if (this.ctx.currentTime > endsAt + 0.5) {
          this.stop()
          this.onEnded?.()
        }
        return
      }
      const idx = this.nextStepToSchedule % song.steps.length
      const when = this.songStart + loopCount * total + this.stepStartTimes[idx]
      if (when > horizon) return

      const step = song.steps[idx]
      const midis = chordMidiNotes(step.chord)
      const dur = this.stepDuration(idx)
      if (step.strum === 'arpeggio') {
        this.synth.arpeggio(midis, when, dur * 0.92)
      } else {
        this.synth.strum(midis, when)
        // A lighter re-strum halfway through longer bars keeps the pulse alive.
        if (step.beats >= 4) this.synth.strum(midis, when + dur / 2, 0.035, 0.22)
      }
      this.nextStepToSchedule++
    }
  }

  position(): PlayerPosition {
    const song = this.song
    if (!song || this.timer === null) return { stepIndex: 0, stepProgress: 0, playing: false }
    const total = this.songDuration()
    let elapsed = this.ctx.currentTime - this.songStart
    if (elapsed < 0) elapsed = 0
    const inSong = song.loop ? elapsed % total : Math.min(elapsed, total - 0.001)
    let idx = 0
    for (let i = 0; i < this.stepStartTimes.length; i++) {
      if (inSong >= this.stepStartTimes[i]) idx = i
    }
    const stepStart = this.stepStartTimes[idx]
    const stepProgress = Math.min(1, (inSong - stepStart) / this.stepDuration(idx))
    return { stepIndex: idx, stepProgress, playing: true }
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    // Buffer sources are one-shot; letting scheduled tails ring out sounds
    // natural, but on an explicit stop we duck the bus briefly instead.
    const g = this.synth.out.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12)
    g.setValueAtTime(0.9, this.ctx.currentTime + 0.4)
  }
}
