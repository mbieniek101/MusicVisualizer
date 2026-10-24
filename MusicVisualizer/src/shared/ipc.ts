/**
 * The contract between the three Electron processes.
 *
 * This file is imported by main, preload AND renderer, so it must stay free of
 * any Node or DOM APIs: just constants and types. Keeping every channel name
 * here means a typo becomes a compile error instead of a message that silently
 * goes nowhere.
 *
 * Data flow:
 *
 *   control ──params:update──────▶ main ──params:update──────▶ output
 *   control ──audio:settings─────▶ main ──audio:settings─────▶ output
 *   control ──audio:open-file────▶ main ──audio:file─────────▶ output  (main shows the file dialog)
 *   control ──output:*───────────▶ main  (moves / fullscreens the output window)
 *
 *   control ◀──stats────────────── main ◀──stats─────────────── output
 *   control ◀──audio:devices────── main ◀──audio:devices─────── output
 *   control ◀──audio:status─────── main ◀──audio:status──────── output
 *   control ◀──audio:meters─────── main ◀──audio:meters──────── output  (~20 per second)
 *
 * The output window owns audio because analysis has to run next to the render
 * loop: features are needed every frame, and IPC is too slow for that.
 */

import type { AudioSettings } from './audioSettings'

export const IPC = {
  // ---- visual parameters ----
  /** control → main → output: a partial set of visual parameters changed. */
  paramsUpdate: 'params:update',
  /** either window asks main for the latest full parameter set (e.g. after a reload). */
  paramsGet: 'params:get',

  // ---- displays and the output window ----
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

  // ---- audio ----
  /** control → main → output: audio settings changed (source, gain, channel...). */
  audioSettingsUpdate: 'audio:settings',
  /** either window asks main for the current audio settings. */
  audioSettingsGet: 'audio:settings-get',
  /** output → main → control: the list of audio inputs changed. */
  audioDevices: 'audio:devices',
  /** control asks main for the last known list of audio inputs. */
  audioDevicesGet: 'audio:devices-get',
  /** output → main → control: what the audio input is doing ("running", an error...). */
  audioStatus: 'audio:status',
  /** control asks main for the last known audio status. */
  audioStatusGet: 'audio:status-get',
  /** output → main → control: live audio feature values for the meters. */
  audioMeters: 'audio:meters',
  /** control asks main to show a file picker; main sends the chosen file to output. */
  audioOpenFile: 'audio:open-file',
  /** main → output: the bytes of an audio file to play and analyze. */
  audioFile: 'audio:file',

  // ---- stats ----
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

/** One audio input as shown in the source dropdown. */
export interface AudioInputInfo {
  id: string
  label: string
}

export interface AudioStatus {
  state: 'idle' | 'starting' | 'running' | 'error'
  /** Human-readable, shown in the control panel. */
  message: string
}

/** A snapshot of the audio features, for the control panel's meters. */
export interface AudioMeters {
  level: number
  low: number
  mid: number
  high: number
  brightness: number
  onset: number
  momentum: number
  surge: number
  /** -1..1 (can exceed): a whole-step bend up = 1. */
  bend: number
  /** Raw input level in dBFS, before any normalizing. */
  inputDb: number
  clipping: boolean
}

export interface AudioFilePayload {
  name: string
  data: Uint8Array
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

  // audio settings (control writes, output reads)
  sendAudioSettings(patch: Partial<AudioSettings>): void
  getAudioSettings(): Promise<AudioSettings>
  onAudioSettings(callback: (settings: AudioSettings) => void): () => void

  // audio state reported by the output window
  sendAudioDevices(devices: AudioInputInfo[]): void
  getAudioDevices(): Promise<AudioInputInfo[]>
  onAudioDevices(callback: (devices: AudioInputInfo[]) => void): () => void
  sendAudioStatus(status: AudioStatus): void
  getAudioStatus(): Promise<AudioStatus>
  onAudioStatus(callback: (status: AudioStatus) => void): () => void
  sendAudioMeters(meters: AudioMeters): void
  onAudioMeters(callback: (meters: AudioMeters) => void): () => void

  // audio files: control asks, output receives
  openAudioFile(): Promise<string | null>
  onAudioFile(callback: (file: AudioFilePayload) => void): () => void

  // stats
  sendStats(stats: RenderStats): void
  onStats(callback: (stats: RenderStats) => void): () => void
}
