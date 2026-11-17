/**
 * Momentum: how your playing builds up over time, not just how it sounds
 * right now.
 *
 * Two outputs, both 0..1:
 *
 *  - energy: a flywheel. Playing hard and busy spins it up over a second or
 *    two; it keeps spinning for a few seconds after you stop. Use it for "how
 *    intense is this section", e.g. a riff building toward a chorus.
 *
 *  - surge: a shove with weight behind it. Every pick attack pushes it up,
 *    harder attacks push harder, and it coasts back down with friction.
 *    Attacks that land before it has coasted to a stop stack up, so a fast
 *    run builds into a big push and a single note is just a nudge.
 *
 * Fed once per frame with the onset flag and loudness from FeatureExtractor.
 * No Web Audio in here; tested in momentum.test.ts.
 */

/** Seconds for energy to spin up while you play, and to drain once you stop. */
const ENERGY_BUILD = 1.5
const ENERGY_DRAIN = 3.5

/** Window (seconds) for counting notes per second. */
const RATE_WINDOW = 1

/** Notes per second that count as playing flat out. */
const BUSY_RATE = 6

/** Time constant (seconds) for surge to coast down after a push. Bigger = slides further. */
const SURGE_FRICTION = 0.6

/** Push from one attack: a light pick gives the base, a loud one adds the rest. */
const SURGE_PUSH_BASE = 0.35
const SURGE_PUSH_LOUD = 0.65

export interface MomentumState {
  energy: number
  surge: number
}

export class Momentum {
  private energy = 0
  private rate = 0
  private push = 0

  /**
   * @param isOnset true on the frame a pick attack is detected
   * @param level   current loudness, 0..1
   * @param dt      seconds since the last frame
   */
  update(isOnset: boolean, level: number, dt: number): MomentumState {
    // Notes per second, as a decaying count: each attack adds 1/window and it
    // leaks away over the window, so the value settles at the recent rate.
    this.rate *= Math.exp(-dt / RATE_WINDOW)
    if (isOnset) this.rate += 1 / RATE_WINDOW

    // How hard you're playing right now: half loudness, half how busy.
    const activity = clamp01(0.5 * level + 0.5 * Math.min(1, this.rate / BUSY_RATE))
    const tau = activity > this.energy ? ENERGY_BUILD : ENERGY_DRAIN
    this.energy += (activity - this.energy) * (1 - Math.exp(-dt / tau))

    // Surge: friction first, then this frame's push.
    this.push *= Math.exp(-dt / SURGE_FRICTION)
    if (isOnset) this.push += SURGE_PUSH_BASE + SURGE_PUSH_LOUD * level

    return {
      energy: this.energy,
      // Soft ceiling: one hard hit ≈ 0.63, a fast run approaches 1 but never jumps past it.
      surge: 1 - Math.exp(-this.push)
    }
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
