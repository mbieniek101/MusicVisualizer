/**
 * The main process side of the audio channels.
 *
 * The output window does the actual audio work; main just relays between the
 * windows, remembers the latest state (so a reloaded control panel can catch
 * up), saves settings, and shows the file picker, the one audio-related thing
 * a sandboxed page can't do itself.
 */
import { dialog, ipcMain, type IpcMainEvent } from 'electron'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import { IPC, type AudioInputInfo, type AudioMeters, type AudioStatus } from '../shared/ipc'
import { mergeAudioSettings } from '../shared/audioSettings'
import { sendTo, type Windows } from './ipc'
import { saveSettingsSoon, type StoredSettings } from './settings'

/** Files bigger than this are refused; a few minutes of WAV is well under it. */
const MAX_FILE_BYTES = 200 * 1024 * 1024

export function registerAudioIpc({ control, output }: Windows, store: StoredSettings): void {
  const fromControl = (e: IpcMainEvent): boolean => e.sender === control.webContents
  const fromOutput = (e: IpcMainEvent): boolean => e.sender === output.webContents

  // Last values reported by the output window, for the control panel to fetch.
  let devices: AudioInputInfo[] = []
  let status: AudioStatus = { state: 'idle', message: 'Starting…' }

  // ---- settings: control → main → output ------------------------------------
  ipcMain.on(IPC.audioSettingsUpdate, (event, patch: unknown) => {
    if (!fromControl(event)) return
    store.audio = mergeAudioSettings(store.audio, patch)
    saveSettingsSoon(store)
    // Send the full settings, not just the patch: the output compares old vs new source.
    // The control panel gets them too, so it always shows what's actually in effect.
    sendTo(output, IPC.audioSettingsUpdate, store.audio)
    sendTo(control, IPC.audioSettingsUpdate, store.audio)
  })
  ipcMain.handle(IPC.audioSettingsGet, () => store.audio)

  // ---- state reports: output → main → control -------------------------------
  ipcMain.on(IPC.audioDevices, (event, list: AudioInputInfo[]) => {
    if (!fromOutput(event)) return
    devices = list
    sendTo(control, IPC.audioDevices, list)
  })
  ipcMain.handle(IPC.audioDevicesGet, () => devices)

  ipcMain.on(IPC.audioStatus, (event, next: AudioStatus) => {
    if (!fromOutput(event)) return
    status = next
    sendTo(control, IPC.audioStatus, next)
  })
  ipcMain.handle(IPC.audioStatusGet, () => status)

  ipcMain.on(IPC.audioMeters, (event, meters: AudioMeters) => {
    if (!fromOutput(event)) return
    sendTo(control, IPC.audioMeters, meters)
  })

  // ---- Reconnect button: control → main → output --------------------------------
  ipcMain.on(IPC.audioReconnect, (event) => {
    if (!fromControl(event)) return
    sendTo(output, IPC.audioReconnect, null)
  })

  // ---- files: control asks, main reads, output plays --------------------------
  ipcMain.handle(IPC.audioOpenFile, async (event) => {
    if (event.sender !== control.webContents) return null
    const result = await dialog.showOpenDialog(control, {
      title: 'Choose an audio file',
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'webm'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const path = result.filePaths[0]
    const data = await readFile(path)
    if (data.byteLength > MAX_FILE_BYTES) {
      dialog.showErrorBox('File too large', 'Choose an audio file under 200 MB.')
      return null
    }
    const name = basename(path)
    sendTo(output, IPC.audioFile, { name, data })
    return name
  })
}
