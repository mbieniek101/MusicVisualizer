/**
 * How audio moves the lake.
 *
 * mapLake() takes the slider values (where the visuals rest) plus this frame's
 * audio features, and returns the values the shader actually gets. It's a pure
 * function: same inputs, same output, no hidden state, so it's easy to test
 * and safe to rewrite. This is the file to edit when you want the visuals to
 * *feel* different.
 *
 * Each connection has an "amount" slider (the Reactivity folder) so you can
 * dial it in while playing. Amount 0 turns that connection off.
 */
import type { ParamValues } from '../../../shared/ipc'
import type { AudioFeatures } from '../audio/types'
import type { ParamSpec } from '../params/types'

export const lakeReactivityParams: ParamSpec[] = [
  reactivity('reactLevelSpeed', 'Loudness → flow', 1),
  reactivity('reactLevelCoverage', 'Loudness → coverage', 0.6),
  reactivity('reactLowWarp', 'Lows → warp', 0.5),
  reactivity('reactBrightnessHue', 'Tone → color', 0.5),
  reactivity('reactOnsetFlash', 'Attack → flash', 0.6),
  reactivity('reactOnsetZoom', 'Attack → zoom kick', 0.3)
]

function reactivity(key: string, label: string, defaultAmount: number): ParamSpec {
  return { key, label, group: 'Reactivity', min: 0, max: 2, step: 0.01, default: defaultAmount }
}

export function mapLake(base: ParamValues, audio: AudioFeatures): ParamValues {
  const p = { ...base }

  // Louder playing makes the lake flow faster. Because the output window
  // accumulates time (time += dt × speed), speeding up never makes the picture jump.
  p.speed = base.speed + base.reactLevelSpeed * audio.level * 1.2

  // Louder playing lowers the waterline, so more of the frame lights up.
  p.blackLevel = Math.max(0, base.blackLevel - base.reactLevelCoverage * audio.level * 0.2)

  // Low strings stir the liquid harder.
  p.warp = base.warp + base.reactLowWarp * audio.low * 1.5

  // Bright tone (bridge pickup, treble) pushes colors one way, dark tone the other.
  // brightness sits around 0.5 for a typical guitar, so subtract that to swing both ways.
  p.hue = base.hue + base.reactBrightnessHue * (audio.brightness - 0.5) * 0.4

  // Each pick attack flashes brighter, then fades with the onset value.
  p.brightness = base.brightness * (1 + base.reactOnsetFlash * audio.onset * 0.6)

  // ...and gives the camera a small push in.
  p.zoom = base.zoom * (1 + base.reactOnsetZoom * audio.onset * 0.12)

  return p
}
