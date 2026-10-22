/**
 * Main process entry point: app lifecycle only.
 * Window details live in windows.ts, message handling in ipc.ts.
 */
import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createControlWindow, createOutputWindow } from './windows'
import { registerIpc } from './ipc'

app.whenReady().then(() => {
  // Groups the app correctly in the Windows taskbar. Matches appId in electron-builder.yml.
  electronApp.setAppUserModelId('com.electron.app')

  // F12 opens DevTools in development; Ctrl+R reload is disabled in production builds.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const output = createOutputWindow()
  const control = createControlWindow()
  registerIpc({ control, output })

  // The two windows only make sense together: closing either one quits the app.
  control.on('closed', () => app.quit())
  output.on('closed', () => app.quit())
})

app.on('window-all-closed', () => {
  app.quit()
})
