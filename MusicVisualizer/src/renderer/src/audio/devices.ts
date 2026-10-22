import type { AudioInputInfo } from '../../../shared/ipc'

/**
 * Every recording device the system knows about: USB amp outputs, audio
 * interfaces, line-in, mics, virtual cables.
 *
 * Windows also lists "Default" and "Communications" entries, which are aliases
 * for real devices further down the list; those are skipped to avoid duplicates.
 */
export async function listAudioInputs(): Promise<AudioInputInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'audioinput')
    .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Audio input ${i + 1}` }))
}

/** Call `callback` whenever a device is plugged in or removed. */
export function onDevicesChanged(callback: () => void): void {
  navigator.mediaDevices.addEventListener('devicechange', callback)
}
