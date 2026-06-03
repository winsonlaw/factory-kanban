import type { WorkshopData } from '../types'
import { useKanban } from '../store/kanban'

/**
 * 实时数据源 —— 连接 data-platform 的 WebSocket，把推送的 WorkshopData 灌入 store。
 * 通过 Vite 环境变量 VITE_WS_URL 启用，例如：
 *   VITE_WS_URL=ws://localhost:8080/ws/workshop/W01
 * 未配置时返回 null，由调用方回退到内置 mock。自动重连。
 */
export function startLiveFeed(): (() => void) | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const url = env?.VITE_WS_URL
  if (!url) return null

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const { setWorkshop, setConnected } = useKanban.getState()

  const connect = (): void => {
    ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type: string; data: WorkshopData }
        if (msg.type === 'workshop' && msg.data) setWorkshop(msg.data)
      } catch {
        /* 忽略坏帧 */
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (!closed) reconnectTimer = setTimeout(connect, 3000) // 断线自动重连
    }

    ws.onerror = () => ws?.close()
  }

  connect()

  return () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  }
}
