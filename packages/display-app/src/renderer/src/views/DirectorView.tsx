import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as echarts from 'echarts'
import { useKanban } from '../store/kanban'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { AndonLight } from '../components/AndonLight'
import { ViewSwitcher } from '../components/ViewSwitcher'
import { calcPacing } from '../utils/pacing'
import type { LineData, WorkshopData } from '../types'

const ACCENTS = ['#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#818cf8', '#2dd4bf', '#e879f9', '#38bdf8']

function fmtMoney(n: number): string {
  return '¥' + Math.round(n).toLocaleString()
}

// ─── OEE 7天趋势（带目标线）────────────────────────────────────
function OeeTrendChart({ data, theme: t }: { data: number[]; theme: ReturnType<typeof useTheme>['current'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current, null, { renderer: 'svg' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.current?.dispose() }
  }, [])
  useEffect(() => {
    if (!chart.current) return
    const days = ['一', '二', '三', '四', '五', '六', '日'].slice(0, data.length)
    chart.current.setOption({
      backgroundColor: 'transparent',
      grid: { top: 16, right: 12, bottom: 24, left: 40 },
      tooltip: { trigger: 'axis', backgroundColor: '#0d1629', borderColor: `${t.primary}30`, textStyle: { color: t.text, fontSize: 12 }, formatter: (p: {dataIndex:number}[]) => `周${days[p[0].dataIndex]}<br/>OEE ${Math.round(data[p[0].dataIndex]*100)}%` },
      xAxis: { type: 'category', data: days.map(d => `周${d}`), axisLabel: { color: t.textMuted, fontSize: 12 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 60, max: 100, axisLabel: { color: t.textMuted, fontSize: 11, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
      series: [
        {
          type: 'line', data: data.map(v => Math.round(v * 100)), smooth: true, symbol: 'circle', symbolSize: 7,
          lineStyle: { color: t.primary, width: 3 }, itemStyle: { color: t.primary },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${t.primary}40` }, { offset: 1, color: `${t.primary}00` }]) },
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 85 }], lineStyle: { color: t.good, type: 'dashed', width: 1.5 }, label: { formatter: '目标 85%', color: t.good, fontSize: 11, position: 'insideEndTop' } }
        }
      ]
    }, true)
  }, [data, t])
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ─── 红黑榜行 ────────────────────────────────────────────────────
function RankRow({ line, rank, accent, deltaText, achievement }: {
  line: LineData; rank: number; accent: string; deltaText: string; achievement: number
}) {
  const { current: t } = useTheme()
  const achColor = achievement >= 1 ? t.good : achievement >= 0.9 ? t.primary : achievement >= 0.8 ? t.warn : t.alarm
  const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}`

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${t.border}` }}>
      <span className="font-bold text-center" style={{ width: 28, fontSize: rank <= 3 ? 18 : 15, color: rank <= 3 ? accent : t.textMuted }}>{medal}</span>
      <span style={{ width: 6, height: 28, borderRadius: 3, background: accent, flexShrink: 0 }} />
      <span className="font-bold" style={{ fontSize: 16, color: t.text, minWidth: 92 }}>{line.name}</span>
      <div className="flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(achievement * 100))}%`, background: achColor, boxShadow: `0 0 6px ${achColor}70` }} />
      </div>
      <span className="font-bold text-right" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 20, color: achColor, minWidth: 56 }}>{Math.round(achievement * 100)}%</span>
      <span className="text-right" style={{ fontSize: 13, color: deltaText.includes('欠') ? t.alarm : t.good, minWidth: 72 }}>{deltaText}</span>
    </div>
  )
}

// ─── 时钟 ────────────────────────────────────────────────────────
function Clock({ shiftName }: { shiftName: string }) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  return (
    <div className="text-right">
      <div style={{ fontSize: 12, color: t.textMuted }}>{shiftName}</div>
      <div className="font-bold" style={{ color: t.primary, fontFamily: 'Rajdhani, monospace', fontSize: 26, letterSpacing: 2 }}>
        {new Date(now).toLocaleTimeString('zh-CN', { hour12: false })}
      </div>
    </div>
  )
}

// ─── 主视图 ──────────────────────────────────────────────────────
export function DirectorView() {
  const { workshop } = useKanban()
  const { current: t } = useTheme()
  const now = useNow(1000)
  if (!workshop) return null

  const totalPass = workshop.lines.reduce((s, l) => s + l.passCount, 0)
  const totalTarget = workshop.lines.reduce((s, l) => s + l.targetCount, 0)
  const todayAch = totalPass / totalTarget
  const monthAch = workshop.monthActual / workshop.monthTarget
  const elapsedMin = Math.max(1, (now - workshop.shiftStartTs) / 60000)

  // 各线 Pacing + 停机损失
  const lineStats = workshop.lines.map((l, i) => {
    const p = calcPacing(workshop.shiftStartTs, workshop.shiftDurationH, l.taktSec, l.passCount, l.targetCount, now)
    const downtimeMin = (1 - l.availability) * elapsedMin
    const lostUnits = downtimeMin / (l.taktSec / 60)
    return {
      line: l, accent: ACCENTS[i % ACCENTS.length], pacing: p,
      achievement: l.passCount / l.targetCount,
      downtimeMin, downtimeLoss: lostUnits * workshop.costPerUnit
    }
  })

  const totalDowntimeLoss = lineStats.reduce((s, x) => s + x.downtimeLoss, 0)
  const totalFail = workshop.lines.reduce((s, l) => s + l.stations.reduce((ss, st) => ss + st.failCount, 0), 0)
  const qualityLoss = totalFail * workshop.costPerUnit
  const topDowntime = [...lineStats].sort((a, b) => b.downtimeMin - a.downtimeMin)[0]

  const totalDelta = lineStats.reduce((s, x) => s + x.pacing.delta, 0)
  const ranked = [...lineStats].sort((a, b) => b.achievement - a.achievement)

  const oeeFalling = workshop.oeeTrend7d[workshop.oeeTrend7d.length - 1] < workshop.oeeTrend7d[0]

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* ── 顶栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 56, borderBottom: `1px solid ${t.border}`, background: t.headerBg }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-9 rounded-full" style={{ background: `linear-gradient(to bottom, ${t.primary}, ${t.good})` }} />
          <div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{workshop.factoryName} · {workshop.name}</div>
            <div className="font-bold" style={{ fontSize: 20, color: t.text }}>主任驾驶舱</div>
          </div>
          <div className="ml-1"><ViewSwitcher /></div>
        </div>
        <Clock shiftName={workshop.shiftName} />
      </div>

      {/* ── 内容区 ─────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* 左栏：今日达成 + 月度 + OEE趋势 */}
        <div className="flex flex-col gap-2" style={{ width: 340 }}>
          {/* 今日达成大灯 */}
          <div className="rounded-xl p-4 flex flex-col items-center shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="self-start" style={{ fontSize: 13, color: t.primary, fontWeight: 700, marginBottom: 6 }}>今日计划达成</div>
            <AndonLight value={todayAch} size={148} />
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 28, color: t.text }}>{totalPass.toLocaleString()}</span>
              <span style={{ fontSize: 15, color: t.textMuted }}>/ {totalTarget.toLocaleString()} 件</span>
            </div>
            <div className="flex items-center gap-2 mt-2 rounded-lg px-3 py-1.5" style={{ background: `${totalDelta >= 0 ? t.good : t.alarm}12`, border: `1px solid ${totalDelta >= 0 ? t.good : t.alarm}40` }}>
              <span style={{ fontSize: 13, color: t.textMuted }}>全车间{totalDelta >= 0 ? '超产' : '欠产'}</span>
              <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 24, color: totalDelta >= 0 ? t.good : t.alarm }}>{totalDelta >= 0 ? '+' : ''}{totalDelta}</span>
              <span style={{ fontSize: 13, color: t.textMuted }}>件</span>
            </div>
          </div>

          {/* 月度达成 */}
          <div className="rounded-xl p-4 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: t.primary, fontWeight: 700 }}>本月累计达成</span>
              <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 24, color: monthAch >= 0.95 ? t.good : monthAch >= 0.85 ? t.warn : t.alarm }}>{(monthAch * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, monthAch * 100)}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.good})` }} />
            </div>
            <div className="flex justify-between" style={{ fontSize: 12, color: t.textMuted }}>
              <span>{workshop.monthActual.toLocaleString()} 件</span>
              <span>目标 {workshop.monthTarget.toLocaleString()}</span>
            </div>
          </div>

          {/* OEE 7天趋势 */}
          <div className="rounded-xl p-3 flex flex-col flex-1 min-h-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between mb-1 shrink-0">
              <span style={{ fontSize: 13, color: t.primary, fontWeight: 700 }}>综合 OEE 近7天</span>
              {oeeFalling && <span style={{ fontSize: 12, color: t.warn }}>↘ 注意下滑</span>}
            </div>
            <div className="flex-1 min-h-0"><OeeTrendChart data={workshop.oeeTrend7d} theme={t} /></div>
          </div>
        </div>

        {/* 右侧：红黑榜 + 损失 + 订单 */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* 红黑榜 */}
          <div className="rounded-xl p-3 flex flex-col flex-1 min-h-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 15, color: t.primary, fontWeight: 700, marginBottom: 8 }}>各产线达成红黑榜</div>
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-y-auto">
              {ranked.map((x, i) => (
                <RankRow key={x.line.id} line={x.line} rank={i + 1} accent={x.accent} achievement={x.achievement}
                  deltaText={x.pacing.delta >= 0 ? `超产+${x.pacing.delta}` : `欠产${x.pacing.delta}`} />
              ))}
            </div>
          </div>

          {/* 损失金额化 */}
          <div className="rounded-xl p-3 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 15, color: t.alarm, fontWeight: 700, marginBottom: 8 }}>今日损失（金额化）</div>
            <div className="grid grid-cols-3 gap-2">
              <LossBox label="停机损失" value={fmtMoney(totalDowntimeLoss)} sub={`${Math.round(lineStats.reduce((s,x)=>s+x.downtimeMin,0))} 分钟停机`} color={t.alarm} t={t} />
              <LossBox label="质量损失" value={fmtMoney(qualityLoss)} sub={`${totalFail} 件不良`} color={t.warn} t={t} />
              <LossBox label="停机最多" value={topDowntime?.line.name ?? '—'} sub={`${Math.round(topDowntime?.downtimeMin ?? 0)} 分 · ${fmtMoney(topDowntime?.downtimeLoss ?? 0)}`} color={t.text} t={t} />
            </div>
          </div>

          {/* 订单进度 */}
          <div className="rounded-xl p-3 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 15, color: t.primary, fontWeight: 700, marginBottom: 8 }}>在产订单 / 交付预测</div>
            <div className="flex flex-col gap-2">
              {workshop.orders.map(o => {
                const prog = o.done / o.qty
                const c = o.risk ? t.alarm : prog >= 0.9 ? t.good : t.primary
                return (
                  <div key={o.id} className="flex items-center gap-3">
                    <span className="font-bold" style={{ fontSize: 14, color: t.text, minWidth: 110 }}>{o.model}</span>
                    <div className="flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round(prog * 100)}%`, background: c }} />
                    </div>
                    <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 16, color: c, minWidth: 44, textAlign: 'right' }}>{Math.round(prog * 100)}%</span>
                    <span style={{ fontSize: 12, color: o.risk ? t.alarm : t.textMuted, minWidth: 150 }}>{o.risk ? '⚠ ' : ''}{o.etaText}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 底栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 32, borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.3)', fontSize: 13, color: t.textMuted }}>
        <span>今日达成 <span style={{ color: todayAch >= 0.9 ? t.good : t.warn }}>{(todayAch * 100).toFixed(0)}%</span> · 月度 <span style={{ color: t.primary }}>{(monthAch * 100).toFixed(1)}%</span> · 今日损失合计 <span style={{ color: t.alarm, fontFamily: 'Rajdhani, monospace' }}>{fmtMoney(totalDowntimeLoss + qualityLoss)}</span></span>
        <span>单件产值 {fmtMoney(workshop.costPerUnit)} · 数据每3秒刷新</span>
      </div>
    </div>
  )
}

function LossBox({ label, value, sub, color, t }: { label: string; value: string; sub: string; color: string; t: ReturnType<typeof useTheme>['current'] }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 12, color: t.textMuted }}>{label}</div>
      <div className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 24, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textMuted }}>{sub}</div>
    </div>
  )
}
