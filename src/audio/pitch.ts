/**
 * Monophonic pitch detection via normalized autocorrelation (NSDF-style),
 * good for single plucked strings — powers the tuner and note matching.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length

  let rms = 0
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.008) return null // too quiet to trust

  // Guitar range: ~70 Hz (drop D margin) to ~1400 Hz.
  const maxLag = Math.floor(sampleRate / 70)
  const minLag = Math.floor(sampleRate / 1400)
  const size = Math.min(n, maxLag * 2)

  const nsdf = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0
    let norm = 0
    for (let i = 0; i + lag < size; i++) {
      acf += buf[i] * buf[i + lag]
      norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag]
    }
    nsdf[lag] = norm > 0 ? (2 * acf) / norm : 0
  }

  // Collect local maxima after the first zero crossing, then take the FIRST
  // peak within 90% of the tallest (McLeod) — avoids octave-down errors where
  // a later, marginally-taller peak at 2x/3x the period wins.
  let start = minLag
  while (start <= maxLag && nsdf[start] > 0) start++
  const peaks: { lag: number; val: number }[] = []
  for (let lag = start; lag < maxLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) {
      peaks.push({ lag, val: nsdf[lag] })
    }
  }
  if (peaks.length === 0) return null
  const tallest = Math.max(...peaks.map((p) => p.val))
  if (tallest < 0.8) return null
  const chosen = peaks.find((p) => p.val >= 0.9 * tallest)!
  const bestLag = chosen.lag

  // Parabolic interpolation for sub-sample lag precision.
  const a = nsdf[bestLag - 1]
  const b = nsdf[bestLag]
  const c = nsdf[bestLag + 1]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
  const lag = bestLag + shift

  return sampleRate / lag
}

/**
 * Rough chroma (pitch-class energy) via a Goertzel bank over guitar-range
 * fundamentals. Used by listen mode to score how much of a chord is present
 * even when several strings ring at once.
 */
export function chromaEnergies(buf: Float32Array, sampleRate: number): Float32Array {
  const chroma = new Float32Array(12)
  const n = buf.length
  // Fundamentals from E2 (midi 40) up to E5 (midi 76).
  for (let midi = 40; midi <= 76; midi++) {
    const freq = 440 * 2 ** ((midi - 69) / 12)
    const w = (2 * Math.PI * freq) / sampleRate
    const coeff = 2 * Math.cos(w)
    let s0 = 0
    let s1 = 0
    let s2 = 0
    for (let i = 0; i < n; i++) {
      s0 = buf[i] + coeff * s1 - s2
      s2 = s1
      s1 = s0
    }
    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2
    chroma[((midi % 12) + 12) % 12] += power
  }
  return chroma
}

/**
 * Score 0..1: energy share of the chord's pitch classes, times a coverage
 * term requiring every chord tone to actually sound. The coverage term is
 * what separates E from Em (they differ by a single third): playing E at an
 * Em target leaves the target's G silent, which caps the score low even
 * though the other notes overlap.
 */
export function chordMatchScore(chroma: Float32Array, pitchClasses: Set<number>): number {
  let inChord = 0
  let total = 0
  let max = 0
  for (let pc = 0; pc < 12; pc++) {
    total += chroma[pc]
    if (chroma[pc] > max) max = chroma[pc]
    if (pitchClasses.has(pc)) inChord += chroma[pc]
  }
  if (total <= 0 || max <= 0) return 0
  const share = inChord / total
  let present = 0
  for (const pc of pitchClasses) {
    if (chroma[pc] > 0.06 * max) present++
  }
  const coverage = present / pitchClasses.size
  return share * coverage
}
