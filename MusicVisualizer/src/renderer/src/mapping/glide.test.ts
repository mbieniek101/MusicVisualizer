import { describe, expect, it } from 'vitest'
import { ParamGlide } from './glide'

const DT = 1 / 60

/** Hold `target` for `seconds`, returning the glided value each frame. */
function hold(glide: ParamGlide, target: number, seconds: number, smoothness = 1): number[] {
  const values: number[] = []
  for (let t = 0; t < seconds - 1e-9; t += DT)
    values.push(glide.update({ x: target }, DT, smoothness).x)
  return values
}

describe('ParamGlide', () => {
  it('starts at the first target instead of sliding in from zero', () => {
    const glide = new ParamGlide({ x: { rise: 1, fall: 1 } })
    expect(glide.update({ x: 5 }, DT, 1).x).toBe(5)
  })

  it('eases in: the first frame after a change moves far less than a single smoothing stage would', () => {
    const glide = new ParamGlide({ x: { rise: 0.5, fall: 0.5 } })
    hold(glide, 0, 0.1)
    const firstFrame = hold(glide, 1, DT)[0]
    // A single stage that also reaches 90% in 0.5 s (time constant 0.5 / 2.3)
    const singleStage = 1 - Math.exp((-DT * 2.3) / 0.5)
    expect(firstFrame).toBeLessThan(singleStage / 4)
  })

  it('gets most of the way to the target in the glide time, and all of it soon after', () => {
    const glide = new ParamGlide({ x: { rise: 0.5, fall: 0.5 } })
    hold(glide, 0, 0.1)
    const values = hold(glide, 1, 2)
    expect(values[Math.round(0.5 / DT) - 1]).toBeGreaterThan(0.88)
    expect(values[values.length - 1]).toBeGreaterThan(0.99)
  })

  it('uses the fall time on the way down', () => {
    const glide = new ParamGlide({ x: { rise: 0.1, fall: 1 } })
    hold(glide, 0, 0.1)
    const up = hold(glide, 1, 0.3)
    const down = hold(glide, 0, 0.3)
    expect(up[up.length - 1]).toBeGreaterThan(0.95) // fast rise
    expect(down[down.length - 1]).toBeGreaterThan(0.5) // slow fall: still more than halfway up
  })

  it('scales with smoothness, and smoothness 0 passes values straight through', () => {
    const slow = new ParamGlide({ x: { rise: 0.5, fall: 0.5 } })
    const fast = new ParamGlide({ x: { rise: 0.5, fall: 0.5 } })
    hold(slow, 0, 0.1, 2)
    hold(fast, 0, 0.1, 1)
    expect(hold(slow, 1, 0.3, 2).at(-1)!).toBeLessThan(hold(fast, 1, 0.3, 1).at(-1)!)

    const off = new ParamGlide({ x: { rise: 0.5, fall: 0.5 } })
    hold(off, 0, 0.1, 0)
    expect(hold(off, 1, DT, 0)[0]).toBe(1)
  })

  it('leaves parameters without a glide spec untouched', () => {
    const glide = new ParamGlide({ x: { rise: 1, fall: 1 } })
    glide.update({ x: 0, y: 0 }, DT, 1)
    expect(glide.update({ x: 1, y: 1 }, DT, 1).y).toBe(1)
  })
})
