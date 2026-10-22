/**
 * The lake scene's adjustable parameters: one list, used by both windows.
 *
 * The control window builds its sliders from this list, and the output window
 * takes its starting values from it. To add a parameter: add an entry here,
 * then read it in lake.ts / lake.frag.glsl. Later, the audio mapping layer
 * will write to these same keys instead of (or on top of) the sliders.
 */
import type { ParamValues } from '../../../shared/ipc'

export interface ParamSpec {
  key: string
  label: string
  group: string
  min: number
  max: number
  step: number
  default: number
}

export const lakeParams: ParamSpec[] = [
  // Motion
  { key: 'speed', label: 'Flow speed', group: 'Motion', min: 0, max: 2, step: 0.01, default: 0.3 },

  // Shape
  { key: 'zoom', label: 'Zoom', group: 'Shape', min: 0.5, max: 4, step: 0.01, default: 1 },
  { key: 'warp', label: 'Warp', group: 'Shape', min: 0, max: 8, step: 0.01, default: 3 },
  { key: 'octaves', label: 'Detail', group: 'Shape', min: 1, max: 8, step: 1, default: 5 },

  // Color
  { key: 'hue', label: 'Hue shift', group: 'Color', min: 0, max: 1, step: 0.001, default: 0 },
  {
    key: 'colorSpread',
    label: 'Color spread',
    group: 'Color',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1
  },
  {
    key: 'saturation',
    label: 'Saturation',
    group: 'Color',
    min: 0,
    max: 1.5,
    step: 0.01,
    default: 1.1
  },
  {
    key: 'brightness',
    label: 'Brightness',
    group: 'Color',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.2
  },

  // Blobs: how much of the frame goes to pure black (important when projecting)
  {
    key: 'blackLevel',
    label: 'Black level',
    group: 'Blobs',
    min: 0,
    max: 1,
    step: 0.005,
    default: 0.45
  },
  {
    key: 'softness',
    label: 'Edge softness',
    group: 'Blobs',
    min: 0.005,
    max: 0.5,
    step: 0.005,
    default: 0.12
  },

  // Performance: render at a fraction of the screen resolution and let the GPU upscale
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

export function defaultLakeValues(): ParamValues {
  return Object.fromEntries(lakeParams.map((p) => [p.key, p.default]))
}
