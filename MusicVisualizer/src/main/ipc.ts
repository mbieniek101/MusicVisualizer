/**
 * IPC handlers: the main process side of every channel in shared/ipc.ts.
 *
 * Main acts as a relay between the two windows and as the only process that
 * can move windows around. Each handler checks WHICH window sent the message,
 * so the output page can't, for example, push parameter changes.
 */
import { ipcMain, screen, type BrowserWindow, type IpcMainEvent } from 'electron'
import { IPC, type ParamValues, type RenderStats } from '../shared/ipc'
import { getOutputState, listDisplays, placeOutputWindow } from './windows'
import { saveSettingsSoon, type StoredSettings } from './settings'

export interface Windows {
  control: BrowserWindow
  output: BrowserWindow
}

/** Keep only finite numbers; anything else from a renderer is dropped. */
function sanitizeParams(value: unknown): ParamValues {
  const clean: ParamValues = {}
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'number' && Number.isFinite(v)) clean[key] = v
    }
  }
  return clean
}

/** Send to a window only if it still exists (it may be closing). */
export function sendTo(win: BrowserWindow, channel: string, payload: unknown): void {
  if (!win.isDestroyed()) win.webContents.send(channel, payload)
}

/**
 * @param store the app's settings, loaded from disk at startup. Handlers update
 *              it in place and schedule a save.
 */
export function registerIpc({ control, output }: Windows, store: StoredSettings): void {
  const fromControl = (e: IpcMainEvent): boolean => e.sender === control.webContents
  const fromOutput = (e: IpcMainEvent): boolean => e.sender === output.webContents

  // ---- parameters -------------------------------------------------------
  // Main keeps the latest values, so a reloaded window can catch up and the
  // sliders come back where you left them next launch.
  ipcMain.on(IPC.paramsUpdate, (event, patch: unknown) => {
    if (!fromControl(event)) return
    const clean = sanitizeParams(patch)
    store.params = { ...store.params, ...clean }
    saveSettingsSoon(store)
    sendTo(output, IPC.paramsUpdate, clean)
  })

  ipcMain.handle(IPC.paramsGet, () => store.params)

  // ---- displays and the output window -----------------------------------
  const broadcastOutputState = (): void => {
    const state = getOutputState(output)
    sendTo(control, IPC.outputState, state)
    sendTo(output, IPC.outputState, state)
  }

  ipcMain.handle(IPC.displaysList, () => listDisplays())
  ipcMain.handle(IPC.outputGetState, () => getOutputState(output))

  ipcMain.on(IPC.outputSetDisplay, (event, displayId: unknown) => {
    if (!fromControl(event)) return
    const display = screen.getAllDisplays().find((d) => d.id === displayId)
    if (display) placeOutputWindow(output, display, output.isFullScreen())
  })

  ipcMain.on(IPC.outputSetFullscreen, (event, on: unknown) => {
    if (!fromControl(event)) return
    output.setFullScreen(on === true)
  })

  ipcMain.on(IPC.outputToggleFullscreen, (event) => {
    if (!fromControl(event) && !fromOutput(event)) return
    output.setFullScreen(!output.isFullScreen())
  })

  output.on('enter-full-screen', broadcastOutputState)
  output.on('leave-full-screen', broadcastOutputState)
  output.on('moved', broadcastOutputState)

  // Projectors get plugged in and unplugged mid-session; keep the control list current.
  const onDisplaysChanged = (): void => {
    sendTo(control, IPC.displaysChanged, listDisplays())
    if (!output.isDestroyed()) broadcastOutputState()
  }
  screen.on('display-added', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)
  screen.on('display-removed', (_event, removed) => {
    // If the projector the output was on disappears, bring the window back as a normal window.
    if (!output.isDestroyed() && getOutputState(output).displayId === removed.id) {
      placeOutputWindow(output, screen.getPrimaryDisplay(), false)
    }
    onDisplaysChanged()
  })

  // ---- stats ------------------------------------------------------------
  ipcMain.on(IPC.stats, (event, stats: RenderStats) => {
    if (!fromOutput(event)) return
    sendTo(control, IPC.stats, stats)
  })
}
