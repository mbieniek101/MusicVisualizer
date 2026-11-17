import { describe, expect, it } from 'vitest'
import { lakeReactivityParams, mapLake } from './lakeMapping'
import { lakeParams } from '../params/lakeParams'
import { defaultValues } from '../params/types'
import { SILENT_FEATURES, type AudioFeatures } from '../audio/types'

const base = defaultValues([...lakeParams, ...lakeReactivityParams])
const loud: AudioFeatures = {
  ...SILENT_FEATURES,
  level: 1,
  low: 1,
  mid: 1,
  high: 1,
  onset: 1,
  brightness: 0.5,
  momentum: 1,
  surge: 1
}

describe('mapLake', () => {
  it('leaves everything at the slider values when there is no audio', () => {
    const quiet = mapLake(base, SILENT_FEATURES)
    for (const key of ['speed', 'blackLevel', 'warp', 'hue', 'brightness', 'zoom']) {
      expect(quiet[key]).toBeCloseTo(base[key], 10)
    }
    expect(quiet.swell).toBe(0)
    expect(quiet.twistDeep).toBeCloseTo(base.twist, 10)
  })

  it('makes loud playing faster, more covered, more warped, brighter and swelling', () => {
    const out = mapLake(base, loud)
    expect(out.speed).toBeGreaterThan(base.speed)
    expect(out.blackLevel).toBeLessThan(base.blackLevel)
    expect(out.warp).toBeGreaterThan(base.warp)
    expect(out.brightness).toBeGreaterThan(base.brightness)
    expect(out.swell).toBeGreaterThan(0)
  })

  it('does nothing when every reactivity amount is 0', () => {
    const off = { ...base }
    for (const spec of lakeReactivityParams) off[spec.key] = 0
    const out = mapLake(off, loud)
    for (const key of ['speed', 'blackLevel', 'warp', 'brightness', 'zoom', 'colorSpread']) {
      expect(out[key]).toBeCloseTo(off[key], 10)
    }
    expect(out.swell).toBe(0)
  })

  it('shoves the flow forward on a surge, more than loudness alone does', () => {
    const steady = mapLake(base, { ...loud, surge: 0, momentum: 0 })
    const shoved = mapLake(base, { ...loud, surge: 1, momentum: 0 })
    expect(shoved.speed).toBeGreaterThan(steady.speed + 1)
    expect(shoved.swell).toBeGreaterThan(steady.swell)
  })

  it('makes everything wilder and more responsive as momentum builds', () => {
    const calm = mapLake(base, { ...loud, momentum: 0 })
    const intense = mapLake(base, { ...loud, momentum: 1 })
    expect(intense.speed).toBeGreaterThan(calm.speed)
    expect(intense.warp).toBeGreaterThan(calm.warp)
    expect(intense.colorSpread).toBeGreaterThan(calm.colorSpread)
    expect(intense.smoothness).toBeLessThan(calm.smoothness)
    expect(intense.smoothness).toBeGreaterThan(0) // never drops to no smoothing at all
  })

  it('winds the whirlpool with bends, in the direction of the bend', () => {
    const unbent = mapLake(base, { ...loud, bend: 0 })
    const up = mapLake(base, { ...loud, bend: 1 })
    const down = mapLake(base, { ...loud, bend: -1 })
    expect(unbent.twist).toBeCloseTo(base.twist, 10)
    expect(up.twist).toBeGreaterThan(base.twist + 1)
    expect(down.twist).toBeLessThan(base.twist - 1)
    expect(up.hue).toBeGreaterThan(unbent.hue)
    // The deep currents head for the same whirlpool (they just get there later).
    expect(up.twistDeep).toBeCloseTo(up.twist, 10)
  })

  it('moves the liquid, not the view: surges never zoom the frame', () => {
    expect(mapLake(base, loud).zoom).toBe(base.zoom)
  })

  it('never pushes the black level below 0', () => {
    const out = mapLake({ ...base, blackLevel: 0.05, reactLevelCoverage: 2 }, loud)
    expect(out.blackLevel).toBe(0)
  })

  it('does not modify the slider values it was given', () => {
    const copy = { ...base }
    mapLake(base, loud)
    expect(base).toEqual(copy)
  })
})
