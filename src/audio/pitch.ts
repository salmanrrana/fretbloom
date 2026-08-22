interface PitchRange {
  minFrequency?: number
  maxFrequency?: number
}

/**
 * Monophonic pitch detection via normalized autocorrelation (NSDF-style).
 * Phone microphones tend to be quiet, remove bass, and add a small DC offset,
 * so the frame is centered and downsampled before the longer correlation pass.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  { minFrequency = 70, maxFrequency = 1400 }: PitchRange = {},
): number | null {
  // Halving 44.1/48 kHz input keeps enough detail for strings while cutting
  // the autocorrelation work by roughly four — important on mobile Safari.
  const stride = sampleRate >= 40000 ? 2 : 1
  const rate = sampleRate / stride
  const n = Math.floor(buf.length / stride)
  const signal = new Float32Array(n)

  let mean = 0
  for (let i = 0; i < n; i++) {
    let sample = 0
    for (let j = 0; j < stride; j++) sample += buf[i * stride + j]
    signal[i] = sample / stride
    mean += signal[i]
  }
  mean /= n

  let rms = 0
  for (let i = 0; i < n; i++) {
    signal[i] -= mean
    rms += signal[i] * signal[i]
  }
  rms = Math.sqrt(rms / n)
  if (rms < 0.003) return null

  const maxLag = Math.min(n - 2, Math.floor(rate / minFrequency))
  const minLag = Math.max(2, Math.floor(rate / maxFrequency))
  if (minLag >= maxLag) return null

  // Prefix energy makes each NSDF normalization constant-time, leaving only
  // the correlation itself in the inner loop.
  const energy = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) energy[i + 1] = energy[i] + signal[i] * signal[i]

  const nsdf = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    const overlap = n - lag
    let acf = 0
    for (let i = 0; i < overlap; i++) acf += signal[i] * signal[i + lag]
    const norm = energy[overlap] + energy[n] - energy[lag]
    nsdf[lag] = norm > 0 ? (2 * acf) / norm : 0
  }

  // Take the first peak close to the tallest one. This favors the fundamental
  // over a later multiple without trusting weak room noise.
  let start = minLag
  while (start <= maxLag && nsdf[start] > 0) start++
  const peaks: { lag: number; value: number }[] = []
  for (let lag = Math.max(start, minLag + 1); lag < maxLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) {
      peaks.push({ lag, value: nsdf[lag] })
    }
  }
  if (peaks.length === 0) return null
  const tallest = Math.max(...peaks.map((peak) => peak.value))
  if (tallest < 0.75) return null
  const chosen = peaks.find((peak) => peak.value >= 0.9 * tallest)
  if (!chosen) return null

  // Parabolic interpolation for sub-sample lag precision.
  const a = nsdf[chosen.lag - 1]
  const b = nsdf[chosen.lag]
  const c = nsdf[chosen.lag + 1]
  const denominator = a - 2 * b + c
  const shift = denominator !== 0 ? (0.5 * (a - c)) / denominator : 0

  return rate / (chosen.lag + shift)
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
