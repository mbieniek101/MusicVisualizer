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
  brightness: 0.5
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
    for (const key of ['speed', 'blackLevel', 'warp', 'brightness', 'zoom']) {
      expect(out[key]).toBeCloseTo(off[key], 10)
    }
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
