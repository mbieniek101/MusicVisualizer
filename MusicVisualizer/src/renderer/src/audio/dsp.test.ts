import { describe, expect, it } from 'vitest'
import {
  bandEnergy,
  centroidToBrightness,
  frequencyToBin,
  peak,
  rms,
  spectralCentroid,
  spectralFlux,
  toDb
} from './dsp'

const SAMPLE_RATE = 48000
const BINS = 1024

function sine(freq: number, amplitude: number, length = 2048): Float32Array {
  return Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)
  )
}

/** A spectrum with energy in exactly one bin. */
function spikeAt(hz: number, magnitude = 1): Float32Array {
  const spectrum = new Float32Array(BINS)
  spectrum[frequencyToBin(hz, SAMPLE_RATE, BINS)] = magnitude
  return spectrum
}

describe('rms / peak / toDb', () => {
  it('measures a full-scale sine as ~0.707 RMS and 1.0 peak', () => {
    const s = sine(440, 1)
    expect(rms(s)).toBeCloseTo(Math.SQRT1_2, 2)
    expect(peak(s)).toBeCloseTo(1, 2)
  })

  it('converts amplitude to dBFS', () => {
    expect(toDb(1)).toBe(0)
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(toDb(0)).toBe(-Infinity)
  })
})

describe('frequency bins', () => {
  it('maps 1 kHz to the right bin', () => {
    // 1024 bins cover 0..24 kHz, so each bin is ~23.4 Hz wide.
    expect(frequencyToBin(1000, SAMPLE_RATE, BINS)).toBe(43)
  })
})

describe('bandEnergy', () => {
  it('only counts energy inside the band', () => {
    const lowNote = spikeAt(100)
    expect(bandEnergy(lowNote, SAMPLE_RATE, 40, 250)).toBeGreaterThan(0)
    expect(bandEnergy(lowNote, SAMPLE_RATE, 2000, 8000)).toBe(0)
  })
})

describe('spectralCentroid and brightness', () => {
  it('finds the frequency of a single tone', () => {
    expect(spectralCentroid(spikeAt(1000), SAMPLE_RATE, 60, 8000)).toBeCloseTo(1000, -2)
  })

  it('is 0 for silence', () => {
    expect(spectralCentroid(new Float32Array(BINS), SAMPLE_RATE, 60, 8000)).toBe(0)
  })

  it('maps higher centroids to higher brightness, clamped to 0..1', () => {
    expect(centroidToBrightness(300)).toBeLessThan(centroidToBrightness(3000))
    expect(centroidToBrightness(10)).toBe(0)
    expect(centroidToBrightness(20000)).toBe(1)
  })
})

describe('spectralFlux', () => {
  it('counts rises and ignores falls', () => {
    const before = Float32Array.from([0, 1, 1])
    const after = Float32Array.from([1, 1, 0])
    expect(spectralFlux(before, after, 0, 2)).toBe(1)
  })
})
