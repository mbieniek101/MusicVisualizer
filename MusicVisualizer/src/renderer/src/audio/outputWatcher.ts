/**
 * Notices when Windows switches its default playback device, e.g. when you
 * connect Bluetooth headphones or plug in an HDMI projector.
 *
 * Why it matters: "System audio" captures whatever is playing on the default
 * playback device, but Windows ties the capture to the device that was the
 * default when it *started*. Switch devices and the capture keeps listening
 * to the old one, which has gone quiet. When this watcher fires, the output
 * window restarts the capture so it follows the new device.
 *
 * How it detects a change: the browser's device list has a "default" entry
 * whose label names the current default device ("Default - Headphones (...)").
 * When that label changes, the default has changed.
 *
 * The device lookup is passed in, so tests can fake it (outputWatcher.test.ts).
 */
export type OutputLabelLookup = () => Promise<string>

export class DefaultOutputWatcher {
  private known: string | null = null

  constructor(
    private readonly lookup: OutputLabelLookup,
    private readonly onChange: (newLabel: string) => void
  ) {}

  /** Record the current default device (call when a capture starts). Returns its label. */
  async remember(): Promise<string> {
    this.known = await this.lookup()
    return this.known
  }

  /** Stop watching until remember() is called again. */
  forget(): void {
    this.known = null
  }

  /** Look again; if the default device changed since remember(), call onChange once. */
  async check(): Promise<boolean> {
    if (this.known === null) return false
    const label = await this.lookup()
    if (this.known === null || label === this.known) return false
    this.known = label // so a single switch only fires once
    this.onChange(label)
    return true
  }
}

/** "Default - Headphones (WH-1000XM4)" → "Headphones (WH-1000XM4)", for the status line. */
export function readableOutputName(label: string): string {
  return label.replace(/^(Default|Communications)\s*-\s*/i, '').trim()
}
