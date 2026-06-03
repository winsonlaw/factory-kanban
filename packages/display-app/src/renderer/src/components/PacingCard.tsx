import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { calcPacing } from '../utils/pacing'

interface Props {
  shiftStartTs: number
  shiftDurationH: number
  taktSec: number
  actual: number
  targetCount: number
  variant?: 'full' | 'inline'
  label?: string
}

/**
 * Pacing 卡片 —— 回答"我们落后了吗"
 * full: 独立卡片（车间/产线主区）  inline: 顶栏一行
 */
export function PacingCard({
  shiftStartTs, shiftDurationH, taktSec, actual, targetCount, variant = 'full', label = '当班进度'
}: Props) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const p = calcPacing(shiftStartTs, shiftDurationH, taktSec, actual, targetCount, now)

  const color = p.onTrack ? t.good : p.behindMin > 15 ? t.alarm : t.warn
  const deltaText = p.delta >= 0 ? `超产 +${p.delta}` : `欠产 ${p.delta}`
  const timeText = p.onTrack
    ? (p.aheadMin > 0 ? `领先 ${p.aheadMin} 分钟` : '准时')
    : `落后 ${p.behindMin} 分钟`

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span style={{ fontSize: 10, color: t.textMuted }}>{deltaText.includes('欠') ? '欠产' : '超产'}</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color }}>
            {p.delta >= 0 ? '+' : ''}{p.delta}
          </span>
          <span style={{ fontSize: 10, color: t.textMuted }}>件</span>
        </div>
        <span style={{ fontSize: 12, color }}>{timeText}</span>
        {!p.onTrack && p.requiredRate > 0 && (
          <span style={{ fontSize: 11, color: t.warn }}>需提速至 {p.requiredRate}/h</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: p.onTrack ? `${t.good}0c` : `${color}10`,
        border: `1px solid ${color}50`
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
        <span
          className="px-2 py-0.5 rounded"
          style={{ fontSize: 10, color, background: `${color}20`, border: `1px solid ${color}40` }}
        >
          {p.onTrack ? '在轨' : '落后'}
        </span>
      </div>

      {/* 欠产/超产 大数字 */}
      <div className="flex items-baseline gap-2">
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 44, lineHeight: 1, color }}>
          {p.delta >= 0 ? '+' : ''}{p.delta}
        </span>
        <div className="flex flex-col">
          <span style={{ fontSize: 12, color }}>{deltaText.includes('欠') ? '欠产(件)' : '超产(件)'}</span>
          <span style={{ fontSize: 13, color, fontWeight: 600 }}>⏱ {timeText}</span>
        </div>
      </div>

      {/* 应产 vs 实产 */}
      <div className="flex items-center justify-between" style={{ fontSize: 12, color: t.textMuted }}>
        <span>应产 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace' }}>{p.shouldProduce.toLocaleString()}</span></span>
        <span>实产 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace' }}>{p.actual.toLocaleString()}</span></span>
        <span>目标 <span style={{ fontFamily: 'Rajdhani, monospace' }}>{targetCount.toLocaleString()}</span></span>
      </div>

      {/* 提速建议 */}
      {!p.onTrack && p.requiredRate > 0 && (
        <div
          className="rounded px-2 py-1.5 flex items-center justify-between"
          style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}30` }}
        >
          <span style={{ fontSize: 11, color: t.textMuted }}>需提速至</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 18, color: t.warn }}>
            {p.requiredRate} <span style={{ fontSize: 11 }}>件/h</span>
          </span>
        </div>
      )}
    </div>
  )
}
