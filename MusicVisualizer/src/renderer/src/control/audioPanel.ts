/**
 * "Audio input" and "Audio meters" folders.
 *
 * The settings here go to main (which saves them) and on to the output
 * window, which does the listening. The meters show what the output window's
 * feature extractor is hearing, about 20 times a second, which is the quickest
 * way to tune gain, gate and sensitivity for your rig.
 */
import type { ListInputBindingApi, Pane } from 'tweakpane'
import type { AudioInputInfo, AudioMeters, AudioStatus } from '../../../shared/ipc'
import {
  DEFAULT_AUDIO_SETTINGS,
  DEVICE_PREFIX,
  SOURCE_FILE,
  SOURCE_NONE,
  SOURCE_SYSTEM,
  type AudioSettings
} from '../../../shared/audioSettings'

export function createAudioPanel(pane: Pane): { init(): Promise<void> } {
  // ---- input settings ---------------------------------------------------------

  const folder = pane.addFolder({ title: 'Audio input' })
  const settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }
  let devices: AudioInputInfo[] = []
  let fileName: string | null = null
  let sourceList: ListInputBindingApi<string> | null = null
  let syncingFromMain = false

  const send = (patch: Partial<AudioSettings>): void => {
    if (!syncingFromMain) window.api.sendAudioSettings(patch)
  }

  function sourceOptions(): { text: string; value: string }[] {
    const options = [
      { text: 'None (sliders only)', value: SOURCE_NONE },
      ...devices.map((d) => ({ text: d.label, value: DEVICE_PREFIX + d.id })),
      { text: 'System audio (Windows)', value: SOURCE_SYSTEM },
      { text: fileName ? `File: ${fileName}` : 'Audio file (load one below)', value: SOURCE_FILE }
    ]
    // Keep a saved device that's currently unplugged selectable, rather than
    // silently showing a different one.
    if (!options.some((o) => o.value === settings.source)) {
      options.splice(1, 0, { text: 'Disconnected device', value: settings.source })
    }
    return options
  }

  function renderSourceList(): void {
    // A list's options can't change after creation, so replace the whole binding.
    sourceList?.dispose()
    sourceList = folder.addBinding(settings, 'source', {
      label: 'Source',
      index: 0,
      options: sourceOptions()
    }) as ListInputBindingApi<string>
    sourceList.on('change', (ev) => send({ source: ev.value }))
  }

  folder.addButton({ title: 'Load audio file…' }).on('click', async () => {
    const name = await window.api.openAudioFile()
    if (!name) return // cancelled
    fileName = name
    settings.source = SOURCE_FILE
    renderSourceList()
    send({ source: SOURCE_FILE })
  })

  folder
    .addBinding(settings, 'channel', {
      label: 'Channel',
      options: [
        { text: 'Mix (both)', value: 'mix' },
        { text: 'Left', value: 'left' },
        { text: 'Right', value: 'right' }
      ]
    })
    .on('change', (ev) => send({ channel: ev.value }))

  folder
    .addBinding(settings, 'gain', { label: 'Input gain', min: 0, max: 4, step: 0.01 })
    .on('change', (ev) => send({ gain: ev.value }))

  folder
    .addBinding(settings, 'gateDb', { label: 'Noise gate (dB)', min: -90, max: -20, step: 1 })
    .on('change', (ev) => send({ gateDb: ev.value }))

  folder
    .addBinding(settings, 'sensitivity', {
      label: 'Attack sensitivity',
      min: 0,
      max: 1,
      step: 0.01
    })
    .on('change', (ev) => send({ sensitivity: ev.value }))

  const status = { text: '' }
  folder.addBinding(status, 'text', { label: 'Status', readonly: true, multiline: true, rows: 2 })
  const showStatus = (s: AudioStatus): void => {
    status.text = s.message
  }

  // ---- meters -------------------------------------------------------------------

  const metersFolder = pane.addFolder({ title: 'Audio meters' })
  const meters: AudioMeters = {
    level: 0,
    low: 0,
    mid: 0,
    high: 0,
    brightness: 0,
    onset: 0,
    momentum: 0,
    surge: 0,
    bend: 0,
    inputDb: -120,
    clipping: false
  }

  const graph = (key: keyof AudioMeters, label: string): void => {
    metersFolder.addBinding(meters, key, {
      label,
      readonly: true,
      view: 'graph',
      min: 0,
      max: 1,
      interval: 50,
      rows: 2 // graph height; the default is tall enough to push the sliders off-screen
    })
  }
  graph('level', 'Loudness')
  graph('low', 'Lows')
  graph('mid', 'Mids')
  graph('high', 'Highs')
  graph('brightness', 'Tone')
  graph('onset', 'Attacks')
  graph('surge', 'Surge')
  graph('momentum', 'Momentum')
  // Bends go both ways, so this graph is centered on 0: up = bent sharp, down = flat.
  metersFolder.addBinding(meters, 'bend', {
    label: 'Bend',
    readonly: true,
    view: 'graph',
    min: -1.2,
    max: 1.2,
    interval: 50,
    rows: 2
  })
  metersFolder.addBinding(meters, 'inputDb', {
    label: 'Input (dBFS)',
    readonly: true,
    interval: 100,
    format: (v) => v.toFixed(1)
  })
  metersFolder.addBinding(meters, 'clipping', { label: 'Clipping', readonly: true, interval: 100 })

  const showMeters = (m: AudioMeters): void => {
    Object.assign(meters, m)
    // Silence comes through as -Infinity dB; show it as the bottom of the scale.
    meters.inputDb = Math.max(-120, m.inputDb)
  }

  // ---- startup ----------------------------------------------------------------

  return {
    async init() {
      syncingFromMain = true
      Object.assign(settings, await window.api.getAudioSettings())
      devices = await window.api.getAudioDevices()
      renderSourceList()
      folder.refresh()
      syncingFromMain = false

      showStatus(await window.api.getAudioStatus())

      // Main echoes every settings change back. Only the source is taken from it
      // (it can change from outside this panel); applying the sliders' values too
      // would tug them backwards mid-drag, since each echo is a moment behind.
      window.api.onAudioSettings((next) => {
        if (next.source === settings.source) return
        syncingFromMain = true
        settings.source = next.source
        renderSourceList()
        syncingFromMain = false
      })
      window.api.onAudioDevices((list) => {
        devices = list
        renderSourceList()
      })
      window.api.onAudioStatus(showStatus)
      window.api.onAudioMeters(showMeters)
    }
  }
}
