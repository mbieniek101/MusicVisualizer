import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    build: {
      // Two separate pages, one per window. Each becomes its own entry in the build.
      rolldownOptions: {
        input: {
          control: resolve('src/renderer/control.html'),
          output: resolve('src/renderer/output.html')
        }
      }
    }
  }
})
