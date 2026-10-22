/**
 * Parameters for the output window itself, shared by every mode.
 */
import type { ParamSpec } from './types'

export const outputParams: ParamSpec[] = [
  // Render at a fraction of the screen resolution and let the GPU upscale.
  // The main lever if a laptop GPU can't hold 60 fps.
  {
    key: 'renderScale',
    label: 'Render scale',
    group: 'Performance',
    min: 0.25,
    max: 1,
    step: 0.05,
    default: 0.75
  }
]
