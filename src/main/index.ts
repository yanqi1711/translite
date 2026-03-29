import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell, globalShortcut, clipboard } from 'electron'
import { Credentials, Translator } from '@translated/lara'
import dotenv from 'dotenv'
import icon from '../../resources/icon.png?asset'

dotenv.config()

let mainWindow: BrowserWindow | null = null
const execFileAsync = promisify(execFile)

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

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
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

function toggleWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    }
    else {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('focus-input')
    }
  }
}

async function copySelectionToClipboard(): Promise<string> {
  const clipboardBefore = clipboard.readText()

  try {
    if (process.platform === 'darwin') {
      await execFileAsync('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down'])
    }
    else if (process.platform === 'win32') {
      await execFileAsync('powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")'])
    }
  }
  catch {
    // Best-effort copy selection. Fallback to existing clipboard content.
  }

  await new Promise(resolve => setTimeout(resolve, 120))
  const copiedText = clipboard.readText().trim()
  const selectionText = process.platform === 'linux' ? clipboard.readText('selection').trim() : ''

  return copiedText || selectionText || clipboardBefore.trim()
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
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.webContents.send('paste-and-translate')
    }
  })

  if (!pasteResult) {
    console.error('Paste shortcut registration failed')
  }

  const selectionAccelerator = process.platform === 'darwin' ? 'Command+Shift+S' : 'Ctrl+Shift+S'
  const selectionResult = globalShortcut.register(selectionAccelerator, async () => {
    if (!mainWindow) {
      return
    }

    const selectedText = await copySelectionToClipboard()
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
    mainWindow.webContents.send('selection-translate', selectedText)
  })

  if (!selectionResult) {
    console.error('Selection shortcut registration failed')
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

  ipcMain.on('focus-input', () => {
    if (mainWindow) {
      mainWindow.webContents.send('focus-input')
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
