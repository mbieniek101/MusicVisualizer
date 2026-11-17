/**
 * "Stats" folder: frame rate and render size, reported by the output window
 * once a second. Collapsed by default.
 */
import type { Pane } from 'tweakpane'

/** Graph scale before any stats arrive. Rescaled once the real frame rate is known. */
const INITIAL_GRAPH_MAX = 144

export function createStatsPanel(pane: Pane): void {
  const folder = pane.addFolder({ title: 'Stats', expanded: false })
  const stats = { fps: 0, resolution: '—' }

  folder.addBinding(stats, 'fps', {
    label: 'FPS',
    readonly: true,
    format: (v) => v.toFixed(0)
  })

  // The graph's scale is fixed when it's created, and the frame rate follows the
  // display's refresh rate (60, 144, 165, 240 Hz...). A line above the top of the
  // scale is drawn off-screen, so rebuild the graph with a bigger scale whenever
  // the frame rate outgrows it.
  let graphMax = INITIAL_GRAPH_MAX
  let graph: { dispose(): void } | null = null
  const buildGraph = (): void => {
    graph?.dispose()
    graph = folder.addBinding(stats, 'fps', {
      label: 'FPS history',
      readonly: true,
      view: 'graph',
      min: 0,
      max: graphMax,
      index: 1 // just below the number
    })
  }
  buildGraph()

  folder.addBinding(stats, 'resolution', { label: 'Render size', readonly: true })

  window.api.onStats((s) => {
    stats.fps = s.fps
    stats.resolution = `${s.width}×${s.height}`

    if (s.fps > graphMax * 0.9) {
      // Leave ~25% headroom, rounded up to a multiple of 30.
      graphMax = Math.ceil((s.fps * 1.25) / 30) * 30
      buildGraph()
    }
  })
}
