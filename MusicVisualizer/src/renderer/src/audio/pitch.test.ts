import { describe, expect, it } from 'vitest'
import { detectPitch, downsample2, semitonesBetween } from './pitch'

const SR = 24000 // the rate pitch detection runs at, after downsampling
const N = 1024

/** A guitar-ish tone: a fundamental plus a few weaker harmonics. */
function tone(hz: number, harmonics = 5, length = N, sampleRate = SR): Float32Array {
  return Float32Array.from({ length }, (_, i) => {
    let v = 0
    for (let h = 1; h <= harmonics; h++) v += Math.sin((2 * Math.PI * hz * h * i) / sampleRate) / h
    return 0.3 * v
  })
}

describe('detectPitch', () => {
  // Guitar range: low E, A string, a mid note, high frets on the e string.
  for (const hz of [82.41, 110, 329.6, 1046.5]) {
    it(`finds ${hz} Hz within 10 cents`, () => {
      const result = detectPitch(tone(hz), SR, 70, 1400)
      expect(Math.abs(semitonesBetween(result.hz, hz))).toBeLessThan(0.1)
      expect(result.clarity).toBeGreaterThan(0.85)
    })
  }

  it('finds the fundamental, not a louder harmonic or an octave below', () => {
    // second harmonic three times louder than the fundamental
    const s = Float32Array.from(
      { length: N },
      (_, i) =>
        0.1 * Math.sin((2 * Math.PI * 196 * i) / SR) + 0.3 * Math.sin((2 * Math.PI * 392 * i) / SR)
    )
    expect(Math.abs(semitonesBetween(detectPitch(s, SR, 70, 1400).hz, 196))).toBeLessThan(0.1)
  })

  it('tells a quarter-tone apart (enough resolution to follow a bend)', () => {
    const a = detectPitch(tone(196), SR, 70, 1400).hz
    const b = detectPitch(tone(196 * Math.pow(2, 0.5 / 12)), SR, 70, 1400).hz
    expect(semitonesBetween(b, a)).toBeCloseTo(0.5, 1)
  })

  it('reports no clear pitch for noise', () => {
    let seed = 1
    const noise = Float32Array.from({ length: N }, () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647 - 0.5
    })
    expect(detectPitch(noise, SR, 70, 1400).clarity).toBeLessThan(0.85)
  })

  it('reports nothing for silence', () => {
    expect(detectPitch(new Float32Array(N), SR, 70, 1400).hz).toBe(0)
  })
})

describe('downsample2', () => {
  it('keeps the pitch the same at half the sample rate', () => {
    const full = tone(220, 5, 2048, 48000)
    const half = downsample2(full, new Float32Array(1024))
    expect(Math.abs(semitonesBetween(detectPitch(half, 24000, 70, 1400).hz, 220))).toBeLessThan(0.1)
  })
})
