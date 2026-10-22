/**
 * "Stats" folder: frame rate and render size, reported by the output window
 * once a second. Collapsed by default.
 */
import type { Pane } from 'tweakpane'

export function createStatsPanel(pane: Pane): void {
  const folder = pane.addFolder({ title: 'Stats', expanded: false })
  const stats = { fps: 0, resolution: '—' }

  folder.addBinding(stats, 'fps', { label: 'FPS', readonly: true, view: 'graph', min: 0, max: 144 })
  folder.addBinding(stats, 'resolution', { label: 'Render size', readonly: true })

  window.api.onStats((s) => {
    stats.fps = s.fps
    stats.resolution = `${s.width}×${s.height}`
  })
}
