/**
 * Audio input settings: chosen in the control window, used by the output
 * window, remembered by main between launches. Shared by all three, so: no
 * Node or DOM APIs in here.
 */

export type ChannelMode = 'mix' | 'left' | 'right'

export interface AudioSettings {
  /**
   * Which input to listen to:
   *   'none'               no audio, visuals run on the sliders alone
   *   'device:<deviceId>'  a recording device (amp USB out, interface, line in...)
   *   'system'             whatever the computer is playing (Windows only)
   *   'file'               the most recently loaded audio file, looped
   */
  source: string
  /** Linear gain applied before analysis. 1 = unchanged. */
  gain: number
  /** Which channel of a stereo input to analyze. */
  channel: ChannelMode
  /** Input below this level (dBFS) counts as silence: hiss and hum stay invisible. */
  gateDb: number
  /** 0..1. Higher = smaller attacks count as onsets. */
  sensitivity: number
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  source: 'none',
  gain: 1,
  channel: 'mix',
  gateDb: -60,
  sensitivity: 0.5
}

export const SOURCE_NONE = 'none'
export const SOURCE_SYSTEM = 'system'
export const SOURCE_FILE = 'file'
export const DEVICE_PREFIX = 'device:'

/** Merge an untrusted patch into settings, keeping only valid values. */
export function mergeAudioSettings(current: AudioSettings, patch: unknown): AudioSettings {
  const next = { ...current }
  if (!patch || typeof patch !== 'object') return next
  const p = patch as Record<string, unknown>

  if (typeof p.source === 'string' && p.source.length < 512) next.source = p.source
  if (p.channel === 'mix' || p.channel === 'left' || p.channel === 'right') next.channel = p.channel
  if (isFiniteNumber(p.gain)) next.gain = clamp(p.gain, 0, 10)
  if (isFiniteNumber(p.gateDb)) next.gateDb = clamp(p.gateDb, -120, 0)
  if (isFiniteNumber(p.sensitivity)) next.sensitivity = clamp(p.sensitivity, 0, 1)
  return next
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
