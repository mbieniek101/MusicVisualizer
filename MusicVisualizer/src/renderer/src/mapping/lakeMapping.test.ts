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
  })

  it('makes loud playing faster, more covered, more warped, brighter and closer', () => {
    const out = mapLake(base, loud)
    expect(out.speed).toBeGreaterThan(base.speed)
    expect(out.blackLevel).toBeLessThan(base.blackLevel)
    expect(out.warp).toBeGreaterThan(base.warp)
    expect(out.brightness).toBeGreaterThan(base.brightness)
    expect(out.zoom).toBeGreaterThan(base.zoom)
  })

  it('does nothing when every reactivity amount is 0', () => {
    const off = { ...base }
    for (const spec of lakeReactivityParams) off[spec.key] = 0
    const out = mapLake(off, loud)
    for (const key of ['speed', 'blackLevel', 'warp', 'brightness', 'zoom', 'colorSpread']) {
      expect(out[key]).toBeCloseTo(off[key], 10)
    }
  })

  it('shoves the flow forward on a surge, more than loudness alone does', () => {
    const steady = mapLake(base, { ...loud, surge: 0, momentum: 0 })
    const shoved = mapLake(base, { ...loud, surge: 1, momentum: 0 })
    expect(shoved.speed).toBeGreaterThan(steady.speed + 1)
    expect(shoved.zoom).toBeGreaterThan(steady.zoom)
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
