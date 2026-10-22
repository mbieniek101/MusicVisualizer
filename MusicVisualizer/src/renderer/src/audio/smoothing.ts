/**
 * Small stateful helpers that make raw measurements usable for visuals.
 * Each one is updated once per frame with the time step `dt` in seconds, so
 * behavior is the same at 30, 60 or 144 fps.
 */

/** Fraction of the remaining distance to cover in `dt` for a time constant `tau`. */
function stepFraction(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)
}

/**
 * Attack/release follower. Rises toward a louder input over `attack` seconds
 * and falls back over `release` seconds. Fast attack + slow release gives
 * visuals that jump with each note and then swell down instead of flickering.
 */
export class Envelope {
  value = 0

  constructor(
    public attack: number,
    public release: number
  ) {}

  update(target: number, dt: number): number {
    const tau = target > this.value ? this.attack : this.release
    this.value += (target - this.value) * stepFraction(dt, tau)
    return this.value
  }
}

/**
 * Normalizes a signal by its own recent peak, so the output is ~1 at your
 * loudest recent playing whatever the input gain. The remembered peak decays
 * over `release` seconds, so after you've been playing quietly for a while,
 * quiet playing fills the range again.
 *
 * `floor` stops it from blowing tiny noise up to full scale during silence.
 */
export class AutoLevel {
  private recentPeak = 0

  constructor(
    public release: number,
    public floor: number
  ) {}

  update(input: number, dt: number): number {
    this.recentPeak = Math.max(input, this.recentPeak * Math.exp(-dt / this.release))
    return Math.min(1, input / Math.max(this.recentPeak, this.floor))
  }
}

/**
 * Detects pick attacks from spectral flux.
 *
 * A fixed threshold doesn't work: a strum is a huge flux spike when you play
 * quietly but ordinary when you're already playing hard. So the threshold
 * follows a running average of recent flux: an onset is a spike well above
 * what's been normal for the last fraction of a second.
 */
export class OnsetDetector {
  /** Seconds the running average looks back over (roughly). */
  averageTime = 0.4
  /** Minimum seconds between onsets, so one strum doesn't fire twice. */
  minInterval = 0.08

  private average = 0
  private initialized = false
  private sinceLast = Infinity

  /**
   * @param flux        spectral flux for this frame
   * @param sensitivity 0..1, higher = smaller spikes count
   * @param minFlux     absolute floor, so near-silence can't trigger
   */
  update(flux: number, sensitivity: number, minFlux: number, dt: number): boolean {
    this.sinceLast += dt
    // Start the average at the first value seen, rather than 0. Otherwise any
    // steady signal looks like a spike until the average has caught up.
    if (!this.initialized) {
      this.average = flux
      this.initialized = true
    }
    // sensitivity 0 → must be 4× the recent average; 1 → only 1.3×.
    const multiplier = 4 - 2.7 * sensitivity
    const threshold = Math.max(this.average * multiplier, minFlux)
    const isOnset = flux > threshold && this.sinceLast >= this.minInterval

    if (isOnset) this.sinceLast = 0
    // Update the average *after* checking, so the spike doesn't raise its own bar.
    this.average += (flux - this.average) * stepFraction(dt, this.averageTime)
    return isOnset
  }

  reset(): void {
    this.average = 0
    this.initialized = false
    this.sinceLast = Infinity
  }
}
