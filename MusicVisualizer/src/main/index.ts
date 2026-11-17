/**
 * Main process entry point: app lifecycle only.
 *
 *   windows.ts      creating and placing the two windows
 *   ipc.ts          parameters, displays, stats
 *   audioIpc.ts     audio settings, device lists, meters, the file picker
 *   permissions.ts  letting the output window use audio inputs
 *   settings.ts     saving and loading settings.json
 */
import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createControlWindow, createOutputWindow } from './windows'
import { registerIpc } from './ipc'
import { registerAudioIpc } from './audioIpc'
import { setupMediaPermissions } from './permissions'
import { flushSettings, loadSettings } from './settings'

app.whenReady().then(() => {
  // Groups the app correctly in the Windows taskbar. Matches appId in electron-builder.yml.
  electronApp.setAppUserModelId('com.electron.app')

  // F12 opens DevTools in development; Ctrl+R reload is disabled in production builds.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const store = loadSettings()

  const output = createOutputWindow()
  const control = createControlWindow()
  // Pages load asynchronously, so these are in place before either page runs.
  setupMediaPermissions(output)
  registerIpc({ control, output }, store)
  registerAudioIpc({ control, output }, store)

  // The two windows only make sense together: closing either one quits the app.
  control.on('closed', () => app.quit())
  output.on('closed', () => app.quit())
})

// Don't lose a slider change made in the last half second before quitting.
app.on('before-quit', flushSettings)

app.on('window-all-closed', () => {
  app.quit()
})
