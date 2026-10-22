/**
 * Small WebGL2 helpers shared by every scene and (later) every FX pass.
 * Nothing here knows about the lake; it's plumbing.
 */

/** Compile one shader stage, throwing a readable error with line numbers on failure. */
export function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Could not create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? ''
    gl.deleteShader(shader)
    const numbered = source
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(3)}  ${line}`)
      .join('\n')
    const stage = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
    throw new Error(`${stage} shader failed to compile:\n${log}\n${numbered}`)
  }
  return shader
}

/** Link a vertex + fragment shader into a program. */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  // Once linked, the individual shader objects are no longer needed.
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Shader program failed to link:\n${log}`)
  }
  return program
}

/** Look up uniform locations by name. Missing ones (unused, so optimized out) map to null. */
export function getUniforms<K extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly K[]
): Record<K, WebGLUniformLocation | null> {
  const result = {} as Record<K, WebGLUniformLocation | null>
  for (const name of names) result[name] = gl.getUniformLocation(program, name)
  return result
}

/**
 * Draw one triangle that covers the whole screen. The vertex shader computes
 * the corners from gl_VertexID, so no vertex buffer is needed, but WebGL2
 * still requires a vertex array object to be bound.
 */
export function createFullscreenTriangle(gl: WebGL2RenderingContext): {
  draw(): void
  dispose(): void
} {
  const vao = gl.createVertexArray()
  return {
    draw() {
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteVertexArray(vao)
    }
  }
}
