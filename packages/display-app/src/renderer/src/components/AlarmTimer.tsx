import { motion } from 'framer-motion'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { formatElapsed } from '../utils/pacing'
import type { AlarmItem } from '../types'

/**
 * 报警条 + 已持续时长实时计时器 —— 救火时效的灵魂
 * 故障级红色闪烁；持续越久越醒目
 */
export function AlarmTimer({ alarm, onAction }: { alarm: AlarmItem; onAction?: () => void }) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const elapsedMs = now - alarm.startTs
  const elapsedMin = elapsedMs / 60000

  const isAlarm = alarm.level === 'alarm'
  const color = isAlarm ? t.alarm : t.warn
  // 超过10分钟未处理：加重警示
  const urgent = isAlarm && elapsedMin > 10

  return (
    <motion.div
      className="rounded-lg p-2.5 flex items-center gap-3"
      style={{ background: `${color}12`, border: `1px solid ${color}${urgent ? '70' : '40'}` }}
      animate={urgent ? { borderColor: [`${color}50`, `${color}cc`, `${color}50`] } : {}}
      transition={{ duration: 1.2, repeat: Infinity }}
    >
      {/* 级别标签 */}
      <span
        className="shrink-0 px-1.5 py-0.5 rounded font-bold"
        style={{ fontSize: 10, color, background: `${color}22`, border: `1px solid ${color}50` }}
      >
        {isAlarm ? '故障' : '预警'}
      </span>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
          {alarm.message}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted }}>
          {alarm.lineName}{alarm.stationName ? ` · ${alarm.stationName}` : ''}
        </div>
      </div>

      {/* 计时器 */}
      <div className="shrink-0 text-right">
        <div style={{ fontSize: 9, color: t.textMuted }}>已持续</div>
        <div
          className="font-bold"
          style={{ fontFamily: 'Rajdhani, monospace', fontSize: 18, color, lineHeight: 1 }}
        >
          {formatElapsed(elapsedMs)}
        </div>
      </div>

      {/* 操作按钮 */}
      {onAction && (
        <button
          onClick={onAction}
          className="shrink-0 px-2.5 py-1 rounded"
          style={{ fontSize: 11, color, background: 'transparent', border: `1px solid ${color}50`, cursor: 'pointer' }}
        >
          {isAlarm ? '派工' : '确认'}
        </button>
      )}
    </motion.div>
  )
}
