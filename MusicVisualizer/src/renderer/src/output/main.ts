/**
 * Output window: owns the WebGL canvas and the render loop.
 *
 * Per-frame work never crosses IPC. Parameter changes arrive occasionally
 * (when a slider moves) and are copied into a local object; the loop reads
 * that object every frame. Later, audio analysis will run here too, for the
 * same reason.
 */
import './output.css'
import { createLakeScene } from '../render/scenes/lake'
import type { Scene } from '../render/types'
import { defaultLakeValues } from '../params/lakeParams'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const errorBox = document.getElementById('error') as HTMLPreElement

function showError(message: string): void {
  console.error(message)
  errorBox.textContent = message
  errorBox.hidden = false
}

/** Match the canvas's pixel buffer to its on-screen size × render scale. */
function resizeCanvas(renderScale: number): void {
  const scale = window.devicePixelRatio * renderScale
  const width = Math.max(1, Math.floor(canvas.clientWidth * scale))
  const height = Math.max(1, Math.floor(canvas.clientHeight * scale))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

function setupFullscreenControls(): void {
  let fullscreen = false
  const apply = (on: boolean): void => {
    fullscreen = on
    document.body.classList.toggle('fullscreen', on) // hides the cursor
  }
  window.api.getOutputState().then((s) => apply(s.fullscreen))
  window.api.onOutputState((s) => apply(s.fullscreen))

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
      e.preventDefault()
      window.api.toggleOutputFullscreen()
    } else if (e.key === 'Escape' && fullscreen) {
      window.api.toggleOutputFullscreen()
    }
  })
  canvas.addEventListener('dblclick', () => window.api.toggleOutputFullscreen())
}

async function start(): Promise<void> {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance'
  })
  if (!gl) {
    showError('WebGL2 is not available. Try updating your graphics drivers.')
    return
  }

  // Start from defaults, then apply whatever main remembers (matters after a reload).
  const params = { ...defaultLakeValues(), ...(await window.api.getParams()) }
  window.api.onParams((patch) => Object.assign(params, patch))

  setupFullscreenControls()

  let scene: Scene | null = null
  const buildScene = (): void => {
    try {
      scene = createLakeScene(gl)
    } catch (err) {
      scene = null
      showError(err instanceof Error ? err.message : String(err))
    }
  }
  buildScene()

  // The GPU can drop our context (driver reset, sleep). Rebuild when it comes back.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    scene = null
  })
  canvas.addEventListener('webglcontextrestored', buildScene)

  let time = 0
  let last = performance.now()
  let frames = 0
  let statsWindowStart = last

  const frame = (now: number): void => {
    // Clamp dt so a stall (window dragged, laptop asleep) doesn't jump the animation.
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    time += dt * params.speed

    resizeCanvas(params.renderScale)
    if (scene) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      scene.render({ time, width: canvas.width, height: canvas.height, params })
    }

    frames++
    if (now - statsWindowStart >= 1000) {
      const fps = (frames * 1000) / (now - statsWindowStart)
      window.api.sendStats({ fps, width: canvas.width, height: canvas.height })
      frames = 0
      statsWindowStart = now
    }

    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start()
