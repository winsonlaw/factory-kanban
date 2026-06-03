import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as echarts from 'echarts'
import { useKanban } from '../store/kanban'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { OeeGauge } from '../components/OeeGauge'
import { StatusDot } from '../components/StatusDot'
import { AlarmTimer } from '../components/AlarmTimer'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { ViewSwitcher } from '../components/ViewSwitcher'
import { calcPacing } from '../utils/pacing'
import type { LineData, WorkshopData } from '../types'

/* 大屏字号标准：巨型KPI 48-56 / 大数字 26-34 / 标题 16-18 / 标签 13-14 */

// 产线身份色（冷/紫/粉系，避开绿黄红状态语义色）
const LINE_ACCENTS = ['#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#818cf8', '#2dd4bf', '#e879f9', '#38bdf8']

// 产线类型标签（从名称推断）
function lineType(name: string): string {
  if (name.includes('SMT')) return 'SMT'
  if (name.includes('DIP')) return 'DIP'
  if (name.includes('后焊')) return '后焊'
  if (name.includes('总装') || name.includes('组装')) return '总装'
  if (name.includes('测试')) return '测试'
  return '产线'
}

// ─── 产线大卡（车间版：OEE巨字 + Pacing + 产量，竖向大字）──────
function LineCard({ line, rank, accent, workshop, onClick }: {
  line: LineData; rank: number; accent: string; workshop: WorkshopData; onClick: () => void
}) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const p = calcPacing(workshop.shiftStartTs, workshop.shiftDurationH, line.taktSec, line.passCount, line.targetCount, now)
  const oeeColor = line.oee >= 0.85 ? t.good : line.oee >= 0.6 ? t.warn : t.alarm
  const progress = Math.min(1, line.passCount / line.targetCount)
  const progColor = progress >= 1 ? t.good : progress >= 0.8 ? t.primary : t.warn
  const pacingColor = p.onTrack ? t.good : p.behindMin > 15 ? t.alarm : t.warn
  const orderRemain = Math.max(0, line.currentOrder.plannedQty - line.currentOrder.completedQty)
  const orderRemainColor = orderRemain > line.currentOrder.plannedQty * 0.3 ? t.warn : t.primary

  return (
    <motion.div
      className="rounded-xl cursor-pointer flex flex-col h-full relative overflow-hidden justify-between"
      style={{ background: t.bgCard, border: `2px solid ${line.status === 'alarm' ? t.alarm + '70' : accent + '50'}`, backdropFilter: 'blur(12px)' }}
      whileHover={{ scale: 1.005 }}
      onClick={onClick}
      transition={{ duration: 0.12 }}
      animate={line.status === 'alarm' ? { borderColor: [`${t.alarm}50`, `${t.alarm}`, `${t.alarm}50`] } : {}}
    >
      {/* 身份色左条 */}
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 6, background: accent, boxShadow: `0 0 10px ${accent}80` }} />
      {/* 身份色顶部微光 */}
      <div className="absolute left-0 right-0 top-0" style={{ height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />

      {/* 排名（身份色）*/}
      <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold"
        style={{ background: `${accent}25`, fontSize: 14, color: accent, border: `1px solid ${accent}50` }}>{rank}</div>

      {/* 产线名（身份色）+ 类型徽章 + 状态 */}
      <div className="flex items-center gap-2 pl-5 pr-4 pt-3 pb-2 shrink-0">
        <span style={{ width: 11, height: 11, borderRadius: 3, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
        <span className="font-bold" style={{ fontSize: 21, color: accent }}>{line.name}</span>
        <span className="px-1.5 py-0.5 rounded font-bold" style={{ fontSize: 11, color: accent, background: `${accent}1a`, border: `1px solid ${accent}40` }}>
          {lineType(line.name)}
        </span>
        <span className="flex items-center gap-1 ml-1" style={{ fontSize: 14, color: line.status === 'running' ? t.good : line.status === 'alarm' ? t.alarm : t.warn }}>
          <StatusDot status={line.status} showLabel={false} size={9} />
          {line.status === 'running' ? '运行' : line.status === 'alarm' ? '报警' : line.status === 'idle' ? '待机' : '停机'}
        </span>
      </div>

      {/* OEE 巨字（核心）*/}
      <div className="flex items-center justify-center gap-4 px-4 shrink-0">
        <div className="flex flex-col items-center">
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 56, lineHeight: 1, color: oeeColor }}>
            {Math.round(line.oee * 100)}
          </span>
          <span style={{ fontSize: 13, color: oeeColor }}>OEE %</span>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <OeeBar label="可用" value={line.availability} theme={t} />
          <OeeBar label="表现" value={line.performance} theme={t} />
          <OeeBar label="质量" value={line.goodRate} theme={t} />
        </div>
      </div>

      {/* Pacing 大字（欠产/超产 + 落后）*/}
      <div className="mx-3 my-2 rounded-lg flex items-center justify-between px-3 py-2 shrink-0"
        style={{ background: `${pacingColor}14`, border: `1px solid ${pacingColor}40` }}>
        <div className="flex flex-col">
          <span style={{ fontSize: 12, color: t.textMuted }}>{p.delta >= 0 ? '超产' : '欠产'}</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 30, color: pacingColor, lineHeight: 1 }}>
            {p.delta >= 0 ? '+' : ''}{p.delta}
          </span>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 12, color: t.textMuted }}>{p.onTrack ? '领先' : '落后'}</div>
          <div className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color: pacingColor, lineHeight: 1 }}>
            {p.onTrack ? p.aheadMin : p.behindMin}<span style={{ fontSize: 12 }}>分</span>
          </div>
        </div>
      </div>

      {/* 当前工单：型号 + 还缺多少 */}
      <div className="mx-3 flex items-center justify-between shrink-0 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 13, color: t.text }}>📋 {line.currentOrder.model}</span>
        <span style={{ fontSize: 12, color: t.textMuted }}>还缺 <span style={{ color: orderRemainColor, fontFamily: 'Rajdhani, monospace', fontSize: 18, fontWeight: 700 }}>{orderRemain.toLocaleString()}</span> 件</span>
      </div>

      {/* 产量 / 目标 大字 + 进度条 */}
      <div className="px-4 pb-2">
        <div className="flex items-baseline justify-between mb-1">
          <span>
            <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 30, color: t.text }}>
              {line.passCount.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: t.textMuted }}> / {line.targetCount.toLocaleString()} 件</span>
          </span>
          <span className="font-bold" style={{ fontSize: 20, color: progColor, fontFamily: 'Rajdhani, monospace' }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div className="h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div className="h-full rounded-full"
            style={{ background: progColor, boxShadow: `0 0 8px ${progColor}80` }}
            animate={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
      </div>

      {/* 底部：良率 + 节拍 */}
      <div className="grid grid-cols-2 shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className="flex flex-col items-center py-2" style={{ borderRight: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>良率</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color: line.goodRate >= 0.99 ? t.good : t.warn, lineHeight: 1 }}>
            {(line.goodRate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col items-center py-2">
          <span style={{ fontSize: 12, color: t.textMuted }}>需提速</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 22, color: p.onTrack ? t.good : t.warn, lineHeight: 1 }}>
            {p.onTrack ? '—' : `${p.requiredRate}/h`}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function OeeBar({ label, value, theme: t }: { label: string; value: number; theme: ReturnType<typeof useTheme>['current'] }) {
  const color = value >= 0.9 ? t.good : value >= 0.75 ? t.warn : t.alarm
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ fontSize: 11, color: t.textMuted, minWidth: 24 }}>{label}</span>
      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, color, fontFamily: 'Rajdhani, monospace', minWidth: 30, textAlign: 'right' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

// ─── 各产线 OEE 对比柱 ───────────────────────────────────────────
function OeeCompareChart({ lines, theme: t }: { lines: LineData[]; theme: ReturnType<typeof useTheme>['current'] }) {
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
    const colors = lines.map(l => l.oee >= 0.85 ? t.good : l.oee >= 0.6 ? t.warn : t.alarm)
    chart.current.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 8, bottom: 24, left: 36 },
      tooltip: { trigger: 'axis', backgroundColor: '#0d1629', borderColor: `${t.primary}30`, textStyle: { color: t.text, fontSize: 12 } },
      xAxis: { type: 'category', data: lines.map(l => l.name), axisLabel: { color: t.textMuted, fontSize: 12 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: t.textMuted, fontSize: 11, formatter: '{value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
      series: [
        { type: 'bar', data: lines.map((l, i) => ({ value: Math.round(l.oee * 100), itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] } })), barWidth: '46%', label: { show: true, position: 'top', formatter: '{c}', fontSize: 14, color: t.text, fontFamily: 'Rajdhani, monospace' } },
        { type: 'line', data: lines.map(() => 85), symbol: 'none', lineStyle: { color: t.good, width: 1.5, type: 'dashed' } }
      ]
    }, true)
  }, [lines, t])
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
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
export function WorkshopView() {
  const { workshop, setActiveLine } = useKanban()
  const { current: t } = useTheme()
  const now = useNow(1000)
  if (!workshop) return null

  const totalPass = workshop.lines.reduce((s, l) => s + l.passCount, 0)
  const totalTarget = workshop.lines.reduce((s, l) => s + l.targetCount, 0)
  const avgOee = workshop.lines.reduce((s, l) => s + l.oee, 0) / workshop.lines.length
  const avgGoodRate = workshop.lines.reduce((s, l) => s + l.goodRate, 0) / workshop.lines.length
  const alarmCount = workshop.alarms.filter(a => a.level === 'alarm').length
  const warnCount = workshop.alarms.filter(a => a.level === 'warn').length
  const runCount = workshop.lines.filter(l => l.status === 'running').length

  // 车间总 Pacing：各线欠产求和
  const totalDelta = workshop.lines.reduce((s, l) => {
    const p = calcPacing(workshop.shiftStartTs, workshop.shiftDurationH, l.taktSec, l.passCount, l.targetCount, now)
    return s + p.delta
  }, 0)
  const wsPacingColor = totalDelta >= 0 ? t.good : t.alarm

  const ranked = [...workshop.lines].sort((a, b) => b.oee - a.oee)
  const rankMap = Object.fromEntries(ranked.map((l, i) => [l.id, i + 1]))
  const cols = Math.min(workshop.lines.length, 4)
  const rows = Math.ceil(workshop.lines.length / cols)

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* ── 顶栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 56, borderBottom: `1px solid ${t.border}`, background: t.headerBg }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-9 rounded-full" style={{ background: `linear-gradient(to bottom, ${t.primary}, ${t.primary}40)` }} />
          <div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{workshop.factoryName}</div>
            <div className="font-bold" style={{ fontSize: 20, color: t.text }}>{workshop.name}</div>
          </div>
          <div className="ml-1"><ViewSwitcher /></div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {warnCount > 0 && (
            <span style={{ fontSize: 13, padding: '3px 10px', borderRadius: 5, background: `${t.warn}22`, color: t.warn, border: `1px solid ${t.warn}40` }}>▲ {warnCount} 预警</span>
          )}
          {alarmCount > 0 && (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 13, padding: '3px 10px', borderRadius: 5, background: `${t.alarm}22`, color: t.alarm, border: `1px solid ${t.alarm}60` }}>● {alarmCount} 故障</motion.span>
          )}
          <Clock shiftName={workshop.shiftName} />
        </div>
      </div>

      {/* ── 内容区 ──────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* 左栏：车间综合 */}
        <div className="flex flex-col gap-2" style={{ width: 300 }}>
          {/* 综合 KPI */}
          <div className="rounded-xl p-4 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 13, color: t.primary, fontWeight: 700, marginBottom: 8 }}>车间综合指标</div>
            <div className="flex items-center gap-3 mb-3">
              <OeeGauge value={avgOee} size={120} />
              <div className="flex flex-col gap-2 flex-1">
                <KpiRow label="总产量" value={totalPass.toLocaleString()} color={t.text} t={t} />
                <KpiRow label="班次目标" value={totalTarget.toLocaleString()} color={t.textMuted} t={t} />
                <KpiRow label="综合良率" value={`${(avgGoodRate * 100).toFixed(1)}%`} color={avgGoodRate >= 0.99 ? t.good : t.warn} t={t} />
                <KpiRow label="开机产线" value={`${runCount}/${workshop.lines.length}`} color={runCount === workshop.lines.length ? t.good : t.primary} t={t} />
              </div>
            </div>
            {/* 车间总 Pacing 大字 */}
            <div className="rounded-lg flex items-center justify-between px-3 py-2"
              style={{ background: `${wsPacingColor}14`, border: `1px solid ${wsPacingColor}40` }}>
              <span style={{ fontSize: 13, color: t.textMuted }}>全车间{totalDelta >= 0 ? '超产' : '欠产'}</span>
              <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 34, color: wsPacingColor, lineHeight: 1 }}>
                {totalDelta >= 0 ? '+' : ''}{totalDelta}<span style={{ fontSize: 14 }}> 件</span>
              </span>
            </div>
          </div>

          {/* OEE 对比 */}
          <div className="rounded-xl p-3 shrink-0" style={{ height: 180, background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 13, color: t.primary, fontWeight: 700, marginBottom: 4 }}>各产线 OEE 对比</div>
            <div style={{ height: 142 }}><OeeCompareChart lines={workshop.lines} theme={t} /></div>
          </div>

          {/* 报警（带计时器）*/}
          <div className="rounded-xl p-3 flex flex-col flex-1 min-h-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span style={{ fontSize: 13, color: t.primary, fontWeight: 700 }}>实时报警</span>
              {alarmCount > 0 && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: `${t.alarm}22`, color: t.alarm, border: `1px solid ${t.alarm}40` }}>{alarmCount} 故障</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5">
              {workshop.alarms.slice(0, 4).map(a => <AlarmTimer key={a.id} alarm={a} />)}
              {workshop.alarms.length === 0 && (
                <div className="flex items-center justify-center h-full" style={{ color: t.good, fontSize: 14, opacity: 0.6 }}>✓ 暂无报警</div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：产线大卡 */}
        <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {workshop.lines.map((line, i) => (
            <LineCard key={line.id} line={line} rank={rankMap[line.id]} accent={LINE_ACCENTS[i % LINE_ACCENTS.length]} workshop={workshop} onClick={() => setActiveLine(line.id)} />
          ))}
        </div>
      </div>

      {/* ── 底栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 32, borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.3)', fontSize: 13, color: t.textMuted }}>
        <span>
          总产量 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace' }}>{totalPass.toLocaleString()}</span> / 目标 <span style={{ fontFamily: 'Rajdhani, monospace' }}>{totalTarget.toLocaleString()}</span> 件 ·
          完成率 <span style={{ color: totalPass >= totalTarget ? t.good : t.primary }}>{Math.min(100, Math.round(totalPass / totalTarget * 100))}%</span> ·
          开机 <span style={{ color: t.primary }}>{runCount}/{workshop.lines.length}</span> 条
        </span>
        <span>综合良率 <span style={{ color: t.primary, fontFamily: 'Rajdhani, monospace' }}>{(avgGoodRate * 100).toFixed(1)}%</span> · 点击产线卡片进入组长详情</span>
      </div>
    </div>
  )
}

function KpiRow({ label, value, color, t }: { label: string; value: string; color: string; t: ReturnType<typeof useTheme>['current'] }) {
  return (
    <div className="flex items-baseline justify-between">
      <span style={{ fontSize: 12, color: t.textMuted }}>{label}</span>
      <span className="font-bold" style={{ color, fontFamily: 'Rajdhani, monospace', fontSize: 19 }}>{value}</span>
    </div>
  )
}
