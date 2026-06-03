import { useEffect, useRef } from 'react'
import type { AlarmItem } from '../types'

interface Props {
  alarms: AlarmItem[]
}

export function AlarmTicker({ alarms }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let pos = 0
    const speed = 0.5
    const raf = setInterval(() => {
      pos += speed
      if (pos >= el.scrollHeight / 2) pos = 0
      el.scrollTop = pos
    }, 30)
    return () => clearInterval(raf)
  }, [alarms])

  if (alarms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full opacity-40 text-sm" style={{ color: '#00d4ff' }}>
        暂无报警
      </div>
    )
  }

  const doubled = [...alarms, ...alarms]

  return (
    <div ref={scrollRef} className="overflow-hidden h-full" style={{ scrollBehavior: 'auto' }}>
      {doubled.map((alarm, i) => (
        <div
          key={`${alarm.id}-${i}`}
          className="flex items-start gap-2 py-2 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span
            className="shrink-0 mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: alarm.level === 'alarm' ? '#ff4a4a22' : '#ffb34022',
              color: alarm.level === 'alarm' ? '#ff4a4a' : '#ffb340',
              border: `1px solid ${alarm.level === 'alarm' ? '#ff4a4a' : '#ffb340'}40`
            }}
          >
            {alarm.level === 'alarm' ? '故障' : '预警'}
          </span>
          <div className="min-w-0">
            <div className="text-xs" style={{ color: '#a0aec0' }}>
              {alarm.lineName}{alarm.stationName ? ` · ${alarm.stationName}` : ''} · {alarm.time}
            </div>
            <div className="text-sm mt-0.5" style={{ color: '#e2e8f0' }}>{alarm.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
