import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  main: {
    define: {
      'process.env.LARA_ACCESS_KEY_ID': JSON.stringify(process.env.LARA_ACCESS_KEY_ID || ''),
      'process.env.LARA_ACCESS_KEY_SECRET': JSON.stringify(process.env.LARA_ACCESS_KEY_SECRET || '')
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})