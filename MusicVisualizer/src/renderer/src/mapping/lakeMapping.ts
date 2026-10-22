/**
 * How audio moves the lake. This is the file to edit when you want the
 * visuals to *feel* different.
 *
 * Two parts:
 *  - mapLake() decides WHERE each parameter should be for the current sound:
 *    slider values (where the visuals rest) + audio features → targets.
 *    It's a pure function: same inputs, same output, easy to test.
 *  - lakeGlide decides HOW FAST each parameter travels to that target.
 *    That's what makes the response feel like paint going on rather than a
 *    switch flipping (see glide.ts).
 *
 * Each connection has an "amount" slider (the Reactivity folder) so you can
 * dial it in while playing. Amount 0 turns that connection off.
 *
 * The defaults lean on coverage, brightness and color, which change the
 * picture where the blobs are, like paint. Warp and zoom move the whole frame
 * at once, so they're kept subtle and slow.
 */
import type { ParamValues } from '../../../shared/ipc'
import type { AudioFeatures } from '../audio/types'
import type { ParamSpec } from '../params/types'
import { smoothnessParam, type GlideSpec } from './glide'

export const lakeReactivityParams: ParamSpec[] = [
  smoothnessParam,
  reactivity('reactLevelCoverage', 'Loudness → coverage', 0.9),
  reactivity('reactOnsetFlash', 'Attack → glow', 0.5),
  reactivity('reactBrightnessHue', 'Tone → color', 0.6),
  reactivity('reactLevelSpeed', 'Loudness → flow', 0.7),
  reactivity('reactLowWarp', 'Lows → warp', 0.25),
  reactivity('reactOnsetZoom', 'Attack → zoom swell', 0.12)
]

/**
 * Seconds for each parameter to travel ~90% of the way to a new target, at
 * Smoothness 1. "rise" applies when the value goes up, "fall" when it goes down.
 */
export const lakeGlide: GlideSpec = {
  // Coverage works backwards: a LOWER black level means more of the frame is lit.
  // So "fall" is new sound spreading color in (fairly quick), and "rise" is the
  // color drying back out to black afterwards (slow).
  blackLevel: { rise: 2.2, fall: 0.45 },
  // A pick attack blooms in over a fifth of a second, then fades out gently.
  brightness: { rise: 0.22, fall: 1.4 },
  // Color drifts like pigments mixing: slow both ways.
  hue: { rise: 1.8, fall: 1.8 },
  // Flow speeds up with the music and coasts down afterwards.
  speed: { rise: 0.7, fall: 2.5 },
  // Warp and zoom reshape the whole frame, so they move slowest.
  warp: { rise: 1.2, fall: 3 },
  zoom: { rise: 0.5, fall: 2 }
}

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

  // Each pick attack makes the colors glow brighter for a moment.
  p.brightness = base.brightness * (1 + base.reactOnsetFlash * audio.onset * 0.6)

  // ...and gently swells the view inward.
  p.zoom = base.zoom * (1 + base.reactOnsetZoom * audio.onset * 0.12)

  return p
}
