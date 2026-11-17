/**
 * "Output" folder: which display the visuals go to, and fullscreen.
 */
import type { ListInputBindingApi, Pane } from 'tweakpane'
import type { DisplayInfo, OutputState } from '../../../shared/ipc'

export function createOutputPanel(pane: Pane): { init(): Promise<void> } {
  const folder = pane.addFolder({ title: 'Output' })
  const state = { displayId: 0, fullscreen: false }
  let displayList: ListInputBindingApi<number> | null = null

  // While copying state from main into the UI, ignore the UI's own change
  // events, or every update would echo straight back to main.
  let syncingFromMain = false

  function renderDisplayList(displays: DisplayInfo[]): void {
    // A list's options can't change after creation, so replace the whole binding.
    displayList?.dispose()
    displayList = folder.addBinding(state, 'displayId', {
      label: 'Display',
      index: 0,
      options: displays.map((d) => ({
        text: `${d.label} (${d.width}×${d.height})${d.primary ? ', main' : ''}`,
        value: d.id
      }))
    }) as ListInputBindingApi<number>
    displayList.on('change', (ev) => {
      if (!syncingFromMain) window.api.setOutputDisplay(ev.value)
    })
  }

  function applyOutputState(next: OutputState): void {
    syncingFromMain = true
    state.displayId = next.displayId
    state.fullscreen = next.fullscreen
    folder.refresh()
    syncingFromMain = false
  }

  folder.addBinding(state, 'fullscreen', { label: 'Fullscreen' }).on('change', (ev) => {
    if (!syncingFromMain) window.api.setOutputFullscreen(ev.value)
  })

  return {
    async init() {
      renderDisplayList(await window.api.listDisplays())
      applyOutputState(await window.api.getOutputState())
      window.api.onDisplaysChanged(renderDisplayList)
      window.api.onOutputState(applyOutputState)
    }
  }
}
