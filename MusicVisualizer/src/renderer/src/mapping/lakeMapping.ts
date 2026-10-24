/**
 * How audio moves the lake. This is the file to edit when you want the
 * visuals to *feel* different.
 *
 * Two parts:
 *  - mapLake() decides WHERE each parameter should be for the current sound:
 *    slider values (where the visuals rest) + audio features → targets.
 *    It's a pure function: same inputs, same output, easy to test.
 *  - lakeGlide decides HOW FAST each parameter travels to that target, so
 *    changes flow in rather than snap (see glide.ts).
 *
 * Three layers of response, from quickest to slowest:
 *  1. the sound right now: loudness, lows, tone, the glow of each attack
 *  2. surge: each attack shoves the lake forward and it coasts, with fast runs
 *     stacking into a big push
 *  3. momentum: playing hard and busy builds up over a couple of seconds and
 *     makes everything faster, wilder, more colorful and more responsive,
 *     then winds down after you stop
 *
 * Each connection has an "amount" slider (the Reactivity folder) so you can
 * dial it in while playing. Amount 0 turns that connection off.
 */
import type { ParamValues } from '../../../shared/ipc'
import type { AudioFeatures } from '../audio/types'
import type { ParamSpec } from '../params/types'
import { smoothnessParam, type GlideSpec } from './glide'

export const lakeReactivityParams: ParamSpec[] = [
  smoothnessParam,
  reactivity('reactMomentum', 'Momentum → intensity', 1),
  reactivity('reactSurge', 'Attack → surge', 1),
  reactivity('reactLevelCoverage', 'Loudness → coverage', 0.9),
  reactivity('reactOnsetFlash', 'Attack → glow', 0.6),
  reactivity('reactBrightnessHue', 'Tone → color', 0.6),
  reactivity('reactLevelSpeed', 'Loudness → flow', 0.5),
  reactivity('reactLowWarp', 'Lows → warp', 0.4),
  reactivity('reactOnsetZoom', 'Surge → zoom push', 0.6)
]

/**
 * Seconds for each parameter to travel ~90% of the way to a new target, at
 * Smoothness 1. "rise" applies when the value goes up, "fall" when it goes down.
 * Momentum shortens all of these while you're playing hard (see the end of mapLake).
 */
export const lakeGlide: GlideSpec = {
  // Coverage works backwards: a LOWER black level means more of the frame is lit.
  // So "fall" is new sound spreading color in (quick), and "rise" is the color
  // drying back out to black afterwards (slower).
  blackLevel: { rise: 1.2, fall: 0.2 },
  // A pick attack flares in almost instantly, then fades over about half a second.
  brightness: { rise: 0.08, fall: 0.6 },
  // Speed has to react fast for a surge to feel like a shove; it coasts down after.
  speed: { rise: 0.12, fall: 1.2 },
  // Color shifts like pigments mixing.
  hue: { rise: 0.8, fall: 0.8 },
  colorSpread: { rise: 0.6, fall: 1.5 },
  // Warp and zoom reshape the whole frame: quick enough to feel, slow enough not to jolt.
  warp: { rise: 0.4, fall: 1.4 },
  zoom: { rise: 0.12, fall: 0.8 }
}

function reactivity(key: string, label: string, defaultAmount: number): ParamSpec {
  return { key, label, group: 'Reactivity', min: 0, max: 2, step: 0.01, default: defaultAmount }
}

export function mapLake(base: ParamValues, audio: AudioFeatures): ParamValues {
  const p = { ...base }

  // Momentum (0..1, up to 2 with the slider maxed) and surge, scaled by their sliders.
  const momentum = audio.momentum * base.reactMomentum
  const surge = audio.surge * base.reactSurge

  // Flow. Loudness speeds it up, each attack shoves it forward and it coasts,
  // and a section of hard playing raises the cruising speed. The output window
  // accumulates time (time += dt × speed), so even a big shove never makes the
  // picture jump; it just slides further.
  p.speed = base.speed + base.reactLevelSpeed * audio.level * 0.8 + surge * 1.6 + momentum * 0.6

  // Coverage. Loudness lowers the waterline so more of the frame lights up, and
  // the lake keeps filling in as momentum builds.
  p.blackLevel = Math.max(
    0,
    base.blackLevel - base.reactLevelCoverage * audio.level * 0.18 - momentum * 0.08
  )

  // Turbulence. Low strings stir the liquid, surges churn it, and momentum keeps it churning.
  p.warp = base.warp + base.reactLowWarp * audio.low * 1.5 + surge * 0.6 + momentum * 1.2

  // Color. Bright tone (bridge pickup, treble) swings the palette one way, dark tone
  // the other (brightness sits near 0.5 for a typical guitar). Momentum spreads the
  // palette wider, so intense playing brings out more colors at once.
  p.hue = base.hue + base.reactBrightnessHue * (audio.brightness - 0.5) * 0.4
  p.colorSpread = base.colorSpread * (1 + momentum * 0.5)

  // Each pick attack flares the colors brighter, and momentum lifts the whole picture.
  p.brightness = base.brightness * (1 + base.reactOnsetFlash * audio.onset * 0.6 + momentum * 0.15)

  // Surges push the view inward, so a fast run feels like rushing forward.
  p.zoom = base.zoom * (1 + base.reactOnsetZoom * surge * 0.15)

  // Responsiveness. The more momentum, the shorter every glide time: calm playing
  // paints slowly, intense playing snaps around. The output loop reads this value
  // in place of the Smoothness slider.
  p.smoothness = base.smoothness * (1 - 0.6 * Math.min(1, momentum))

  return p
}
