/**
 * One slider per parameter, grouped into folders by `group`, plus a reset
 * button. Built entirely from ParamSpec lists, so new parameters show up
 * without touching this file.
 */
import type { FolderApi, Pane } from 'tweakpane'
import { defaultValues, type ParamSpec } from '../params/types'

export function createParamsPanel(pane: Pane, specs: ParamSpec[]): { init(): Promise<void> } {
  const values = defaultValues(specs)
  const folders = new Map<string, FolderApi>()

  for (const spec of specs) {
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

  const refreshAll = (): void => folders.forEach((f) => f.refresh())

  pane.addButton({ title: 'Reset sliders to defaults' }).on('click', () => {
    Object.assign(values, defaultValues(specs))
    refreshAll()
    window.api.sendParams(values)
  })

  return {
    async init() {
      // Show the saved values (or the current ones, if this window was reloaded).
      const saved = await window.api.getParams()
      for (const spec of specs) {
        if (spec.key in saved) values[spec.key] = saved[spec.key]
      }
      refreshAll()
      // Push the full set so main and the output window match what the sliders show.
      window.api.sendParams(values)
    }
  }
}
