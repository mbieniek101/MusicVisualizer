# MusicVisualizer

A music visualizer for live guitar, built to be projected onto an amp. Desktop app (Electron + TypeScript + WebGL2), Windows-first.

The first mode is a "VHS lake": blobs of color drifting like oil on water that react to your playing, and which will later break up like a failing VHS tape.

## Running it

```bash
npm install
npm run dev
```

Two windows open:

- **Controls**: output display and fullscreen, audio input, live audio meters, and sliders for every visual parameter.
- **Output**: the visuals. With a projector or second monitor connected, it opens fullscreen there automatically. In the output window, <kbd>F</kbd> or double-click toggles fullscreen and <kbd>Esc</kbd> exits it.

Closing either window quits the app. Slider values and audio settings are saved and restored next launch (on Windows, in `%APPDATA%\musicvisualizer\settings.json`; delete it to reset).

## Hooking up audio

In **Audio input**, pick a **Source**:

- **A recording device**: your amp's USB output, an audio interface, a line in. The browser's voice-call processing (echo cancellation, noise suppression, auto gain) is turned off so your dynamics come through untouched.
- **System audio (Windows)**: whatever the computer is playing, e.g. a backing track. You can listen on headphones at the same time. If you switch playback devices (connect Bluetooth headphones, plug in HDMI), the capture follows the new device automatically; the status line shows which device it's listening through. **Reconnect input** restarts the source if it ever gets stuck.
- **Audio file**: click **Load audio file…** to loop a recording through the speakers. Handy for tuning at a desk without your rig.

Then watch **Audio meters** while you play:

1. **Input (dBFS)** should sit well below 0 when you play hard, and **Clipping** should stay false. If it clips, turn down the amp's output or **Input gain**.
2. Raise **Noise gate** until the meters stay flat when you're not playing (hum and hiss shouldn't move the visuals).
3. Set **Attack sensitivity** so **Attacks** spikes once per pick stroke: lower it if it fires on its own, raise it if it misses notes.

Loudness and the band meters auto-level, so your loudest recent playing reads as ~1 whatever your levels. The **Reactivity** sliders set how strongly each audio feature moves the visuals; 0 turns a connection off.

The visuals respond in three layers:

- **The sound right now**: loudness spreads color, lows stir the liquid, tone shifts the palette, and each pick attack flares the colors.
- **Surge**: each attack shoves the lake forward and it coasts to a stop. Attacks that land before it stops stack up, so a fast run builds into a big rush while a single note is a nudge.
- **Momentum**: playing hard and busy builds up over a couple of seconds and makes everything faster, more turbulent, more colorful and snappier, then winds down a few seconds after you stop. A quiet intro stays calm; a heavy section takes the lake with it.

- **Bends**: bending a string winds a whirlpool into the middle of the pond, one way for bending up and the other for bending down, and slides the colors along the palette. It follows your finger as you bend, vibrato makes it wobble, and it unwinds when you release. Chords don't trigger it, only single notes. **Swirl** (in Shape) sets a resting whirlpool that bends add to.

Watch **Surge**, **Momentum** and **Bend** in Audio meters to see them working. **Momentum → intensity** and **Attack → surge** set how much they do.

**Smoothness** (top of Reactivity) sets how quickly the visuals travel to where the audio sends them; momentum shortens it while you're playing hard. Lower it for punchier response; 0 turns the easing off entirely. The per-parameter timings are in `lakeGlide` in `src/renderer/src/mapping/lakeMapping.ts`, and the momentum tuning is at the top of `src/renderer/src/audio/momentum.ts`.

## How the code is organized

```
src/
├─ main/          Electron main process: lifecycle, windows, IPC relay, audio permissions, settings file
├─ preload/       The only bridge between pages and Electron (window.api)
├─ shared/        IPC channel names and types, audio settings; used by all three processes
└─ renderer/      The two pages
   ├─ control.html, output.html
   └─ src/
      ├─ control/     the settings panel, one file per folder (Tweakpane)
      ├─ output/      WebGL canvas, render loop, audio wiring
      ├─ audio/       input sources + feature extraction (loudness, bands, tone, attacks)
      ├─ mapping/     audio features → visual parameters
      ├─ modes/       a scene + its sliders + its mapping, bundled
      ├─ params/      slider definitions
      └─ render/      WebGL helpers, scenes (lake), fx (milestone 2), output (milestone 6)
```

Each frame in the output window:

```
audio input ──▶ FeatureExtractor ──▶ features ─┐
slider values (from the control window) ───────┴──▶ mode.map() ──▶ scene.render()
```

Nothing crosses IPC per frame: slider changes arrive occasionally, and audio is analyzed in the output window itself. Each folder under `src/renderer/src` has a README with more detail.

## Roadmap

1. ✅ Two windows, slider-driven lake shader
2. Feedback trails + first VHS passes
3. ✅ Audio input (device dropdown, system audio, files) + feature extraction
4. ✅ Mapping layer: first playable version
5. Remaining VHS passes, onset-spawned blobs, presets
6. Projection: corner-pin, amp mask
7. Fluid-sim scene and more modes

## Other commands

```bash
npm test            # unit tests (audio analysis and mapping)
npm run test:watch  # re-run tests as you edit
npm run typecheck   # TypeScript check for main/preload and renderer
npm run lint        # ESLint + Prettier
npm run build:win   # Windows installer (also build:mac, build:linux)
```
