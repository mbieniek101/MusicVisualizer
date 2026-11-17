/**
 * Window creation and display placement.
 *
 * Two windows:
 *  - control: sliders and settings, lives on the laptop screen
 *  - output:  the visuals, meant to go fullscreen on the projector
 */
import { BrowserWindow, screen, shell, type Display } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { DisplayInfo, OutputState } from '../shared/ipc'

type Page = 'control' | 'output'

/** Settings shared by both windows. The security-relevant ones are spelled out on purpose. */
function baseWindow(
  options: Electron.BrowserWindowConstructorOptions,
  extraWebPreferences: Electron.WebPreferences = {}
): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    ...options,
    webPreferences: {
      ...extraWebPreferences,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true, // renderer runs with Chromium's sandbox, no Node access
      contextIsolation: true, // the page cannot touch the preload's JS world
      nodeIntegration: false
    }
  })

  // Any link a page tries to open goes to the real browser, never a new app window.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return win
}

/** In dev, pages come from the Vite dev server (hot reload); in a build, from disk. */
function loadPage(win: BrowserWindow, page: Page): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devServer) {
    win.loadURL(`${devServer}/${page}.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

export function createControlWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const win = baseWindow({
    title: 'MusicVisualizer · Controls',
    width: 380,
    height: Math.min(780, workArea.height - 80),
    x: workArea.x + 40,
    y: workArea.y + 40,
    backgroundColor: '#141418'
  })
  win.once('ready-to-show', () => win.show())
  loadPage(win, 'control')
  return win
}

export function createOutputWindow(): BrowserWindow {
  const win = baseWindow(
    {
      title: 'MusicVisualizer · Output',
      width: 960,
      height: 540,
      backgroundColor: '#000000'
    },
    // Browsers only allow audio to start after a click. The output window has
    // no buttons to click, so allow it to start audio on its own.
    { autoplayPolicy: 'no-user-gesture-required' }
  )
  win.once('ready-to-show', () => {
    win.show()
    // With a projector or second monitor plugged in, start fullscreen on it.
    // With only the laptop screen, start as a normal window so you can still reach the controls.
    const display = pickDefaultOutputDisplay()
    const isExternal = display.id !== screen.getPrimaryDisplay().id
    placeOutputWindow(win, display, isExternal)
  })
  loadPage(win, 'output')
  return win
}

/** The first non-primary display (projector), or the primary one if that's all there is. */
export function pickDefaultOutputDisplay(): Display {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().find((d) => d.id !== primary.id) ?? primary
}

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Display ${i + 1}`,
    // Electron reports sizes in scaled "DIP" units; multiply by scaleFactor for real pixels.
    width: Math.round(d.size.width * d.scaleFactor),
    height: Math.round(d.size.height * d.scaleFactor),
    primary: d.id === primaryId
  }))
}

/**
 * Move the output window to a display, optionally fullscreen.
 * A fullscreen window has to leave fullscreen before it can be moved, and on
 * some platforms that happens asynchronously, so we wait for the event.
 */
export function placeOutputWindow(win: BrowserWindow, display: Display, fullscreen: boolean): void {
  const place = (): void => {
    const area = display.workArea
    const width = Math.min(960, area.width - 80)
    const height = Math.round((width * 9) / 16)
    win.setBounds({
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    })
    if (fullscreen) win.setFullScreen(true)
  }

  if (win.isFullScreen()) {
    win.once('leave-full-screen', place)
    win.setFullScreen(false)
  } else {
    place()
  }
}

export function getOutputState(win: BrowserWindow): OutputState {
  return {
    displayId: screen.getDisplayMatching(win.getBounds()).id,
    fullscreen: win.isFullScreen()
  }
}
