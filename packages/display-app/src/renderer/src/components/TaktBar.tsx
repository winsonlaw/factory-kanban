import { useTheme } from '../store/theme'

/**
 * 节拍 vs Takt 对比条 —— 组长该看的核心
 * CT ≤ Takt 才能满足订单；超 Takt 标红（拖累整线交付）
 */
export function TaktBar({ cycleMs, taktSec }: { cycleMs: number; taktSec: number }) {
  const { current: t } = useTheme()
  const ctSec = cycleMs / 1000
  const ratio = ctSec / taktSec          // >1 = 超Takt
  const pct = Math.round(ratio * 100)
  const overTakt = ratio > 1

  const color = ratio > 1.15 ? t.alarm : ratio > 1 ? t.warn : t.good

  return (
    <div>
      <div className="flex justify-between mb-1" style={{ fontSize: 9, color: t.textMuted }}>
        <span>节拍 {ctSec.toFixed(1)}s / Takt {taktSec}s</span>
        <span style={{ color, fontWeight: 700 }}>
          {overTakt ? `超 ${pct - 100}%` : `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Takt 基准线(100%) */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: `${Math.min(100, 100 / Math.max(ratio, 1) * 1)}%`, width: 1, background: 'rgba(255,255,255,0.3)', zIndex: 2 }}
        />
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: color,
            boxShadow: `0 0 4px ${color}80`
          }}
        />
      </div>
    </div>
  )
}
