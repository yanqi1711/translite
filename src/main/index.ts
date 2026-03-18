import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import dotenv from 'dotenv'
import icon from '../../resources/icon.png?asset'

dotenv.config()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  }
  else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 百度翻译API配置
  const BAIDU_APP_ID = process.env.BAIDU_APP_ID || ''
  const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''

  // 百度翻译API处理
  ipcMain.handle('translate', async (_event, text: string, from: string, to: string) => {
    try {
      const salt = Date.now().toString()
      const sign = CryptoJS.MD5(BAIDU_APP_ID + text + salt + BAIDU_SECRET_KEY).toString()

      const response = await axios.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {
        params: {
          q: text,
          from,
          to,
          appid: BAIDU_APP_ID,
          salt,
          sign
        }
      })

      if (response.data.error_code) {
        return { result: '', error: `翻译错误: ${response.data.error_msg}` }
      }

      const translatedText = response.data.trans_result?.map((item: any) => item.dst).join('\n') || ''
      return { result: translatedText }
    } catch (error: any) {
      return { result: '', error: `请求失败: ${error.message}` }
    }
  })

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.