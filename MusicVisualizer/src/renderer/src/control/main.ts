/**
 * Control window: the slider panel.
 *
 * Builds its UI from the parameter list in params/lakeParams.ts and sends every
 * change to main, which forwards it to the output window. It never draws the
 * visuals itself, so it stays light even while the output is busy.
 */
import './control.css'
import { Pane, type FolderApi, type ListInputBindingApi } from 'tweakpane'
import { defaultLakeValues, lakeParams } from '../params/lakeParams'
import type { DisplayInfo, OutputState } from '../../../shared/ipc'

const pane = new Pane({ container: document.getElementById('pane') as HTMLElement })

// ---- output window: which display, fullscreen -----------------------------

const outputFolder = pane.addFolder({ title: 'Output' })
const output = { displayId: 0, fullscreen: false }
let displayBinding: ListInputBindingApi<number> | null = null

// While we copy state from main into the UI, ignore the UI's own change events,
// or every update would echo straight back to main.
let syncingFromMain = false

function displayOptions(displays: DisplayInfo[]): { text: string; value: number }[] {
  return displays.map((d) => ({
    text: `${d.label} (${d.width}×${d.height})${d.primary ? ', main' : ''}`,
    value: d.id
  }))
}

function renderDisplayList(displays: DisplayInfo[]): void {
  // A list's options can't change after creation, so replace the whole binding.
  displayBinding?.dispose()
  displayBinding = outputFolder.addBinding(output, 'displayId', {
    label: 'Display',
    options: displayOptions(displays),
    index: 0
  }) as ListInputBindingApi<number>
  displayBinding.on('change', (ev) => {
    if (!syncingFromMain) window.api.setOutputDisplay(ev.value)
  })
}

function applyOutputState(state: OutputState): void {
  syncingFromMain = true
  output.displayId = state.displayId
  output.fullscreen = state.fullscreen
  pane.refresh()
  syncingFromMain = false
}

outputFolder.addBinding(output, 'fullscreen', { label: 'Fullscreen' }).on('change', (ev) => {
  if (!syncingFromMain) window.api.setOutputFullscreen(ev.value)
})

// ---- visual parameters ----------------------------------------------------

const values = defaultLakeValues()
const folders = new Map<string, FolderApi>()

for (const spec of lakeParams) {
  let folder = folders.get(spec.group)
  if (!folder) {
    folder = pane.addFolder({ title: spec.group })
    folders.set(spec.group, folder)
  }
  folder
    .addBinding(values, spec.key, {
      label: spec.label,
      min: spec.min,
      max: spec.max,
      step: spec.step
    })
    .on('change', (ev) => window.api.sendParams({ [spec.key]: ev.value }))
}

pane.addButton({ title: 'Reset to defaults' }).on('click', () => {
  Object.assign(values, defaultLakeValues())
  pane.refresh() // move the sliders to match
  window.api.sendParams(values)
})

// ---- render stats -----------------------------------------------------------

const statsFolder = pane.addFolder({ title: 'Stats', expanded: false })
const stats = { fps: 0, resolution: '—' }
statsFolder.addBinding(stats, 'fps', {
  readonly: true,
  view: 'graph',
  min: 0,
  max: 144,
  label: 'FPS'
})
statsFolder.addBinding(stats, 'resolution', { readonly: true, label: 'Render size' })
window.api.onStats((s) => {
  stats.fps = s.fps
  stats.resolution = `${s.width}×${s.height}`
})

// ---- startup ----------------------------------------------------------------

async function init(): Promise<void> {
  // If main already has values (this window was reloaded), show those instead of defaults.
  Object.assign(values, await window.api.getParams())
  pane.refresh()
  // Push the full set so main and the output window match what the sliders show.
  window.api.sendParams(values)

  renderDisplayList(await window.api.listDisplays())
  applyOutputState(await window.api.getOutputState())

  window.api.onDisplaysChanged(renderDisplayList)
  window.api.onOutputState(applyOutputState)
}

init()
