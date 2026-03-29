import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      translate: (text: string, from: string, to: string) => Promise<{ result: string; error?: string }>,
      resizeWindow: () => void,
      onShowApp?: (callback: () => void) => void,
      onPasteAndTranslate?: (callback: () => Promise<void>) => void,
    }
  }
}