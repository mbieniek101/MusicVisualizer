import { lakeParams } from '../params/lakeParams'
import { createLakeScene } from '../render/scenes/lake'
import { lakeGlide, lakeReactivityParams, mapLake } from '../mapping/lakeMapping'
import type { Mode } from './types'

/** Colored blobs drifting like oil on water. (The VHS-failure FX arrive in milestone 2.) */
export const vhsLakeMode: Mode = {
  name: 'VHS lake',
  params: [...lakeParams, ...lakeReactivityParams],
  createScene: createLakeScene,
  map: mapLake,
  glide: lakeGlide
}

/** The mode both windows use. When there are several, this becomes a choice in the control panel. */
export const activeMode = vhsLakeMode
