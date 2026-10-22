import type { VisualizerApi } from '../shared/ipc'

// Tells TypeScript in the renderer that `window.api` exists and what it looks like.
declare global {
  interface Window {
    api: VisualizerApi
  }
}
