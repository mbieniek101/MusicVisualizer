/**
 * What the audio side hands to the visual side every frame.
 *
 * Every continuous value is 0..1 so mappings can use them directly
 * ("warp + amount × low") without knowing anything about decibels or hertz.
 */
export interface AudioFeatures {
  /** Overall loudness, auto-leveled: your loudest recent playing ≈ 1. */
  level: number
  /** Energy in the low band (~40–250 Hz): low strings, palm mutes. */
  low: number
  /** Energy in the mid band (~250–2000 Hz): where most of a guitar lives. */
  mid: number
  /** Energy in the high band (~2–8 kHz): pick attack, fizz, cymbals. */
  high: number
  /** Tone brightness from the spectral centroid: dark neck pickup ≈ 0.3, bright bridge ≈ 0.7. */
  brightness: number
  /** Jumps to 1 on a pick attack, then decays back to 0 over a fraction of a second. */
  onset: number
  /** True only on the single frame an attack is detected. Good for triggering events. */
  isOnset: boolean
  /** How hard and busy your playing has been lately: builds over ~1.5 s, drains over ~3.5 s. See momentum.ts. */
  momentum: number
  /** A push from each attack that coasts back down; fast runs stack up. See momentum.ts. */
  surge: number
  /**
   * How far the held note is bent from where it was picked: 1 = a whole step up,
   * -1 = a whole step down, 0 = unbent (or a chord). Follows the bend as it happens. See bend.ts.
   */
  bend: number
  /** Raw input level in dBFS (0 = full scale), before gain normalizing. */
  inputDb: number
  /** True while the input is hitting full scale (turn the gain or amp output down). */
  clipping: boolean
}

/** What "no audio" looks like. Brightness is a neutral 0.5, so silence doesn't tint the colors. */
export const SILENT_FEATURES: AudioFeatures = {
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  brightness: 0.5,
  onset: 0,
  isOnset: false,
  momentum: 0,
  surge: 0,
  bend: 0,
  inputDb: -Infinity,
  clipping: false
}

/**
 * One frame of raw analyzer data, as read from Web Audio's AnalyserNode.
 * Kept as plain arrays so the feature code can be tested without a browser.
 */
export interface AnalysisFrame {
  /** The most recent block of samples, -1..1. */
  timeDomain: Float32Array
  /** Magnitude spectrum in dB, one value per frequency bin (bin i ≈ i × sampleRate / fftSize Hz). */
  spectrumDb: Float32Array
  sampleRate: number
  /** Seconds since the previous frame. */
  dt: number
}

/** The analysis settings the extractor needs (a subset of AudioSettings). */
export interface AnalysisSettings {
  gateDb: number
  sensitivity: number
}
