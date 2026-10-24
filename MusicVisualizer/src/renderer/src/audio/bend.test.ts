import { describe, expect, it } from 'vitest'
import { BendTracker } from './bend'
import type { PitchResult } from './pitch'

const DT = 1 / 60
const G3 = 196
const clear = (hz: number): PitchResult => ({ hz, clarity: 0.95 })
const muddy: PitchResult = { hz: 150, clarity: 0.4 }
/** `hz` raised by `semitones`. */
const up = (hz: number, semitones: number): number => hz * Math.pow(2, semitones / 12)

/** Pick a note and let it ring unbent for `seconds`. */
function pick(b: BendTracker, hz: number, seconds = 0.2): number {
  let v = b.update(clear(hz), true, false, DT)
  for (let t = DT; t < seconds; t += DT) v = b.update(clear(hz), false, false, DT)
  return v
}

/** Bend smoothly from `fromHz` by `semitones` over `seconds`, then hold briefly. */
function bend(b: BendTracker, fromHz: number, semitones: number, seconds = 0.3): number[] {
  const out: number[] = []
  const frames = Math.round(seconds / DT)
  for (let i = 1; i <= frames; i++)
    out.push(b.update(clear(up(fromHz, (semitones * i) / frames)), false, false, DT))
  for (let i = 0; i < 6; i++) out.push(b.update(clear(up(fromHz, semitones)), false, false, DT))
  return out
}

describe('BendTracker', () => {
  it('reads 0 for a steady, unbent note', () => {
    expect(Math.abs(pick(new BendTracker(), G3))).toBeLessThan(0.01)
  })

  it('reads ~1 for a whole-step bend, and ~0.5 for a half step', () => {
    const whole = new BendTracker()
    pick(whole, G3)
    expect(bend(whole, G3, 2).at(-1)).toBeCloseTo(1, 1)

    const half = new BendTracker()
    pick(half, G3)
    expect(bend(half, G3, 1).at(-1)).toBeCloseTo(0.5, 1)
  })

  it('follows the bend as it happens, not only at the end', () => {
    const b = new BendTracker()
    pick(b, G3)
    const values = bend(b, G3, 2)
    const halfway = values[Math.round(values.length / 2) - 3]
    expect(halfway).toBeGreaterThan(0.3)
    expect(halfway).toBeLessThan(0.8)
  })

  it('goes negative when bending down from the picked pitch', () => {
    const b = new BendTracker()
    pick(b, G3)
    expect(bend(b, G3, -1).at(-1)!).toBeLessThan(-0.4)
  })

  it('treats a sudden jump (hammer-on) as a new note, not a bend', () => {
    const b = new BendTracker()
    pick(b, G3)
    let v = 0
    // jump straight up a whole step with no pick attack, then ring
    for (let i = 0; i < 20; i++) v = b.update(clear(up(G3, 2)), false, false, DT)
    expect(Math.abs(v)).toBeLessThan(0.1)
  })

  it('ignores the pitch wobble right after the pick', () => {
    const b = new BendTracker()
    // picked string reads sharp for two frames before settling
    b.update(clear(up(G3, 0.5)), true, false, DT)
    b.update(clear(up(G3, 0.4)), false, false, DT)
    let v = 0
    for (let i = 0; i < 20; i++) v = b.update(clear(G3), false, false, DT)
    expect(Math.abs(v)).toBeLessThan(0.05)
  })

  it('keeps the bend when a bent note is picked again', () => {
    const b = new BendTracker()
    pick(b, G3)
    bend(b, G3, 2)
    let v = b.update(clear(up(G3, 2)), true, false, DT) // re-pick, still bent
    for (let i = 0; i < 20; i++) v = b.update(clear(up(G3, 2)), false, false, DT)
    expect(v).toBeCloseTo(1, 1)
  })

  it('does not snap to 0 if the attack detector fires mid-bend', () => {
    const b = new BendTracker()
    pick(b, G3)
    const values = bend(b, G3, 1, 0.15)
    const before = values.at(-1)!
    const during = b.update(clear(up(G3, 1)), true, false, DT)
    expect(during).toBeCloseTo(before, 2)
  })

  it('anchors fresh on a new note after a gap, even one close to the last bend', () => {
    const b = new BendTracker()
    pick(b, G3)
    bend(b, G3, 2)
    for (let i = 0; i < 20; i++) b.update({ hz: 0, clarity: 0 }, false, true, DT) // muted
    expect(Math.abs(pick(b, up(G3, 1)))).toBeLessThan(0.05)
  })

  it('bridges a one-frame dropout without losing the bend', () => {
    const b = new BendTracker()
    pick(b, G3)
    bend(b, G3, 2)
    b.update(muddy, false, false, DT)
    expect(b.update(clear(up(G3, 2)), false, false, DT)).toBeCloseTo(1, 1)
  })

  it('relaxes back to 0 when the note becomes unclear (chord) or stops', () => {
    const b = new BendTracker()
    pick(b, G3)
    const bent = bend(b, G3, 2).at(-1)!
    let v = bent
    for (let i = 0; i < 90; i++) v = b.update(muddy, false, false, DT)
    expect(v).toBeLessThan(0.05)
    // ...but not instantly
    const b2 = new BendTracker()
    pick(b2, G3)
    bend(b2, G3, 2)
    expect(b2.update(muddy, false, true, DT)).toBeGreaterThan(0.8)
  })
})
