# MusicVisualizer

A music visualizer for live guitar, built to be projected onto an amp. Desktop app (Electron + TypeScript + WebGL2), Windows-first.

The first mode is a "VHS lake": blobs of color drifting like oil on water, which will later break up like a failing VHS tape in response to your playing.

## Running it

```bash
npm install
npm run dev
```

Two windows open:

- **Controls**: sliders for every visual parameter, the output display picker, and a fullscreen toggle.
- **Output**: the visuals. With a projector or second monitor connected, it opens fullscreen there automatically. In the output window, <kbd>F</kbd> or double-click toggles fullscreen and <kbd>Esc</kbd> exits it.

Closing either window quits the app.

## How the code is organized

```
src/
├─ main/          Electron main process: app lifecycle, windows, displays, IPC relay
├─ preload/       The only bridge between pages and Electron (window.api)
├─ shared/        IPC channel names and types, used by all three processes
└─ renderer/      The two pages
   ├─ control.html, output.html
   └─ src/
      ├─ control/     slider panel (Tweakpane)
      ├─ output/      WebGL canvas + render loop
      ├─ params/      list of adjustable parameters (drives the sliders and defaults)
      ├─ render/      WebGL helpers, scenes (lake), fx (milestone 2), output (milestone 6)
      ├─ audio/       milestone 3: input sources + feature extraction
      ├─ mapping/     milestone 4: audio features → visual parameters
      └─ modes/       later: scene + mapping + FX presets bundled together
```

Data flow: a slider in the control window → `window.api.sendParams` → main → the output window, which copies the change into the parameters its render loop reads every frame. Nothing crosses IPC per frame.

## Roadmap

1. ✅ Two windows, slider-driven lake shader
2. Feedback trails + first VHS passes
3. Audio input (device dropdown, system audio, files) + feature extraction
4. Mapping layer: first playable version
5. Remaining VHS passes, onset-spawned blobs, presets
6. Projection: corner-pin, amp mask
7. Fluid-sim scene and more modes

## Other commands

```bash
npm run typecheck   # TypeScript check for main/preload and renderer
npm run lint        # ESLint + Prettier
npm run build:win   # Windows installer (also build:mac, build:linux)
```
