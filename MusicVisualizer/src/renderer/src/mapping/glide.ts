/**
 * Glide: eases visual parameters toward their targets, so audio "paints" onto
 * the picture instead of snapping it around.
 *
 *   mode.map() ──▶ targets (where the audio wants each parameter right now)
 *                     │
 *                     ▼
 *               ParamGlide.update() ──▶ what the shader actually gets
 *
 * Each parameter moves through two smoothing stages in a row. One stage alone
 * starts moving at full speed the instant the target changes, which still
 * reads as a jolt. Two stages give an S-curve: a soft start, a steady middle,
 * a soft landing, like a brush stroke rather than a stamp.
 *
 * Rise and fall times are separate: a pick attack can bloom in fairly quickly
 * and then take much longer to fade back out.
 *
 * Feature extraction stays sharp (attack detection still needs to be precise);
 * only what you see gets smoothed.
 */
import type { ParamValues } from '../../../shared/ipc'
import type { ParamSpec } from '../params/types'

/**
 * Seconds for a parameter to get about 90% of the way to a new target.
 * "rise" is used when the value is going UP, "fall" when it's going DOWN.
 */
export interface GlideTimes {
  rise: number
  fall: number
}

/** Glide times per parameter key. Parameters not listed pass straight through. */
export type GlideSpec = Record<string, GlideTimes>

/** The master control: scales every glide time. 0 turns gliding off. */
export const smoothnessParam: ParamSpec = {
  key: 'smoothness',
  label: 'Smoothness',
  group: 'Reactivity',
  min: 0,
  max: 3,
  step: 0.01,
  default: 1
}

export class ParamGlide {
  private firstStage: ParamValues = {}
  private current: ParamValues = {}

  constructor(private readonly spec: GlideSpec) {}

  /**
   * @param targets    where each parameter should be heading (output of mode.map)
   * @param dt         seconds since the last frame
   * @param smoothness multiplies every glide time; 0 = no gliding
   * @returns          a copy of `targets` with the listed parameters eased
   */
  update(targets: ParamValues, dt: number, smoothness: number): ParamValues {
    const result = { ...targets }

    for (const [key, times] of Object.entries(this.spec)) {
      const target = targets[key]
      if (target === undefined) continue

      // First frame, or gliding turned off: jump straight to the target.
      if (!(key in this.current) || smoothness <= 0) {
        this.firstStage[key] = target
        this.current[key] = target
        continue
      }

      const goingUp = target >= this.current[key]
      // Each stage's time constant is a quarter of the glide time; two stages in
      // a row then reach ~90% of the target at the full glide time.
      const stageTime = ((goingUp ? times.rise : times.fall) * smoothness) / 4
      const step = 1 - Math.exp(-dt / stageTime)

      this.firstStage[key] += (target - this.firstStage[key]) * step
      this.current[key] += (this.firstStage[key] - this.current[key]) * step
      result[key] = this.current[key]
    }

    return result
  }
}
