import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 纯 Web 配置：用于浏览器开发(dev最快) + Web构建(给 Capacitor 打 APK)
// 与 electron.vite.config.ts(Electron 打包) 共用同一份 renderer 源码
export default defineConfig({
  root: 'src/renderer',
  base: './', // 相对路径，兼容 Capacitor(file://)/Electron
  plugins: [react()],
  resolve: {
    alias: { '@': resolve('src/renderer/src') }
  },
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true
  },
  server: {
    port: 5180,
    host: true // 允许局域网访问，方便在安卓盒子浏览器里直接打开调试
  }
})
