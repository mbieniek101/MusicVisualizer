import type { ParamValues } from '../../../shared/ipc'
import type { AudioFeatures } from '../audio/types'
import type { ParamSpec } from '../params/types'
import type { Scene } from '../render/types'

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
  /** Slider values + audio → the values the scene renders with. */
  map(base: ParamValues, audio: AudioFeatures): ParamValues
}
