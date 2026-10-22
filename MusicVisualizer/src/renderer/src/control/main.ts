/**
 * Control window: the settings panel.
 *
 * It's built from independent panels, top to bottom. Each one sends its
 * changes through window.api to main, which saves them and forwards them to
 * the output window. This window never draws visuals or touches audio, so it
 * stays responsive while the output is busy.
 */
import './control.css'
import { Pane } from 'tweakpane'
import { activeMode } from '../modes/vhsLake'
import { outputParams } from '../params/outputParams'
import { createOutputPanel } from './outputPanel'
import { createAudioPanel } from './audioPanel'
import { createParamsPanel } from './paramsPanel'
import { createStatsPanel } from './statsPanel'

const pane = new Pane({ container: document.getElementById('pane') as HTMLElement })

const outputPanel = createOutputPanel(pane)
const audioPanel = createAudioPanel(pane)
const paramsPanel = createParamsPanel(pane, [...activeMode.params, ...outputParams])
createStatsPanel(pane)

// Fill each panel with the current state from main.
void outputPanel.init()
void audioPanel.init()
void paramsPanel.init()
