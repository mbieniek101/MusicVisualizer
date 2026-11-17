/**
 * Bend tracking: how far the note you're holding has been bent away from the
 * pitch it started at.
 *
 *   a new note ──▶ remember its pitch (the "anchor")
 *   every frame ──▶ bend = current pitch − anchor, in semitones
 *
 * A whole-step bend (2 semitones, the classic rock bend) reads as 1.0. Bending
 * back down, or a whammy-bar dive, goes negative. Vibrato wobbles around 0.
 *
 * What counts as a new note: a bend moves the pitch *smoothly*, a new note
 * *jumps* it. So the anchor resets when the pitch jumps by more than
 * JUMP_SEMITONES (a new picked note, a hammer-on, a pull-off), or when there's
 * been no clear note for NOTE_GAP seconds (you muted, or played a chord).
 *
 * A pick attack on its own does NOT reset the anchor. That way re-picking a
 * note while it's still bent keeps the bend (a common rock move), and a fast
 * bend that briefly fools the attack detector doesn't snap the reading to 0.
 * When an attack starts a new note, its pitch is ignored for SETTLE_TIME,
 * because a freshly picked string reads slightly sharp.
 *
 * Chords have no single pitch: their clarity is low, so they're ignored and
 * the bend relaxes back to 0.
 *
 * Fed once per frame with the output of detectPitch(). No Web Audio; tested in
 * bend.test.ts.
 */
import { semitonesBetween, type PitchResult } from './pitch'

/** Pitch readings below this clarity are treated as "no single note" (chords, noise). */
const MIN_CLARITY = 0.85

/** Seconds after a pick attack before the pitch counts. A string goes slightly sharp as it's picked. */
const SETTLE_TIME = 0.05

/** A pitch change bigger than this from one frame to the next is a new note, not a bend. */
const JUMP_SEMITONES = 0.9

/** Semitones that read as a full bend (1.0). 2 = a whole step. */
const FULL_BEND = 2

/** Seconds without a clear note before the next one counts as new. Bridges one-frame dropouts. */
const NOTE_GAP = 0.12

/** Bends beyond this (in semitones) are treated as tracking errors and ignored. */
const MAX_BEND = 5

/** Seconds for the bend to follow your finger (short) and to relax when the note stops (longer). */
const FOLLOW_TIME = 0.025
const RELAX_TIME = 0.35

export class BendTracker {
  private anchorHz = 0
  private lastHz = 0
  private settle = 0
  private unclearFor = 0
  private value = 0

  /**
   * @param pitch   this frame's pitch reading
   * @param isOnset true on the frame a pick attack is detected
   * @param gated   true while the input is below the noise gate
   * @param dt      seconds since the last frame
   * @returns       bend, where 1 = a whole step up and -1 = a whole step down (can exceed ±1)
   */
  update(pitch: PitchResult, isOnset: boolean, gated: boolean, dt: number): number {
    if (isOnset) this.settle = SETTLE_TIME
    this.settle = Math.max(0, this.settle - dt)

    const clear = !gated && pitch.clarity >= MIN_CLARITY && pitch.hz > 0

    // No clear note for a while: the note has ended. The next one starts fresh.
    this.unclearFor = clear ? 0 : this.unclearFor + dt
    if (this.unclearFor > NOTE_GAP) {
      this.anchorHz = 0
      this.lastHz = 0
    }

    // Brief dropout: hold the current reading.
    if (!clear && this.unclearFor <= NOTE_GAP) return this.value

    // Just after an attack: if the pitch carries straight on from the note that was
    // ringing, it's a re-pick (or a bend fooling the attack detector), so keep
    // following. Otherwise a new note is starting: wait for its pitch to settle.
    if (clear && this.settle > 0) {
      const continuing =
        this.lastHz > 0 && Math.abs(semitonesBetween(pitch.hz, this.lastHz)) <= JUMP_SEMITONES
      if (!continuing) return this.value
    }

    let target = 0
    if (clear) {
      const jumped =
        this.lastHz > 0 && Math.abs(semitonesBetween(pitch.hz, this.lastHz)) > JUMP_SEMITONES
      if (this.anchorHz === 0 || jumped) this.anchorHz = pitch.hz // a new note: anchor on it

      const semitones = semitonesBetween(pitch.hz, this.anchorHz)
      if (Math.abs(semitones) <= MAX_BEND) target = semitones / FULL_BEND
      this.lastHz = pitch.hz
    }

    // Follow the finger closely, but relax back to 0 gently once the note is gone.
    const tau = clear ? FOLLOW_TIME : RELAX_TIME
    this.value += (target - this.value) * (1 - Math.exp(-dt / tau))
    return this.value
  }
}
