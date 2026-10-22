import { describe, expect, it } from 'vitest'
import { AutoLevel, Envelope, OnsetDetector } from './smoothing'

/** Feed the same input for `seconds`, in steps of `dt`. */
function run(update: (dt: number) => number, seconds: number, dt = 1 / 60): number {
  let out = 0
  for (let t = 0; t < seconds - 1e-9; t += dt) out = update(dt)
  return out
}

describe('Envelope', () => {
  it('rises fast and falls slowly', () => {
    const env = new Envelope(0.01, 0.25)
    expect(run((dt) => env.update(1, dt), 0.05)).toBeGreaterThan(0.95)
    expect(run((dt) => env.update(0, dt), 0.05)).toBeGreaterThan(0.75)
  })

  it('behaves the same at different frame rates', () => {
    const at60 = new Envelope(0.1, 0.1)
    const at30 = new Envelope(0.1, 0.1)
    const a = run((dt) => at60.update(1, dt), 0.2, 1 / 60)
    const b = run((dt) => at30.update(1, dt), 0.2, 1 / 30)
    expect(a).toBeCloseTo(b, 5)
  })
})

describe('AutoLevel', () => {
  it('reads ~1 for your loudest recent playing', () => {
    const norm = new AutoLevel(4, 0.001)
    expect(run((dt) => norm.update(0.2, dt), 1)).toBeCloseTo(1, 5)
  })

  it('reads quieter playing as a fraction, then adapts to it over time', () => {
    const norm = new AutoLevel(4, 0.001)
    run((dt) => norm.update(0.4, dt), 1)
    expect(norm.update(0.1, 1 / 60)).toBeCloseTo(0.25, 2)
    expect(run((dt) => norm.update(0.1, dt), 10)).toBeCloseTo(1, 5)
  })

  it('does not blow silence up to full scale', () => {
    const norm = new AutoLevel(4, 0.01)
    expect(run((dt) => norm.update(0.0001, dt), 10)).toBeLessThan(0.02)
  })
})

describe('OnsetDetector', () => {
  it('ignores steady flux and fires on a spike', () => {
    const detector = new OnsetDetector()
    let anyDuringSteady = false
    for (let i = 0; i < 120; i++) {
      if (detector.update(0.1, 0.5, 0.02, 1 / 60)) anyDuringSteady = true
    }
    expect(anyDuringSteady).toBe(false)
    expect(detector.update(0.5, 0.5, 0.02, 1 / 60)).toBe(true)
  })

  it('needs a bigger spike at low sensitivity', () => {
    const settle = (d: OnsetDetector): void => {
      for (let i = 0; i < 120; i++) d.update(0.1, 0.5, 0.02, 1 / 60)
    }
    const sensitive = new OnsetDetector()
    const strict = new OnsetDetector()
    settle(sensitive)
    settle(strict)
    expect(sensitive.update(0.2, 1, 0.02, 1 / 60)).toBe(true)
    expect(strict.update(0.2, 0, 0.02, 1 / 60)).toBe(false)
  })

  it('does not fire twice within the minimum interval', () => {
    const detector = new OnsetDetector()
    for (let i = 0; i < 120; i++) detector.update(0.05, 0.5, 0.02, 1 / 60)
    expect(detector.update(1, 0.5, 0.02, 1 / 60)).toBe(true)
    expect(detector.update(5, 0.5, 0.02, 1 / 60)).toBe(false)
  })
})
