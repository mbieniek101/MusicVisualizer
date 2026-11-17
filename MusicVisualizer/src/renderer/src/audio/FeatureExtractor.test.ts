import { describe, expect, it } from 'vitest'
import { FeatureExtractor } from './FeatureExtractor'
import { frequencyToBin } from './dsp'
import type { AnalysisFrame, AudioFeatures } from './types'

const SAMPLE_RATE = 48000
const FFT_SIZE = 2048
const DT = 1 / 60
const SETTINGS = { gateDb: -60, sensitivity: 0.5 }

/**
 * Build what an AnalyserNode would report for a pure tone: a sine wave for the
 * samples, and a spectrum that's silent except at the tone's frequency.
 * `amplitude` 0 gives silence.
 */
function toneFrame(freq: number, amplitude: number): AnalysisFrame {
  const timeDomain = Float32Array.from(
    { length: FFT_SIZE },
    (_, i) => amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)
  )
  const spectrumDb = new Float32Array(FFT_SIZE / 2).fill(-120)
  if (amplitude > 0) {
    spectrumDb[frequencyToBin(freq, SAMPLE_RATE, FFT_SIZE / 2)] = 20 * Math.log10(amplitude / 2)
  }
  return { timeDomain, spectrumDb, sampleRate: SAMPLE_RATE, dt: DT }
}

/** Run the extractor on the same frame for `seconds`, returning the last result. */
function play(ex: FeatureExtractor, frame: AnalysisFrame, seconds: number): AudioFeatures {
  let last!: AudioFeatures
  for (let t = 0; t < seconds; t += DT) last = ex.update(frame, SETTINGS)
  return last
}

describe('FeatureExtractor', () => {
  it('reports nothing for silence', () => {
    const ex = new FeatureExtractor()
    const f = play(ex, toneFrame(440, 0), 1)
    expect(f.level).toBe(0)
    expect(f.onset).toBe(0)
    expect(f.isOnset).toBe(false)
  })

  it('treats input below the gate as silence', () => {
    const ex = new FeatureExtractor()
    // amplitude 0.0005 ≈ -69 dBFS RMS, under the -60 dB gate
    const f = play(ex, toneFrame(440, 0.0005), 1)
    expect(f.level).toBe(0)
    expect(f.isOnset).toBe(false)
  })

  it('detects the attack when a note starts after silence', () => {
    const ex = new FeatureExtractor()
    play(ex, toneFrame(440, 0), 1)
    const first = ex.update(toneFrame(440, 0.5), SETTINGS)
    expect(first.isOnset).toBe(true)
    expect(first.onset).toBe(1)
  })

  it('does not keep firing while the note sustains, and the onset value decays', () => {
    const ex = new FeatureExtractor()
    play(ex, toneFrame(440, 0), 1)
    ex.update(toneFrame(440, 0.5), SETTINGS)
    let fired = false
    let last!: AudioFeatures
    for (let i = 0; i < 60; i++) {
      last = ex.update(toneFrame(440, 0.5), SETTINGS)
      fired ||= last.isOnset
    }
    expect(fired).toBe(false)
    expect(last.onset).toBeLessThan(0.05)
  })

  it('reaches full level on sustained playing', () => {
    const ex = new FeatureExtractor()
    expect(play(ex, toneFrame(440, 0.3), 1).level).toBeGreaterThan(0.95)
  })

  it('puts a low note in the low band and a high note in the high band', () => {
    const lowNote = play(new FeatureExtractor(), toneFrame(110, 0.5), 1)
    const highNote = play(new FeatureExtractor(), toneFrame(3000, 0.5), 1)
    expect(lowNote.low).toBeGreaterThan(0.9)
    // Empty bands read near zero (the analyzer's noise floor is never exactly silent).
    expect(lowNote.high).toBeLessThan(0.01)
    expect(highNote.high).toBeGreaterThan(0.9)
    expect(highNote.low).toBeLessThan(0.01)
  })

  it('reads a higher tone as brighter', () => {
    const dark = play(new FeatureExtractor(), toneFrame(300, 0.5), 2)
    const bright = play(new FeatureExtractor(), toneFrame(2500, 0.5), 2)
    expect(bright.brightness).toBeGreaterThan(dark.brightness + 0.3)
  })

  it('flags clipping at full scale', () => {
    const ex = new FeatureExtractor()
    expect(ex.update(toneFrame(440, 1), SETTINGS).clipping).toBe(true)
    expect(ex.update(toneFrame(440, 0.5), SETTINGS).clipping).toBe(true) // held briefly
    expect(play(ex, toneFrame(440, 0.5), 1).clipping).toBe(false)
  })
})

describe('FeatureExtractor bends', () => {
  /** A harmonic tone at `hz`, as the analyser would report it. */
  function guitarFrame(hz: number, amplitude: number): AnalysisFrame {
    const timeDomain = Float32Array.from({ length: FFT_SIZE }, (_, i) => {
      let v = 0
      for (let h = 1; h <= 5; h++) v += Math.sin((2 * Math.PI * hz * h * i) / SAMPLE_RATE) / h
      return amplitude * 0.5 * v
    })
    const spectrumDb = new Float32Array(FFT_SIZE / 2).fill(-120)
    for (let h = 1; h <= 5; h++) {
      spectrumDb[frequencyToBin(hz * h, SAMPLE_RATE, FFT_SIZE / 2)] =
        20 * Math.log10(amplitude / (2 * h))
    }
    return { timeDomain, spectrumDb, sampleRate: SAMPLE_RATE, dt: DT }
  }

  it('reads a whole-step bend as ~1 while it happens, and 0 on an unbent note', () => {
    const ex = new FeatureExtractor()
    play(ex, toneFrame(196, 0), 0.5) // silence
    let f = play(ex, guitarFrame(196, 0.5), 0.3) // pick G and let it ring
    expect(Math.abs(f.bend)).toBeLessThan(0.05)

    // bend up a whole step over 0.3 s
    const values: number[] = []
    for (let i = 1; i <= 18; i++) {
      f = ex.update(guitarFrame(196 * Math.pow(2, (2 * i) / 18 / 12), 0.5), SETTINGS)
      values.push(f.bend)
    }
    f = play(ex, guitarFrame(196 * Math.pow(2, 2 / 12), 0.5), 0.2)
    expect(values[8]).toBeGreaterThan(0.3) // partway through the bend
    expect(f.bend).toBeCloseTo(1, 1)
  })
})
