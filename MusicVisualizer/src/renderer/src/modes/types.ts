import type { ParamValues } from '../../../shared/ipc'
import type { AudioFeatures } from '../audio/types'
import type { ParamSpec } from '../params/types'
import type { Scene } from '../render/types'
import type { GlideSpec } from '../mapping/glide'

/**
 * A mode is one complete look: a scene that draws, the sliders it exposes,
 * and how audio moves those sliders. Adding a new look means writing a new
 * Mode; the windows don't need to change.
 */
export interface Mode {
  name: string
  /** Every slider this mode shows (scene parameters + reactivity amounts). */
  params: ParamSpec[]
  createScene(gl: WebGL2RenderingContext): Scene
  /**
   * Slider values + audio → where each parameter should be heading. May also
   * return `smoothness`, which then replaces the slider's value for the glide.
   */
  map(base: ParamValues, audio: AudioFeatures): ParamValues
  /** How quickly each parameter travels to its target (scaled by the Smoothness slider). */
  glide: GlideSpec
}
