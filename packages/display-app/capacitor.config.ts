import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor 配置：把 dist-web(Vite 构建产物) 打成安卓 APK
// 与 Electron 共用同一份前端，发布时: npm run build:android
const config: CapacitorConfig = {
  appId: 'com.factory.kanban',
  appName: '生产看板',
  webDir: 'dist-web',
  android: {
    // 允许 http 明文(对接内网后端 WebSocket/HTTP 时需要)
    allowMixedContent: true
  },
  server: {
    androidScheme: 'http'
  }
}

export default config
