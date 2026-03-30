import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import process from 'node:process'

// Custom APIs for renderer
const api = {
  translate: (text: string, from: string, to: string, provider: 'lara' | 'baidu') => ipcRenderer.invoke('translate', text, from, to, provider),
  resizeWindow: (height?: number) => ipcRenderer.send('resize-window', height),
  onShowApp: (callback: () => void) => {
    ipcRenderer.on('focus-input', callback)
  },
  onPasteAndTranslate: (callback: () => Promise<void>) => {
    ipcRenderer.on('paste-and-translate', callback)
  },
  onSelectionTranslate: (callback: (selectedText: string) => void) => {
    ipcRenderer.on('selection-translate', (_event, selectedText: string) => callback(selectedText))
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  }
  catch (error) {
    console.error(error)
  }
}
else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
