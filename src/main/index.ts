import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell, globalShortcut, clipboard } from 'electron'
import { Credentials, Translator } from '@translated/lara'
import dotenv from 'dotenv'
import icon from '../../resources/icon.png?asset'

dotenv.config()

let mainWindow: BrowserWindow | null = null

type ShowWindowOptions = {
  focusInput?: boolean
  prefillText?: string
  autoTranslate?: boolean
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    minHeight: 500,
    height: 500,
    resizable: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      return
    }

    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    mainWindow.show()
    mainWindow.webContents.send('focus-input')
  })

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isFocused()) {
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  }
  else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(options: ShowWindowOptions = {}) {
  if (!mainWindow) {
    return
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  mainWindow.focus()

  if (options.focusInput) {
    mainWindow.webContents.send('focus-input')
  }

  if (options.prefillText) {
    mainWindow.webContents.send('prefill-and-translate', {
      text: options.prefillText,
      autoTranslate: options.autoTranslate ?? true
    })
  }
}

function toggleWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    }
    else {
      showMainWindow({ focusInput: true })
    }
  }
}

function registerGlobalShortcuts() {
  const accelerator = process.platform === 'darwin' ? 'Command+Shift+T' : 'Ctrl+Shift+T'

  const result = globalShortcut.register(accelerator, () => {
    toggleWindow()
  })

  if (!result) {
    console.error('Global shortcut registration failed')
  }

  const pasteAccelerator = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V'
  const pasteResult = globalShortcut.register(pasteAccelerator, () => {
    if (mainWindow) {
      showMainWindow({ focusInput: true })
      mainWindow.webContents.send('paste-and-translate')
    }
  })

  if (!pasteResult) {
    console.error('Paste shortcut registration failed')
  }

  const selectionAccelerator = process.platform === 'darwin' ? 'Command+Shift+S' : 'Ctrl+Shift+S'
  const selectionResult = globalShortcut.register(selectionAccelerator, () => {
    const selectedText = clipboard.readText().trim()
    showMainWindow({
      focusInput: true,
      prefillText: selectedText,
      autoTranslate: true
    })
  })

  if (!selectionResult) {
    console.error('Selection translate shortcut registration failed')
  }
}

function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('resize-window', (_event, requestedHeight?: number) => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      const [width] = focusedWindow.getSize()
      const minHeight = 500
      const maxHeight = 900
      const targetHeight = typeof requestedHeight === 'number'
        ? Math.max(minHeight, Math.min(Math.ceil(requestedHeight), maxHeight))
        : minHeight

      if (focusedWindow.getSize()[1] !== targetHeight) {
        focusedWindow.setSize(width, targetHeight)
      }
    }
  })

  const LARA_ACCESS_KEY_ID = process.env.LARA_ACCESS_KEY_ID || ''
  const LARA_ACCESS_KEY_SECRET = process.env.LARA_ACCESS_KEY_SECRET || ''

  const credentials = new Credentials(LARA_ACCESS_KEY_ID, LARA_ACCESS_KEY_SECRET)
  const lara = new Translator(credentials)

  const languageCodeMap: Record<string, string> = {
    auto: 'auto',
    zh: 'zh-CN',
    en: 'en-US',
    jp: 'ja-JP',
    kor: 'ko-KR',
    fra: 'fr-FR',
    spa: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    ru: 'ru-RU',
    pt: 'pt-PT'
  }

  ipcMain.handle('translate', async (_event, text: string, from: string, to: string) => {
    try {
      let sourceLang = from === 'auto' ? 'auto' : (languageCodeMap[from] || from)
      const targetLang = languageCodeMap[to] || to

      if (sourceLang === 'auto') {
        const detected = await lara.detect(text)
        sourceLang = detected.language
      }

      const result = await lara.translate(text, sourceLang, targetLang, {
        timeoutInMillis: 10000
      })

      return { result: result.translation }
    } catch (error: any) {
      return { result: '', error: `Translation failed: ${error.message}` }
    }
  })

  createWindow()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterGlobalShortcuts()
})
