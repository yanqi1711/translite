import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
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
  const BAIDU_APP_ID = process.env.BAIDU_APP_ID || ''
  const BAIDU_APP_SECRET = process.env.BAIDU_APP_SECRET || ''
  const providerFromEnv = (process.env.TRANSLATION_PROVIDER || '').toLowerCase()
  const hasBaiduCredentials = Boolean(BAIDU_APP_ID && BAIDU_APP_SECRET)
  const hasLaraCredentials = Boolean(LARA_ACCESS_KEY_ID && LARA_ACCESS_KEY_SECRET)
  const useBaiduProvider = providerFromEnv === 'baidu' || (providerFromEnv !== 'lara' && hasBaiduCredentials)

  const lara = hasLaraCredentials
    ? new Translator(new Credentials(LARA_ACCESS_KEY_ID, LARA_ACCESS_KEY_SECRET))
    : null

  const laraLanguageCodeMap: Record<string, string> = {
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

  const baiduLanguageCodeMap: Record<string, string> = {
    auto: 'auto',
    zh: 'zh',
    en: 'en',
    jp: 'jp',
    kor: 'kor',
    fra: 'fra',
    spa: 'spa',
    de: 'de',
    it: 'it',
    ru: 'ru',
    pt: 'pt'
  }

  async function translateWithBaidu(text: string, from: string, to: string): Promise<string> {
    if (!hasBaiduCredentials) {
      throw new Error('Baidu Translate credentials are not configured')
    }

    const sourceLang = baiduLanguageCodeMap[from] || from
    const targetLang = baiduLanguageCodeMap[to] || to
    const salt = randomUUID()
    const sign = createHash('md5').update(`${BAIDU_APP_ID}${text}${salt}${BAIDU_APP_SECRET}`).digest('hex')
    const body = new URLSearchParams({
      q: text,
      from: sourceLang,
      to: targetLang,
      appid: BAIDU_APP_ID,
      salt,
      sign,
    })

    const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      throw new Error(`Baidu Translate API request failed (${response.status})`)
    }

    const data = await response.json() as { error_code?: string, error_msg?: string, trans_result?: Array<{ dst: string }> }
    if (data.error_code) {
      throw new Error(`${data.error_msg || 'Baidu Translate API error'} (${data.error_code})`)
    }

    if (!data.trans_result || data.trans_result.length === 0) {
      throw new Error('Baidu Translate API returned empty translation')
    }

    return data.trans_result.map(item => item.dst).join('\n')
  }

  ipcMain.handle('translate', async (_event, text: string, from: string, to: string) => {
    try {
      if (useBaiduProvider) {
        const translatedText = await translateWithBaidu(text, from, to)
        return { result: translatedText }
      }

      if (!lara) {
        return { result: '', error: 'Translation service is not configured. Please set Baidu or LARA credentials in .env.' }
      }

      let sourceLang = from === 'auto' ? 'auto' : (laraLanguageCodeMap[from] || from)
      const targetLang = laraLanguageCodeMap[to] || to

      if (sourceLang === 'auto') {
        const detected = await lara.detect(text)
        sourceLang = detected.language
      }

      const result = await lara.translate(text, sourceLang, targetLang, {
        timeoutInMillis: 10000
      })

      return { result: result.translation }
    }
    catch (error: any) {
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
