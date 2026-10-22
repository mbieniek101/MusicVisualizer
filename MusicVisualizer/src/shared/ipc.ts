/**
 * The contract between the three Electron processes.
 *
 * This file is imported by main, preload AND renderer, so it must stay free of
 * any Node or DOM APIs: just constants and types. Keeping every channel name
 * here means a typo becomes a compile error instead of a message that silently
 * goes nowhere.
 *
 * Data flow for milestone 1:
 *
 *   control window ──params:update──▶ main ──params:update──▶ output window
 *   control window ◀────stats──────── main ◀──────stats─────── output window
 *   control window ──output:*────────▶ main  (moves / fullscreens the output window)
 */

export const IPC = {
  /** control → main → output: a partial set of visual parameters changed. */
  paramsUpdate: 'params:update',
  /** output asks main for the latest full parameter set (e.g. after a reload). */
  paramsGet: 'params:get',

  /** control asks main for the list of connected displays. */
  displaysList: 'displays:list',
  /** main → control: a display was plugged in, removed, or changed. */
  displaysChanged: 'displays:changed',

  /** control → main: put the output window on this display. */
  outputSetDisplay: 'output:set-display',
  /** control → main: turn fullscreen on or off for the output window. */
  outputSetFullscreen: 'output:set-fullscreen',
  /** output → main: toggle fullscreen (keyboard shortcut / double-click). */
  outputToggleFullscreen: 'output:toggle-fullscreen',
  /** control asks main where the output window currently is. */
  outputGetState: 'output:get-state',
  /** main → control: the output window moved or changed fullscreen state. */
  outputState: 'output:state',

  /** output → main → control: render stats, sent about once per second. */
  stats: 'stats'
} as const

/** Visual parameters by name, e.g. { speed: 0.25, warp: 4 }. */
export type ParamValues = Record<string, number>

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
}

export interface OutputState {
  displayId: number
  fullscreen: boolean
}

export interface RenderStats {
  fps: number
  width: number
  height: number
}

/** Everything the preload script exposes to web pages as `window.api`. */
export interface VisualizerApi {
  // parameters
  sendParams(patch: ParamValues): void
  getParams(): Promise<ParamValues>
  onParams(callback: (patch: ParamValues) => void): () => void

  // displays and the output window
  listDisplays(): Promise<DisplayInfo[]>
  onDisplaysChanged(callback: (displays: DisplayInfo[]) => void): () => void
  setOutputDisplay(displayId: number): void
  setOutputFullscreen(on: boolean): void
  toggleOutputFullscreen(): void
  getOutputState(): Promise<OutputState>
  onOutputState(callback: (state: OutputState) => void): () => void

  // stats
  sendStats(stats: RenderStats): void
  onStats(callback: (stats: RenderStats) => void): () => void
}
