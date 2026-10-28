/**
 * The output window's audio wiring: connects the AudioEngine and
 * FeatureExtractor to the control panel (through window.api).
 *
 *   control panel ──settings──▶ applySettings() ──▶ AudioEngine (source, gain, channel)
 *   render loop ──update(dt)──▶ AudioEngine.read() ──▶ FeatureExtractor ──▶ AudioFeatures
 *                                                           └──▶ meters ──▶ control panel
 *
 * The render loop only ever calls update(dt). Everything else here reacts to
 * messages.
 *
 * System audio needs extra care: Windows ties the capture to whichever playback
 * device was the default when it started. So while it's the source, this file
 * watches for the default device changing (connecting Bluetooth headphones,
 * plugging in HDMI) and restarts the capture on the new device.
 */
import {
  DEFAULT_AUDIO_SETTINGS,
  DEVICE_PREFIX,
  SOURCE_FILE,
  SOURCE_NONE,
  SOURCE_SYSTEM,
  type AudioSettings
} from '../../../shared/audioSettings'
import type { AudioInputInfo, AudioStatus } from '../../../shared/ipc'
import { AudioEngine } from '../audio/AudioEngine'
import { FeatureExtractor } from '../audio/FeatureExtractor'
import { defaultOutputLabel, listAudioInputs, onDevicesChanged } from '../audio/devices'
import { DefaultOutputWatcher, readableOutputName } from '../audio/outputWatcher'
import { SILENT_FEATURES, type AudioFeatures } from '../audio/types'

/** How often to send meter values to the control panel. More often just costs IPC. */
const METER_INTERVAL = 0.05

/** How often to double-check the default playback device while using system audio (ms). */
const OUTPUT_CHECK_INTERVAL = 1500

/** Wait this long after a device change before reconnecting: Bluetooth takes a moment to settle (ms). */
const RECONNECT_DELAY = 800

export interface AudioInput {
  /** Called once per frame by the render loop. */
  update(dt: number): AudioFeatures
}

export async function startAudioInput(): Promise<AudioInput> {
  const engine = new AudioEngine()
  const extractor = new FeatureExtractor()

  let settings: AudioSettings = DEFAULT_AUDIO_SETTINGS
  let devices: AudioInputInfo[] = []
  let file: { name: string; data: ArrayBuffer } | null = null
  let meterTimer = 0

  // Each source switch gets a number. If the user picks another source while
  // an older one is still starting (e.g. waiting on a device), the older one
  // sees it's stale and shuts itself down instead of taking over.
  let switchCount = 0

  const setStatus = (state: AudioStatus['state'], message: string): void => {
    window.api.sendAudioStatus({ state, message })
  }

  // ---- following the default playback device (system audio only) -------------

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /** Restart the current source shortly, unless something else restarts it first. */
  function reconnectSoon(reason: string): void {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    setStatus('starting', `${reason} Reconnecting…`)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void switchSource(settings.source)
    }, RECONNECT_DELAY)
  }

  const outputWatcher = new DefaultOutputWatcher(defaultOutputLabel, (label) => {
    if (settings.source !== SOURCE_SYSTEM) return
    reconnectSoon(`Playback switched to ${readableOutputName(label) || 'another device'}.`)
  })
  // devicechange events usually catch a switch right away; this is the backup.
  setInterval(() => void outputWatcher.check(), OUTPUT_CHECK_INTERVAL)

  engine.onSourceEnded = () => {
    if (settings.source === SOURCE_SYSTEM) {
      reconnectSoon('System audio capture stopped.')
    } else if (settings.source.startsWith(DEVICE_PREFIX)) {
      setStatus('error', 'The input device disconnected. Pick it again, or click Reconnect.')
    }
  }

  async function switchSource(source: string): Promise<void> {
    const mySwitch = ++switchCount
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    outputWatcher.forget()
    engine.stop()
    extractor.reset()

    try {
      if (source === SOURCE_NONE) {
        setStatus('idle', 'No audio input. The visuals follow the sliders only.')
        return
      }

      setStatus('starting', 'Starting…')
      let label: string
      if (source === SOURCE_SYSTEM) {
        await engine.useSystemAudio()
        // Remember which device the capture is attached to, to notice if it changes.
        const output = readableOutputName(await outputWatcher.remember())
        label = output ? `System audio (${output})` : 'System audio'
      } else if (source === SOURCE_FILE) {
        if (!file) {
          setStatus('idle', 'Load an audio file to use this source.')
          return
        }
        // decodeAudioData takes ownership of the buffer it's given, so pass a copy
        // to keep ours for the next time this source is selected.
        await engine.useFile(file.data.slice(0))
        label = file.name
      } else if (source.startsWith(DEVICE_PREFIX)) {
        const id = source.slice(DEVICE_PREFIX.length)
        await engine.useDevice(id)
        label = devices.find((d) => d.id === id)?.label ?? 'Audio input'
      } else {
        throw new Error(`Unknown source "${source}"`)
      }

      if (mySwitch !== switchCount) return // superseded while starting
      setStatus('running', `Listening: ${label}`)
    } catch (err) {
      if (mySwitch !== switchCount) return
      engine.stop()
      setStatus('error', describeError(err))
    }
  }

  async function applySettings(next: AudioSettings, forceRestart = false): Promise<void> {
    const sourceChanged = next.source !== settings.source
    settings = next
    engine.setGain(next.gain)
    engine.setChannel(next.channel)
    if (sourceChanged || forceRestart) await switchSource(next.source)
  }

  async function refreshDevices(): Promise<void> {
    devices = await listAudioInputs()
    window.api.sendAudioDevices(devices)

    // If the device we were listening to was unplugged, say so.
    if (settings.source.startsWith(DEVICE_PREFIX)) {
      const id = settings.source.slice(DEVICE_PREFIX.length)
      if (!devices.some((d) => d.id === id)) {
        engine.stop()
        setStatus('error', 'The selected device is no longer connected.')
      }
    }
  }

  // ---- wire up messages -------------------------------------------------------

  window.api.onAudioSettings((next) => void applySettings(next))

  window.api.onAudioFile(({ name, data }) => {
    // Copy the bytes out into an ArrayBuffer we own.
    file = { name, data: data.slice().buffer }
    // If the file source is already selected, start the new file right away.
    // Otherwise the control panel switches the source to "file" next.
    if (settings.source === SOURCE_FILE) void switchSource(SOURCE_FILE)
  })

  onDevicesChanged(() => {
    void refreshDevices()
    void outputWatcher.check()
  })

  // The control panel's Reconnect button: restart whatever source is selected.
  window.api.onAudioReconnect(() => void switchSource(settings.source))

  // ---- start up ---------------------------------------------------------------

  await refreshDevices()
  await applySettings(await window.api.getAudioSettings(), true)
  // Device names can be blank until access is granted, so list once more.
  await refreshDevices()

  return {
    update(dt: number): AudioFeatures {
      const features = engine.hasSource
        ? extractor.update(engine.read(dt), settings)
        : SILENT_FEATURES

      meterTimer += dt
      if (meterTimer >= METER_INTERVAL) {
        meterTimer = 0
        window.api.sendAudioMeters({
          level: features.level,
          low: features.low,
          mid: features.mid,
          high: features.high,
          brightness: features.brightness,
          onset: features.onset,
          momentum: features.momentum,
          surge: features.surge,
          bend: features.bend,
          inputDb: features.inputDb,
          clipping: features.clipping
        })
      }
      return features
    }
  }
}

/** Turn the browser's error names into something a person can act on. */
function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'That device isn’t connected. Pick another source.'
  }
  if (name === 'NotAllowedError') return 'Access to the audio input was denied.'
  if (name === 'NotReadableError')
    return 'The device is busy or unavailable (another app may be using it).'
  if (name === 'EncodingError') return 'Could not decode that audio file.'
  return err instanceof Error ? err.message : String(err)
}
