/**
 * The Web Audio graph: gets sound in from a source and exposes it for analysis.
 *
 *   source ──▶ channel picker ──▶ gain ──▶ analyser ──▶ read() each frame
 *      │
 *      └──▶ speakers (audio files only, so you can hear what's being analyzed)
 *
 * Live inputs are NOT sent to the speakers: you already hear your amp, and
 * playing a mic or loopback input back out would cause echo or feedback.
 *
 * This class knows nothing about features or visuals; it only moves audio.
 */
import type { ChannelMode } from '../../../shared/audioSettings'
import type { AnalysisFrame } from './types'

/**
 * Samples per analysis window. 2048 at 48 kHz ≈ 43 ms of audio and ~23 Hz per
 * frequency bin: fine enough to separate a guitar's low notes, short enough to
 * feel instant. Must be a power of two.
 */
const FFT_SIZE = 2048

export class AudioEngine {
  readonly context = new AudioContext({ latencyHint: 'interactive' })

  private readonly gainNode = this.context.createGain()
  private readonly analyser = this.context.createAnalyser()
  private readonly splitter = this.context.createChannelSplitter(2)

  private source: AudioNode | null = null
  private stopSource: (() => void) | null = null
  private sendToSpeakers = false
  private channel: ChannelMode = 'mix'

  private readonly timeDomain: Float32Array<ArrayBuffer>
  private readonly spectrumDb: Float32Array<ArrayBuffer>

  constructor() {
    this.analyser.fftSize = FFT_SIZE
    // The analyser can smooth its spectrum over time, but onset detection needs
    // the raw frame-to-frame changes. FeatureExtractor does its own smoothing.
    this.analyser.smoothingTimeConstant = 0
    this.gainNode.connect(this.analyser)

    this.timeDomain = new Float32Array(this.analyser.fftSize)
    this.spectrumDb = new Float32Array(this.analyser.frequencyBinCount)
  }

  get hasSource(): boolean {
    return this.source !== null
  }

  /** Listen to a recording device: an amp's USB output, an interface, a line in. */
  async useDevice(deviceId: string): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        // Browsers apply voice-call processing to inputs by default. For an
        // instrument it gates sustain and flattens dynamics, so turn it all off.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 }
      }
    })
    this.attach(this.context.createMediaStreamSource(stream), () => stopTracks(stream), false)
  }

  /**
   * Listen to everything the computer is playing (Spotify, a backing track...).
   * Uses screen capture with "loopback" audio, which main approves without a
   * prompt; the video part is thrown away. Windows only for now.
   */
  async useSystemAudio(): Promise<void> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
    for (const track of stream.getVideoTracks()) {
      track.stop()
      stream.removeTrack(track)
    }
    if (stream.getAudioTracks().length === 0) {
      stopTracks(stream)
      throw new Error('System audio capture is not supported on this system')
    }
    this.attach(this.context.createMediaStreamSource(stream), () => stopTracks(stream), false)
  }

  /** Decode an audio file (mp3, wav, ogg, flac...) and loop it, playing through the speakers. */
  async useFile(encoded: ArrayBuffer): Promise<void> {
    const buffer = await this.context.decodeAudioData(encoded)
    const node = this.context.createBufferSource()
    node.buffer = buffer
    node.loop = true
    node.start()
    this.attach(node, () => node.stop(), true)
  }

  /** Disconnect and release the current source (closes the device or capture). */
  stop(): void {
    this.source?.disconnect()
    this.stopSource?.()
    this.source = null
    this.stopSource = null
  }

  /** 1 = unchanged. Ramped over ~20 ms so changing it doesn't click. */
  setGain(gain: number): void {
    this.gainNode.gain.setTargetAtTime(gain, this.context.currentTime, 0.02)
  }

  setChannel(channel: ChannelMode): void {
    this.channel = channel
    if (this.source) this.connectSource()
  }

  /** Copy the analyser's latest samples and spectrum into reusable arrays. */
  read(dt: number): AnalysisFrame {
    this.analyser.getFloatTimeDomainData(this.timeDomain)
    this.analyser.getFloatFrequencyData(this.spectrumDb)
    return {
      timeDomain: this.timeDomain,
      spectrumDb: this.spectrumDb,
      sampleRate: this.context.sampleRate,
      dt
    }
  }

  private attach(node: AudioNode, stop: () => void, sendToSpeakers: boolean): void {
    this.stop()
    this.source = node
    this.stopSource = stop
    this.sendToSpeakers = sendToSpeakers
    this.connectSource()
    // An AudioContext can start out suspended; make sure it's running.
    void this.context.resume()
  }

  /** (Re)wire the source into the graph according to the channel setting. */
  private connectSource(): void {
    const source = this.source
    if (!source) return
    source.disconnect()
    this.splitter.disconnect()

    if (this.channel === 'mix') {
      // The analyser mixes stereo down to mono on its own.
      source.connect(this.gainNode)
    } else {
      // Split into separate channels and pass on just one.
      // (A mono input has nothing on the right channel.)
      source.connect(this.splitter)
      this.splitter.connect(this.gainNode, this.channel === 'left' ? 0 : 1)
    }

    if (this.sendToSpeakers) source.connect(this.context.destination)
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}
