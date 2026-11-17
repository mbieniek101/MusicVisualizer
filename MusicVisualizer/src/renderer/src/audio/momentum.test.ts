import { describe, expect, it } from 'vitest'
import { Momentum, type MomentumState } from './momentum'

const DT = 1 / 60

/**
 * Play notes at `notesPerSecond` for `seconds` at loudness `level`, with the
 * sound decaying between notes the way a plucked string does.
 * Returns the state after every frame.
 */
function play(m: Momentum, notesPerSecond: number, seconds: number, level = 0.8): MomentumState[] {
  const out: MomentumState[] = []
  const interval = notesPerSecond > 0 ? 1 / notesPerSecond : Infinity
  let sinceNote = interval
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    sinceNote += DT
    const isOnset = sinceNote >= interval
    if (isOnset) sinceNote = 0
    const sounding = notesPerSecond > 0 ? level * Math.exp(-sinceNote / 0.5) : 0
    out.push(m.update(isOnset, sounding, DT))
  }
  return out
}

describe('Momentum energy', () => {
  it('builds up gradually while playing, rather than jumping', () => {
    const m = new Momentum()
    const states = play(m, 6, 4)
    expect(states[Math.round(0.25 / DT)].energy).toBeLessThan(0.3)
    expect(states.at(-1)!.energy).toBeGreaterThan(0.6)
  })

  it('builds higher from fast playing than from slow playing', () => {
    const fast = play(new Momentum(), 8, 4).at(-1)!.energy
    const slow = play(new Momentum(), 1, 4).at(-1)!.energy
    expect(fast).toBeGreaterThan(slow + 0.2)
  })

  it('keeps going for a while after you stop, then drains', () => {
    const m = new Momentum()
    const peak = play(m, 6, 4).at(-1)!.energy
    const after = play(m, 0, 1).at(-1)!.energy
    const later = play(m, 0, 10).at(-1)!.energy
    expect(after).toBeGreaterThan(peak * 0.6)
    expect(later).toBeLessThan(0.05)
  })
})

describe('Momentum surge', () => {
  it('jumps on an attack, then coasts back down', () => {
    const m = new Momentum()
    const hit = m.update(true, 0.8, DT).surge
    const coasting = play(m, 0, 0.5).at(-1)!.surge
    const stopped = play(m, 0, 4).at(-1)!.surge
    expect(hit).toBeGreaterThan(0.5)
    expect(coasting).toBeLessThan(hit)
    expect(coasting).toBeGreaterThan(hit * 0.3)
    expect(stopped).toBeLessThan(0.01)
  })

  it('stacks up during a fast run, beyond what one note gives', () => {
    const single = new Momentum().update(true, 0.8, DT).surge
    const run = Math.max(...play(new Momentum(), 8, 1.5).map((s) => s.surge))
    expect(run).toBeGreaterThan(single + 0.2)
    expect(run).toBeLessThanOrEqual(1)
  })

  it('pushes harder for louder attacks', () => {
    const soft = new Momentum().update(true, 0.1, DT).surge
    const hard = new Momentum().update(true, 1, DT).surge
    expect(hard).toBeGreaterThan(soft)
  })
})
