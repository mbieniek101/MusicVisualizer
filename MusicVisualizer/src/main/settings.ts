/**
 * Settings that survive restarts: slider values and audio settings, stored as
 * JSON in the app's user-data folder. On Windows that's
 * %APPDATA%\musicvisualizer\settings.json; delete it to reset everything.
 */
import { app } from 'electron'
import { existsSync, readFileSync, writeFile, writeFileSync } from 'fs'
import { join } from 'path'
import type { ParamValues } from '../shared/ipc'
import {
  DEFAULT_AUDIO_SETTINGS,
  SOURCE_FILE,
  mergeAudioSettings,
  type AudioSettings
} from '../shared/audioSettings'

export interface StoredSettings {
  params: ParamValues
  audio: AudioSettings
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

/** Read saved settings, falling back to defaults for anything missing or invalid. */
export function loadSettings(): StoredSettings {
  const fallback: StoredSettings = { params: {}, audio: { ...DEFAULT_AUDIO_SETTINGS } }
  try {
    if (!existsSync(settingsPath())) return fallback
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'))

    const params: ParamValues = {}
    for (const [key, value] of Object.entries(raw?.params ?? {})) {
      if (typeof value === 'number' && Number.isFinite(value)) params[key] = value
    }
    const audio = mergeAudioSettings(DEFAULT_AUDIO_SETTINGS, raw?.audio)
    // Audio files aren't kept between launches, so don't start up waiting for one.
    if (audio.source === SOURCE_FILE) audio.source = DEFAULT_AUDIO_SETTINGS.source

    return { params, audio }
  } catch (err) {
    console.error('Could not read settings, using defaults:', err)
    return fallback
  }
}

let saveTimer: NodeJS.Timeout | null = null
let pending: StoredSettings | null = null

/**
 * Save shortly after the last change. Dragging a slider sends dozens of
 * updates a second; this writes the file once, half a second after you let go.
 */
export function saveSettingsSoon(settings: StoredSettings): void {
  pending = settings
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    pending = null
    writeFile(settingsPath(), JSON.stringify(settings, null, 2), (err) => {
      if (err) console.error('Could not save settings:', err)
    })
  }, 500)
}

/** Write any change still waiting on the timer. Called as the app quits. */
export function flushSettings(): void {
  if (!pending) return
  if (saveTimer) clearTimeout(saveTimer)
  try {
    writeFileSync(settingsPath(), JSON.stringify(pending, null, 2))
  } catch (err) {
    console.error('Could not save settings:', err)
  }
  pending = null
}
