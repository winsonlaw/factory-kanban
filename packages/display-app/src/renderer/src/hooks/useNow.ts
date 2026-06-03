import { useState, useEffect } from 'react'

/** 共享时钟：每隔 intervalMs 返回当前时间戳，供 Pacing / 计时器等组件刷新 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
