/**
 * Audio access for the output window.
 *
 * In a browser, a page asking for the microphone gets a permission prompt.
 * Electron routes those requests to the main process instead, and by default
 * there's no one to answer them. These handlers answer: the output window may
 * use audio inputs and capture system audio; nothing else may.
 */
import {
  desktopCapturer,
  session,
  webContents,
  type BrowserWindow,
  type WebContents
} from 'electron'

export function setupMediaPermissions(output: BrowserWindow): void {
  const ses = session.defaultSession
  const isOutput = (wc: WebContents | null): boolean =>
    wc !== null && !output.isDestroyed() && wc === output.webContents

  // "May this page open an audio input?" (getUserMedia, getDisplayMedia)
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(isOutput(wc) && (permission === 'media' || permission === 'display-capture'))
  })

  // "Does this page already have audio permission?" Answering yes here is what
  // makes device *names* show up in the list instead of blanks.
  ses.setPermissionCheckHandler((wc, permission) => isOutput(wc) && permission === 'media')

  // System audio. The page asks to capture the screen with audio; we hand it
  // the first screen plus 'loopback' audio (everything the computer is playing).
  // The page throws the video away. Loopback audio is supported on Windows.
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      const requester = request.frame ? (webContents.fromFrame(request.frame) ?? null) : null
      if (!isOutput(requester)) {
        callback({}) // refuse
        return
      }
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
        .catch(() => callback({}))
    },
    { useSystemPicker: false }
  )
}
