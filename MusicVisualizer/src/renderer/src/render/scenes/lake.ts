/**
 * The lake scene: compiles lake.frag.glsl and feeds it parameters each frame.
 * All the visual logic is in the shader; this file only moves numbers across.
 */
import vertexSource from '../fullscreen.vert.glsl?raw'
import fragmentSource from './lake.frag.glsl?raw'
import { createFullscreenTriangle, createProgram, getUniforms } from '../gl'
import type { FrameState, Scene } from '../types'

const UNIFORMS = [
  'uResolution',
  'uTime',
  'uZoom',
  'uWarp',
  'uOctaves',
  'uHue',
  'uColorSpread',
  'uSaturation',
  'uBrightness',
  'uBlackLevel',
  'uSoftness'
] as const

export function createLakeScene(gl: WebGL2RenderingContext): Scene {
  const program = createProgram(gl, vertexSource, fragmentSource)
  const u = getUniforms(gl, program, UNIFORMS)
  const triangle = createFullscreenTriangle(gl)

  return {
    render({ time, width, height, params }: FrameState) {
      gl.useProgram(program)
      gl.uniform2f(u.uResolution, width, height)
      gl.uniform1f(u.uTime, time)
      gl.uniform1f(u.uZoom, params.zoom)
      gl.uniform1f(u.uWarp, params.warp)
      gl.uniform1i(u.uOctaves, Math.round(params.octaves))
      gl.uniform1f(u.uHue, params.hue)
      gl.uniform1f(u.uColorSpread, params.colorSpread)
      gl.uniform1f(u.uSaturation, params.saturation)
      gl.uniform1f(u.uBrightness, params.brightness)
      gl.uniform1f(u.uBlackLevel, params.blackLevel)
      gl.uniform1f(u.uSoftness, params.softness)
      triangle.draw()
    },
    dispose() {
      triangle.dispose()
      gl.deleteProgram(program)
    }
  }
}
