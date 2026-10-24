/**
 * Turns one frame of raw analyzer data into AudioFeatures.
 *
 *   samples + spectrum ──▶ measure (dsp.ts) ──▶ gate ──▶ normalize (AutoLevel)
 *                                                    ──▶ smooth (Envelope)
 *                                                    ──▶ momentum (momentum.ts)
 *   samples ──▶ pitch (pitch.ts) ──▶ bend (bend.ts) ──────────────────▶ AudioFeatures
 *
 * No Web Audio in here: AudioEngine reads the analyser and passes plain
 * arrays in, which is what lets FeatureExtractor.test.ts feed it synthetic
 * signals. Most of the "feel" of the reactivity lives in the constants at the
 * top of this file; they're good first things to tweak.
 */
import {
  bandEnergy,
  centroidToBrightness,
  dbToMagnitudes,
  frequencyToBin,
  peak,
  rms,
  spectralCentroid,
  spectralFlux,
  toDb
} from './dsp'
import { AutoLevel, Envelope, OnsetDetector } from './smoothing'
import { Momentum } from './momentum'
import { BendTracker } from './bend'
import { detectPitch, downsample2 } from './pitch'
import type { AnalysisFrame, AnalysisSettings, AudioFeatures } from './types'

// ---- tuning -------------------------------------------------------------------

/** Frequency bands in Hz. A guitar's low E is ~82 Hz; harmonics run up past 5 kHz. */
const BANDS = {
  low: [40, 250],
  mid: [250, 2000],
  high: [2000, 8000]
} as const

/** Range used for brightness and onset detection. */
const ANALYSIS_RANGE = [60, 8000] as const

/** Attack and release times in seconds for the smoothed outputs. */
const LEVEL_ENVELOPE = { attack: 0.01, release: 0.25 }
const BAND_ENVELOPE = { attack: 0.015, release: 0.3 }
const BRIGHTNESS_ENVELOPE = { attack: 0.08, release: 0.4 }
/** How long the `onset` value takes to fade after an attack. */
const ONSET_DECAY = 0.25

/** How long auto-leveling remembers your loudest playing. */
const AUTO_LEVEL_MEMORY = 4

/** How long `clipping` stays true after the input hits full scale, so the meter can show it. */
const CLIP_HOLD = 0.5

/**
 * Onset detection compares log-compressed spectra, log(1 + k × magnitude), so a
 * quiet pick attack shows up as clearly as a loud one.
 */
const ONSET_COMPRESSION = 1000

/**
 * Smallest flux (average rise per bin of the compressed spectrum) that can
 * count as an attack at all. A single pure tone starting gives ~0.016; a real
 * guitar note, lighting up many harmonics at once, gives far more.
 */
const ONSET_MIN_FLUX = 0.005

/** Pitch range to look for: just under a guitar's low E, up to the top frets of the high E. */
const PITCH_RANGE = [70, 1400] as const

// ---------------------------------------------------------------------------------

export class FeatureExtractor {
  private magnitudes = new Float32Array(0)
  private compressed = new Float32Array(0)
  private previousCompressed = new Float32Array(0)

  private levelNorm = new AutoLevel(AUTO_LEVEL_MEMORY, 0.001)
  private lowNorm = new AutoLevel(AUTO_LEVEL_MEMORY, 1e-3)
  private midNorm = new AutoLevel(AUTO_LEVEL_MEMORY, 1e-3)
  private highNorm = new AutoLevel(AUTO_LEVEL_MEMORY, 1e-3)

  private levelEnv = new Envelope(LEVEL_ENVELOPE.attack, LEVEL_ENVELOPE.release)
  private lowEnv = new Envelope(BAND_ENVELOPE.attack, BAND_ENVELOPE.release)
  private midEnv = new Envelope(BAND_ENVELOPE.attack, BAND_ENVELOPE.release)
  private highEnv = new Envelope(BAND_ENVELOPE.attack, BAND_ENVELOPE.release)
  private brightnessEnv = new Envelope(BRIGHTNESS_ENVELOPE.attack, BRIGHTNESS_ENVELOPE.release)

  constructor() {
    this.brightnessEnv.value = 0.5 // neutral until the first note
  }

  private onsets = new OnsetDetector()
  private momentum = new Momentum()
  private bendTracker = new BendTracker()
  private downsampled = new Float32Array(0)
  private onsetValue = 0
  private clipTimer = 0

  update(frame: AnalysisFrame, settings: AnalysisSettings): AudioFeatures {
    const { timeDomain, spectrumDb, sampleRate, dt } = frame
    this.ensureBuffers(spectrumDb.length)

    // 1. Measure.
    const inputRms = rms(timeDomain)
    const inputDb = toDb(inputRms)
    dbToMagnitudes(spectrumDb, this.magnitudes)

    // 2. Clipping check (held for a moment so it's visible).
    this.clipTimer = peak(timeDomain) >= 0.99 ? CLIP_HOLD : Math.max(0, this.clipTimer - dt)

    // 3. Gate: below the threshold, treat the input as silence.
    const gated = inputDb < settings.gateDb

    // 4. Normalize each measurement against its own recent peak, then smooth.
    //    While gated, targets are 0 so everything eases down to rest.
    // The level floor sits 20 dB above the gate, so playing that only just clears
    // the gate never gets normalized up to "loud".
    this.levelNorm.floor = Math.pow(10, (settings.gateDb + 20) / 20)
    const level = gated ? 0 : this.levelNorm.update(inputRms, dt)

    const low = gated ? 0 : this.lowNorm.update(this.band('low', sampleRate), dt)
    const mid = gated ? 0 : this.midNorm.update(this.band('mid', sampleRate), dt)
    const high = gated ? 0 : this.highNorm.update(this.band('high', sampleRate), dt)

    // Brightness holds its last value through silence instead of dropping to 0,
    // so color doesn't lurch between notes.
    const [rangeLow, rangeHigh] = ANALYSIS_RANGE
    const brightnessTarget = gated
      ? this.brightnessEnv.value
      : centroidToBrightness(spectralCentroid(this.magnitudes, sampleRate, rangeLow, rangeHigh))

    // 5. Onsets.
    const isOnset = this.detectOnset(sampleRate, settings.sensitivity, gated, dt)
    this.onsetValue = isOnset ? 1 : this.onsetValue * Math.exp(-dt / ONSET_DECAY)

    const smoothedLevel = this.levelEnv.update(level, dt)

    // 6. Momentum: how the playing has been building up over the last few seconds.
    const { energy, surge } = this.momentum.update(isOnset, smoothedLevel, dt)

    // 7. Bends: track the held note's pitch. Pitch detection is the most expensive
    //    step, so it runs at half the sample rate and is skipped during silence.
    const pitch = gated
      ? { hz: 0, clarity: 0 }
      : detectPitch(this.downsample(timeDomain), sampleRate / 2, PITCH_RANGE[0], PITCH_RANGE[1])
    const bend = this.bendTracker.update(pitch, isOnset, gated, dt)

    return {
      level: smoothedLevel,
      low: this.lowEnv.update(low, dt),
      mid: this.midEnv.update(mid, dt),
      high: this.highEnv.update(high, dt),
      brightness: this.brightnessEnv.update(brightnessTarget, dt),
      onset: this.onsetValue,
      isOnset,
      momentum: energy,
      surge,
      bend,
      inputDb,
      clipping: this.clipTimer > 0
    }
  }

  /** Forget everything (call when switching sources): copies a fresh extractor's state over this one. */
  reset(): void {
    Object.assign(this, new FeatureExtractor())
  }

  private band(name: keyof typeof BANDS, sampleRate: number): number {
    const [low, high] = BANDS[name]
    return bandEnergy(this.magnitudes, sampleRate, low, high)
  }

  private detectOnset(
    sampleRate: number,
    sensitivity: number,
    gated: boolean,
    dt: number
  ): boolean {
    for (let i = 0; i < this.magnitudes.length; i++) {
      this.compressed[i] = Math.log1p(ONSET_COMPRESSION * this.magnitudes[i])
    }
    const from = frequencyToBin(ANALYSIS_RANGE[0], sampleRate, this.magnitudes.length)
    const to = frequencyToBin(ANALYSIS_RANGE[1], sampleRate, this.magnitudes.length)
    // Per-bin average, so the threshold doesn't depend on the FFT size.
    const flux = spectralFlux(this.previousCompressed, this.compressed, from, to) / (to - from + 1)
    this.previousCompressed.set(this.compressed)

    const detected = this.onsets.update(flux, sensitivity, ONSET_MIN_FLUX, dt)
    return detected && !gated
  }

  private downsample(samples: Float32Array): Float32Array {
    if (this.downsampled.length !== samples.length >> 1) {
      this.downsampled = new Float32Array(samples.length >> 1)
    }
    return downsample2(samples, this.downsampled)
  }

  private ensureBuffers(binCount: number): void {
    if (this.magnitudes.length === binCount) return
    this.magnitudes = new Float32Array(binCount)
    this.compressed = new Float32Array(binCount)
    this.previousCompressed = new Float32Array(binCount)
  }
}
