/**
 * Pure signal-measurement functions. No state, no Web Audio: arrays in,
 * numbers out. Tested in dsp.test.ts.
 */

/** Root-mean-square of samples: the standard measure of loudness. A full-scale sine gives ~0.707. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/** Largest absolute sample value. 1.0 means the signal is hitting full scale (clipping). */
export function peak(samples: Float32Array): number {
  let max = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > max) max = a
  }
  return max
}

/** Linear amplitude → decibels relative to full scale. 1 → 0 dB, 0.5 → about -6 dB. */
export function toDb(amplitude: number): number {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity
}

/** Convert an analyser's dB spectrum to linear magnitudes, writing into `out`. */
export function dbToMagnitudes(spectrumDb: Float32Array, out: Float32Array): Float32Array {
  for (let i = 0; i < spectrumDb.length; i++) {
    const db = spectrumDb[i]
    out[i] = Number.isFinite(db) ? Math.pow(10, db / 20) : 0
  }
  return out
}

/**
 * Which bin a frequency falls in. The spectrum's bins evenly divide
 * 0 Hz .. sampleRate / 2 (the highest frequency a recording can contain).
 */
export function frequencyToBin(hz: number, sampleRate: number, binCount: number): number {
  const nyquist = sampleRate / 2
  return Math.min(binCount - 1, Math.max(0, Math.round((hz / nyquist) * binCount)))
}

export function binToFrequency(bin: number, sampleRate: number, binCount: number): number {
  return (bin / binCount) * (sampleRate / 2)
}

/** RMS of the magnitudes between two frequencies: how much is going on in that band. */
export function bandEnergy(
  magnitudes: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number
): number {
  const from = frequencyToBin(lowHz, sampleRate, magnitudes.length)
  const to = frequencyToBin(highHz, sampleRate, magnitudes.length)
  let sum = 0
  for (let i = from; i <= to; i++) sum += magnitudes[i] * magnitudes[i]
  return Math.sqrt(sum / (to - from + 1))
}

/**
 * Spectral centroid in Hz: the magnitude-weighted average frequency, i.e. the
 * spectrum's "center of mass". Brighter tones have a higher centroid.
 * Returns 0 when there's no energy in the range.
 */
export function spectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number
): number {
  const from = frequencyToBin(lowHz, sampleRate, magnitudes.length)
  const to = frequencyToBin(highHz, sampleRate, magnitudes.length)
  let weighted = 0
  let total = 0
  for (let i = from; i <= to; i++) {
    weighted += binToFrequency(i, sampleRate, magnitudes.length) * magnitudes[i]
    total += magnitudes[i]
  }
  return total > 0 ? weighted / total : 0
}

/**
 * Map a centroid in Hz to 0..1 on a log scale between `lowHz` and `highHz`.
 * Log because hearing is logarithmic: 200→400 Hz sounds as big a step as 2000→4000 Hz.
 */
export function centroidToBrightness(hz: number, lowHz = 150, highHz = 4000): number {
  if (hz <= 0) return 0
  const t = Math.log(hz / lowHz) / Math.log(highHz / lowHz)
  return Math.min(1, Math.max(0, t))
}

/**
 * Spectral flux: how much the spectrum *grew* since the last frame, summed
 * over the bins in range. A pick attack makes many bins jump at once, so flux
 * spikes. Decreases are ignored: a note dying away isn't an attack.
 */
export function spectralFlux(
  previous: Float32Array,
  current: Float32Array,
  fromBin: number,
  toBin: number
): number {
  let flux = 0
  for (let i = fromBin; i <= toBin; i++) {
    const rise = current[i] - previous[i]
    if (rise > 0) flux += rise
  }
  return flux
}
