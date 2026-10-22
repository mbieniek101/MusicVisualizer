import type { ParamValues } from '../../../shared/ipc'

/** Everything a scene needs to draw one frame. */
export interface FrameState {
  /** Scene time in seconds. Advances by (real time × speed), so speed changes never jump. */
  time: number
  /** Drawing buffer size in pixels. */
  width: number
  height: number
  params: ParamValues
}

/**
 * A scene draws the base image (the lake, metaballs, later a fluid sim).
 * Every mode picks one scene; FX passes will run on whatever it draws.
 */
export interface Scene {
  render(frame: FrameState): void
  dispose(): void
}
