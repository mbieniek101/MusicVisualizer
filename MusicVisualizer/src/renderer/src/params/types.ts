import type { ParamValues } from '../../../shared/ipc'

/** One adjustable number: becomes a slider in the control window. */
export interface ParamSpec {
  key: string
  label: string
  /** Sliders with the same group share a folder in the control panel. */
  group: string
  min: number
  max: number
  step: number
  default: number
}

/** { key: default } for a list of parameters. */
export function defaultValues(specs: ParamSpec[]): ParamValues {
  return Object.fromEntries(specs.map((p) => [p.key, p.default]))
}
