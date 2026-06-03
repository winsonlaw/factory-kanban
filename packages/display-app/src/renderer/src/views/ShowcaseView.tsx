import { motion } from 'framer-motion'
import { useKanban } from '../store/kanban'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { OeeGauge } from '../components/OeeGauge'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { LineData } from '../types'

// ─── 巨型 KPI 卡 ─────────────────────────────────────────────────
function KpiTile({ label, value, unit, color, sub }: {
  label: string; value: string; unit: string; color: string; sub?: string
}) {
  const { current: t } = useTheme()
  return (
    <motion.div
      className="rounded-2xl flex flex-col items-center justify-center flex-1 py-4 relative overflow-hidden"
      style={{ background: t.bgCard, border: `1px solid ${color}40` }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
    >
      <div className="absolute inset-x-0 top-0" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <span style={{ fontSize: 16, color: t.textMuted, letterSpacing: 2 }}>{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 72, lineHeight: 1, color, textShadow: `0 0 24px ${color}70` }}>
          {value}
        </span>
        <span style={{ fontSize: 20, color: t.textMuted }}>{unit}</span>
      </div>
      {sub && <span style={{ fontSize: 14, color: t.textMuted, marginTop: 4 }}>{sub}</span>}
    </motion.div>
  )
}

// ─── 产线俯视通道（站位呼吸灯 + 流动粒子）────────────────────────
function LineChannel({ line, accent }: { line: LineData; accent: string }) {
  const { current: t } = useTheme()
  const running = line.status === 'running'
  const flowColor = line.status === 'alarm' ? t.alarm : line.status === 'idle' ? t.warn : line.status === 'stopped' ? '#4b5563' : accent

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* 身份色 + 产线名 + 在产型号 */}
      <div className="flex flex-col justify-center" style={{ width: 180, flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 24, borderRadius: 4, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span className="font-bold" style={{ fontSize: 16, color: t.text }}>{line.name}</span>
        </div>
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 16 }}>📋 {line.currentOrder.model}</span>
      </div>

      {/* 通道：来料 → 站位呼吸灯 → 成品 */}
      <div className="flex-1 flex items-center gap-1.5 relative" style={{ height: 40 }}>
        <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0 }}>来料</span>
        <div className="flex-1 flex items-center justify-between relative" style={{ height: '100%' }}>
          {/* 底层流动线 */}
          <div className="absolute left-0 right-0" style={{ top: '50%', height: 2, background: `linear-gradient(90deg, ${flowColor}30, ${flowColor}60, ${flowColor}30)` }} />
          {/* 流动粒子 */}
          {running && [0, 1, 2, 3].map(i => (
            <motion.div key={i} className="absolute" style={{ top: 'calc(50% - 3px)', width: 6, height: 6, borderRadius: '50%', background: flowColor, boxShadow: `0 0 8px ${flowColor}` }}
              animate={{ left: ['0%', '100%'] }} transition={{ duration: 2.4, delay: i * 0.6, repeat: Infinity, ease: 'linear' }} />
          ))}
          {/* 站位呼吸灯 */}
          {line.stations.map(s => {
            const c = s.status === 'running' ? accent : s.status === 'alarm' ? t.alarm : s.status === 'idle' ? t.warn : '#4b5563'
            return (
              <motion.div key={s.id} className="relative z-10" style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: `2px solid ${t.bg}`, boxShadow: `0 0 8px ${c}` }}
                animate={s.status === 'running' ? { scale: [1, 1.25, 1], boxShadow: [`0 0 6px ${c}`, `0 0 14px ${c}`, `0 0 6px ${c}`] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }} />
            )
          })}
        </div>
        <span style={{ fontSize: 12, color: t.good, flexShrink: 0 }}>成品</span>
      </div>

      {/* 产量 + OEE */}
      <div className="flex items-center gap-4" style={{ width: 180, flexShrink: 0, justifyContent: 'flex-end' }}>
        <div className="text-right">
          <div style={{ fontSize: 10, color: t.textMuted }}>本班产量</div>
          <div className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color: t.text, lineHeight: 1 }}>{line.passCount.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 10, color: t.textMuted }}>OEE</div>
          <div className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color: line.oee >= 0.85 ? t.good : line.oee >= 0.6 ? t.warn : t.alarm, lineHeight: 1 }}>{Math.round(line.oee * 100)}%</div>
        </div>
      </div>
    </div>
  )
}

const ACCENTS = ['#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#818cf8', '#2dd4bf', '#e879f9', '#38bdf8']

// ─── 主视图 ──────────────────────────────────────────────────────
export function ShowcaseView() {
  const { workshop } = useKanban()
  const { current: t } = useTheme()
  const now = useNow(1000)
  if (!workshop) return null

  const totalPass = workshop.lines.reduce((s, l) => s + l.passCount, 0)
  const avgOee = workshop.lines.reduce((s, l) => s + l.oee, 0) / workshop.lines.length
  const avgGood = workshop.lines.reduce((s, l) => s + l.goodRate, 0) / workshop.lines.length
  const runCount = workshop.lines.filter(l => l.status === 'running').length

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: t.bg }}>
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${t.primary}12, transparent 70%)` }} />

      {/* ── 标题栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 shrink-0 relative" style={{ height: 80, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-4">
          <div className="rounded-xl flex items-center justify-center" style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${t.primary}, ${t.good})`, boxShadow: `0 0 20px ${t.primary}60` }}>
            <span style={{ fontSize: 26 }}>⬡</span>
          </div>
          <div>
            <div className="font-bold" style={{ fontSize: 26, color: t.text, letterSpacing: 1 }}>{workshop.factoryName}</div>
            <div style={{ fontSize: 14, color: t.primary, letterSpacing: 4 }}>智 能 制 造 · 实 时 生 产 中 心</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ViewSwitcher />
          <div className="text-right">
            <div className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 34, color: t.primary, letterSpacing: 2, textShadow: `0 0 16px ${t.primary}50` }}>
              {new Date(now).toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'right' }}>{workshop.name} · {workshop.shiftName}</div>
          </div>
        </div>
      </div>

      {/* ── 四大核心成绩 ─────────────────────────────────────── */}
      <div className="flex gap-3 px-4 pt-3 shrink-0 relative">
        <KpiTile label="今日产量" value={totalPass.toLocaleString()} unit="件" color={t.primary} sub={`${runCount}/${workshop.lines.length} 条产线运行中`} />
        <motion.div className="rounded-2xl flex flex-col items-center justify-center flex-1 py-2 relative overflow-hidden"
          style={{ background: t.bgCard, border: `1px solid ${t.good}40` }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="absolute inset-x-0 top-0" style={{ height: 3, background: `linear-gradient(90deg, transparent, ${t.good}, transparent)` }} />
          <span style={{ fontSize: 16, color: t.textMuted, letterSpacing: 2 }}>综合 OEE</span>
          <OeeGauge value={avgOee} size={110} />
        </motion.div>
        <KpiTile label="良品率" value={(avgGood * 100).toFixed(1)} unit="%" color={t.good} sub="全线综合质量" />
        <KpiTile label="安全运行" value={workshop.safeDays.toLocaleString()} unit="天" color={t.warn} sub="无安全事故" />
      </div>

      {/* ── 产线俯视图 ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 py-3 relative">
        <div className="rounded-2xl h-full flex flex-col p-3 gap-1" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-1 shrink-0">
            <span style={{ fontSize: 15, color: t.primary, fontWeight: 700, letterSpacing: 1 }}>产线实时运行总览</span>
            <span style={{ fontSize: 13, color: t.textMuted }}>● 运行中 站位实时呼吸</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-between">
            {workshop.lines.map((line, i) => (
              <LineChannel key={line.id} line={line} accent={ACCENTS[i % ACCENTS.length]} />
            ))}
          </div>
        </div>
      </div>

      {/* ── 底部滚动统计 ─────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-8 shrink-0 relative" style={{ height: 48, borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize: 15, color: t.textMuted }}>
          本月累计产量 <span className="font-bold" style={{ color: t.text, fontFamily: 'Rajdhani, monospace', fontSize: 19 }}>{workshop.monthActual.toLocaleString()}</span> 件
        </span>
        <span style={{ fontSize: 15, color: t.textMuted }}>
          同比 <span className="font-bold" style={{ color: t.good, fontFamily: 'Rajdhani, monospace', fontSize: 19 }}>↑ {(workshop.monthYoY * 100).toFixed(1)}%</span>
        </span>
        <span style={{ fontSize: 15, color: t.textMuted }}>
          综合良品率 <span className="font-bold" style={{ color: t.primary, fontFamily: 'Rajdhani, monospace', fontSize: 19 }}>{(avgGood * 100).toFixed(1)}%</span>
        </span>
        <span style={{ fontSize: 15, color: t.textMuted }}>
          月度达成 <span className="font-bold" style={{ color: t.good, fontFamily: 'Rajdhani, monospace', fontSize: 19 }}>{(workshop.monthActual / workshop.monthTarget * 100).toFixed(1)}%</span>
        </span>
      </div>
    </div>
  )
}
