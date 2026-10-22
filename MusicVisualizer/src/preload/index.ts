/**
 * Preload script: the only bridge between web pages and Electron.
 *
 * It runs before each window's page loads, with access to `ipcRenderer`. Pages
 * themselves have no Node or Electron access at all (sandbox + context
 * isolation), so anything they can ask main to do has to be listed here.
 * Treat this file as an allowlisted API surface: every function is one narrow,
 * typed capability, never a generic "send any message" passthrough.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type DisplayInfo,
  type OutputState,
  type ParamValues,
  type RenderStats,
  type VisualizerApi
} from '../shared/ipc'

/** Subscribe to a main → renderer channel; returns an unsubscribe function. */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: VisualizerApi = {
  sendParams: (patch) => ipcRenderer.send(IPC.paramsUpdate, patch),
  getParams: () => ipcRenderer.invoke(IPC.paramsGet),
  onParams: (callback) => subscribe<ParamValues>(IPC.paramsUpdate, callback),

  listDisplays: () => ipcRenderer.invoke(IPC.displaysList),
  onDisplaysChanged: (callback) => subscribe<DisplayInfo[]>(IPC.displaysChanged, callback),
  setOutputDisplay: (displayId) => ipcRenderer.send(IPC.outputSetDisplay, displayId),
  setOutputFullscreen: (on) => ipcRenderer.send(IPC.outputSetFullscreen, on),
  toggleOutputFullscreen: () => ipcRenderer.send(IPC.outputToggleFullscreen),
  getOutputState: () => ipcRenderer.invoke(IPC.outputGetState),
  onOutputState: (callback) => subscribe<OutputState>(IPC.outputState, callback),

  sendStats: (stats) => ipcRenderer.send(IPC.stats, stats),
  onStats: (callback) => subscribe<RenderStats>(IPC.stats, callback)
}

contextBridge.exposeInMainWorld('api', api)
