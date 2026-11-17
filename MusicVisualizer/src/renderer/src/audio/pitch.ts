/**
 * Pitch detection: what note is ringing right now, in Hz.
 *
 * Uses YIN (de Cheveigné & Kawahara, 2002), the standard algorithm for a
 * single instrument. The idea: a note is a waveform that repeats. Slide a copy
 * of the signal against itself and find the smallest shift (the "lag") at which
 * it lines up with itself again. That lag is one period, and
 * sampleRate / lag is the pitch.
 *
 * It's reliable for single notes, which is when bends happen. For chords there
 * is no single pitch, and `clarity` comes out low, so callers can ignore it.
 *
 * Pure functions, no Web Audio. Tested in pitch.test.ts.
 */

export interface PitchResult {
  /** Fundamental frequency in Hz, or 0 if no pitch was found. */
  hz: number
  /** 0..1: how cleanly the signal repeats. Above ~0.85 is a clear single note. */
  clarity: number
}

const NO_PITCH: PitchResult = { hz: 0, clarity: 0 }

/**
 * @param samples    a block of audio, -1..1 (at least two periods of the lowest note)
 * @param sampleRate samples per second of `samples`
 * @param minHz      lowest pitch to look for (a guitar's low E is ~82 Hz)
 * @param maxHz      highest pitch to look for
 * @param threshold  how good a match counts as "the period" (YIN's default is 0.1–0.15)
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
  threshold = 0.15
): PitchResult {
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz))
  const maxLag = Math.ceil(sampleRate / minHz)
  // Compare a window of samples against itself shifted by up to maxLag.
  const window = samples.length - maxLag
  if (window < maxLag) return NO_PITCH

  // 1. Difference function: how different the signal is from itself `lag`
  //    samples later. Zero at a perfect repeat.
  // 2. Normalize by the running average ("cumulative mean normalized
  //    difference"), which stops tiny lags from looking like perfect matches
  //    and makes the threshold mean the same thing for loud and quiet notes.
  const cmnd = new Float32Array(maxLag + 1)
  cmnd[0] = 1
  let runningSum = 0
  for (let lag = 1; lag <= maxLag; lag++) {
    let diff = 0
    for (let i = 0; i < window; i++) {
      const d = samples[i] - samples[i + lag]
      diff += d * d
    }
    runningSum += diff
    cmnd[lag] = runningSum > 0 ? (diff * lag) / runningSum : 1
  }

  // 3. The first dip below the threshold is the period. (Taking the first, not
  //    the deepest, avoids picking two periods and reporting an octave too low.)
  //    Then walk down to the bottom of that dip.
  let lag = -1
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1] < cmnd[t]) t++
      lag = t
      break
    }
  }
  if (lag < 0) return NO_PITCH

  // 4. The true period usually falls between two samples. Fit a parabola
  //    through the dip and its neighbors to find where it really bottoms out.
  let refined = lag
  if (lag > minLag && lag < maxLag) {
    const a = cmnd[lag - 1]
    const b = cmnd[lag]
    const c = cmnd[lag + 1]
    const curve = a - 2 * b + c
    if (curve > 0) refined = lag + (a - c) / (2 * curve)
  }

  return { hz: sampleRate / refined, clarity: Math.max(0, 1 - cmnd[lag]) }
}

/**
 * Halve the sample rate by averaging pairs of samples (also a gentle low-pass,
 * which helps). Guitar fundamentals stay under ~1.4 kHz, so 24 kHz is plenty,
 * and pitch detection on half the samples costs a quarter of the work.
 */
export function downsample2(samples: Float32Array, out: Float32Array): Float32Array {
  const n = Math.min(out.length, samples.length >> 1)
  for (let i = 0; i < n; i++) out[i] = 0.5 * (samples[2 * i] + samples[2 * i + 1])
  return out
}

/** Distance between two frequencies in semitones (12 per octave). Positive if `hz` is higher. */
export function semitonesBetween(hz: number, referenceHz: number): number {
  return 12 * Math.log2(hz / referenceHz)
}
