import { motion } from 'framer-motion'
import { useKanban } from '../store/kanban'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { StatusDot } from '../components/StatusDot'
import { OeeGauge } from '../components/OeeGauge'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { ParetoChart } from '../components/ParetoChart'
import { calcPacing } from '../utils/pacing'
import { aggregateDefects, calcRTY } from '../utils/quality'
import { calcBalanceRate, findBottleneckId } from '../utils/balance'
import type { StationData, LineData, WorkshopData } from '../types'

/* ─────────────────────────────────────────────────────────────
   大屏字号标准（1080p，3-5米观看）
   巨型KPI 44-56 / 大数字 26-34 / 标题 16-18 / 标签 13-14(底线)
   ───────────────────────────────────────────────────────────── */

function taktState(cycleMs: number, taktSec: number, t: ReturnType<typeof useTheme>['current']) {
  const r = cycleMs / 1000 / taktSec
  if (r > 1.15) return { color: t.alarm, label: `超 ${Math.round((r - 1) * 100)}%`, ok: false }
  if (r > 1) return { color: t.warn, label: `超 ${Math.round((r - 1) * 100)}%`, ok: false }
  return { color: t.good, label: '达标', ok: true }
}

// ─── 流动箭头 ────────────────────────────────────────────────────
function FlowArrow({ running, color }: { running: boolean; color: string }) {
  if (!running) return <div style={{ width: 28, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
  return (
    <div className="relative flex items-center" style={{ width: 28, height: 16, overflow: 'hidden' }}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      </div>
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute"
          style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }}
          animate={{ x: [-12, 16], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1, delay: i * 0.33, repeat: Infinity, ease: 'linear' }} />
      ))}
    </div>
  )
}

// ─── 站位卡（大屏版：大字 + 节拍大灯，无趋势图）──────────────────
function StationCard({ station, taktSec, isBottleneck }: { station: StationData; taktSec: number; isBottleneck: boolean }) {
  const { current: t } = useTheme()
  const tk = taktState(station.cycletime, taktSec, t)
  const consecutiveAlarm = station.consecutiveFail >= 3
  const stopped = station.status === 'stopped'

  return (
    <motion.div
      className="rounded-xl flex flex-col h-full relative overflow-hidden"
      style={{
        background: t.bgCard,
        border: `2px solid ${isBottleneck ? t.alarm : consecutiveAlarm ? t.alarm : t.border}`,
        backdropFilter: 'blur(12px)',
        opacity: stopped ? 0.55 : 1
      }}
      animate={(isBottleneck || consecutiveAlarm) ? { borderColor: [`${t.alarm}50`, `${t.alarm}`, `${t.alarm}50`] } : {}}
      transition={{ duration: 1.6, repeat: Infinity }}
    >
      {isBottleneck && (
        <div className="absolute top-0 right-0 px-2 py-0.5 font-bold"
          style={{ background: t.alarm, color: '#fff', fontSize: 12, borderBottomLeftRadius: 8 }}>瓶颈</div>
      )}

      {/* 站名 + 状态灯 */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="font-bold" style={{ fontSize: 24, color: t.text }}>{station.name}</span>
        <StatusDot status={station.status} showLabel size={11} />
      </div>

      {/* 连续不良大红条 */}
      {consecutiveAlarm && (
        <motion.div className="mx-2 mb-1 rounded flex items-center justify-center gap-1.5 py-1.5 shrink-0"
          animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
          style={{ background: t.alarm, color: '#fff' }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>连续不良 {station.consecutiveFail} · {station.consecutiveDefect}</span>
        </motion.div>
      )}

      {/* 过机数 巨字（核心，弹性居中）*/}
      <div className="flex-1 flex flex-col items-center justify-center px-2">
        <span style={{ fontSize: 16, color: t.textMuted, letterSpacing: 1 }}>本班过机</span>
        <div className="flex items-baseline gap-1">
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 96, lineHeight: 1, color: stopped ? t.textMuted : t.primary }}>
            {station.passCount.toLocaleString()}
          </span>
          <span style={{ fontSize: 20, color: t.textMuted }}>件</span>
        </div>
        <span style={{ fontSize: 15, color: t.textMuted, marginTop: 4 }}>
          今日累计 {station.todayTotal.toLocaleString()}
        </span>
      </div>

      {/* 节拍 大灯 */}
      <div className="mx-2 mb-2 rounded-lg flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ background: `${tk.color}1a`, border: `2px solid ${tk.color}` }}>
        <div className="flex flex-col">
          <span style={{ fontSize: 14, color: t.textMuted }}>节拍 / Takt {taktSec}s</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 40, color: tk.color, lineHeight: 1 }}>
            {(station.cycletime / 1000).toFixed(1)}<span style={{ fontSize: 20 }}>s</span>
          </span>
        </div>
        <span className="font-bold px-3 py-1.5 rounded" style={{ fontSize: 20, color: '#fff', background: tk.color }}>
          {tk.ok ? '✓ 达标' : `⚠ ${tk.label}`}
        </span>
      </div>

      {/* 不良 + 良率 大字一行 */}
      <div className="grid grid-cols-2 shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className="flex flex-col items-center py-2.5" style={{ borderRight: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 14, color: t.textMuted }}>不良</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 36, color: station.failCount > 0 ? t.alarm : t.textMuted, lineHeight: 1 }}>
            {station.failCount}
          </span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span style={{ fontSize: 14, color: t.textMuted }}>良率</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 36, color: station.goodRate >= 0.99 ? t.good : t.warn, lineHeight: 1 }}>
            {(station.goodRate * 100).toFixed(1)}<span style={{ fontSize: 18 }}>%</span>
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── 当前工单横条（组长最关心：这批货还剩多少）──────────────────
function OrderBanner({ line }: { line: LineData }) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const o = line.currentOrder
  const remain = Math.max(0, o.plannedQty - o.completedQty)
  const prog = Math.min(1, o.completedQty / o.plannedQty)
  const remainColor = remain === 0 ? t.good : remain / o.plannedQty > 0.3 ? t.warn : t.primary
  // 动态预计完成 + 超期判断
  const etaTs = now + remain * line.taktSec * 1000
  const overdue = etaTs > o.dueTs
  const diffMin = Math.round(Math.abs(etaTs - o.dueTs) / 60000)
  const etaStr = new Date(etaTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dueStr = new Date(o.dueTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const hist = line.orderHistory ?? []
  const avgHistGood = hist.length ? hist.reduce((s, h) => s + h.goodRate, 0) / hist.length : 0

  return (
    <div className="flex items-center px-5 shrink-0 gap-6" style={{ height: 88, borderBottom: `1px solid ${t.border}`, background: `${t.primary}08` }}>
      {/* 工单号 + 型号 */}
      <div className="flex flex-col" style={{ minWidth: 190 }}>
        <span style={{ fontSize: 12, color: t.textMuted }}>📋 当前工单 {o.id}</span>
        <span className="font-bold" style={{ fontSize: 28, color: t.text }}>{o.model}</span>
      </div>

      {/* 计划 / 完成 + 进度条 */}
      <div className="flex flex-col gap-1.5" style={{ minWidth: 280 }}>
        <div className="flex justify-between" style={{ fontSize: 13, color: t.textMuted }}>
          <span>计划 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace', fontSize: 16 }}>{o.plannedQty.toLocaleString()}</span></span>
          <span>已完成 <span style={{ color: t.primary, fontFamily: 'Rajdhani, monospace', fontSize: 16 }}>{o.completedQty.toLocaleString()}</span></span>
          <span style={{ color: prog >= 1 ? t.good : t.primary, fontWeight: 700 }}>{Math.round(prog * 100)}%</span>
        </div>
        <div className="h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.good})`, boxShadow: `0 0 8px ${t.primary}60` }} />
        </div>
      </div>

      {/* 还缺 巨字（核心）*/}
      <div className="flex items-baseline gap-2 rounded-lg px-4 py-2" style={{ background: `${remainColor}12`, border: `2px solid ${remainColor}50` }}>
        <span style={{ fontSize: 14, color: t.textMuted }}>本单还缺</span>
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 46, color: remainColor, lineHeight: 1 }}>{remain.toLocaleString()}</span>
        <span style={{ fontSize: 14, color: t.textMuted }}>件</span>
      </div>

      {/* 本单良率（质量追溯）*/}
      <div className="flex flex-col items-center">
        <span style={{ fontSize: 12, color: t.textMuted }}>本单良率</span>
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 24, color: line.goodRate >= 0.99 ? t.good : t.warn, lineHeight: 1.2 }}>{(line.goodRate * 100).toFixed(1)}%</span>
      </div>

      {/* 交付预测 + 超期预警 */}
      <div className="flex flex-col">
        <span style={{ fontSize: 12, color: t.textMuted }}>预计 {etaStr} · 交期 {dueStr}</span>
        <span className="font-bold" style={{ fontSize: 17, color: overdue ? t.alarm : t.good }}>
          {overdue ? `⚠ 预计超期 ${diffMin} 分` : `✓ 可提前 ${diffMin} 分交付`}
        </span>
      </div>

      {/* 今日履历 + 下一工单 */}
      <div className="ml-auto flex items-center gap-3">
        {hist.length > 0 && (
          <div className="flex flex-col items-end">
            <span style={{ fontSize: 12, color: t.textMuted }}>今日已完 {hist.length} 单</span>
            <span style={{ fontSize: 14, color: avgHistGood >= 0.99 ? t.good : t.warn }}>均良率 {(avgHistGood * 100).toFixed(1)}%</span>
          </div>
        )}
        {line.nextModel && (
          <div className="flex flex-col items-end rounded-lg px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>下一工单</span>
            <span className="font-bold" style={{ fontSize: 19, color: t.primary }}>→ {line.nextModel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pacing 巨幅横条（组长抬头第一眼）────────────────────────────
function PacingBanner({ line, workshop }: { line: LineData; workshop: WorkshopData }) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const p = calcPacing(workshop.shiftStartTs, workshop.shiftDurationH, line.taktSec, line.passCount, line.targetCount, now)
  const color = p.onTrack ? t.good : p.behindMin > 15 ? t.alarm : t.warn

  return (
    <div className="flex items-center px-5 shrink-0 gap-8"
      style={{ height: 96, borderBottom: `1px solid ${t.border}`, background: `${color}10` }}>
      {/* 状态标签 */}
      <div className="flex flex-col">
        <span style={{ fontSize: 13, color: t.textMuted }}>⏱ 当班进度</span>
        <span className="font-bold px-2.5 py-0.5 rounded mt-1" style={{ fontSize: 15, color: '#fff', background: color }}>
          {p.onTrack ? '在轨' : '落后'}
        </span>
      </div>

      {/* 欠产/超产 巨字 */}
      <div className="flex items-baseline gap-2">
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 64, lineHeight: 1, color }}>
          {p.delta >= 0 ? '+' : ''}{p.delta}
        </span>
        <span style={{ fontSize: 18, color }}>{p.delta >= 0 ? '超产(件)' : '欠产(件)'}</span>
      </div>

      {/* 落后时间 */}
      <div className="flex flex-col">
        <span style={{ fontSize: 14, color: t.textMuted }}>{p.onTrack ? '领先' : '落后'}</span>
        <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 34, color, lineHeight: 1 }}>
          {p.onTrack ? p.aheadMin : p.behindMin}<span style={{ fontSize: 16 }}> 分钟</span>
        </span>
      </div>

      {/* 应产/实产 */}
      <div className="flex flex-col gap-1.5" style={{ fontSize: 18, color: t.textMuted }}>
        <span>应产 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace', fontSize: 24 }}>{p.shouldProduce.toLocaleString()}</span></span>
        <span>实产 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace', fontSize: 24 }}>{p.actual.toLocaleString()}</span> <span style={{ fontSize: 15 }}>/ 目标 {line.targetCount.toLocaleString()}</span></span>
      </div>

      {/* 提速建议（醒目）*/}
      {!p.onTrack && p.requiredRate > 0 && (
        <div className="ml-auto rounded-lg px-4 py-2 flex flex-col items-center"
          style={{ background: `${t.warn}18`, border: `2px solid ${t.warn}` }}>
          <span style={{ fontSize: 13, color: t.textMuted }}>需提速至</span>
          <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: 32, color: t.warn, lineHeight: 1 }}>
            {p.requiredRate}<span style={{ fontSize: 15 }}> 件/h</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ─── 主视图 ──────────────────────────────────────────────────────
export function LineView() {
  const { activeLine, workshop, setActiveLine } = useKanban()
  const { current: t } = useTheme()
  const line = activeLine()
  if (!line || !workshop) return null

  const bottleneckId = findBottleneckId(line.stations)
  const bottleneck = line.stations.find(s => s.id === bottleneckId)
  const oeeColor = line.oee >= 0.85 ? t.good : line.oee >= 0.6 ? t.warn : t.alarm
  const balanceRate = calcBalanceRate(line.stations)
  const rty = calcRTY(line.stations)
  const totalDefects = line.stations.reduce((s, st) => s + st.failCount, 0)
  const defectPareto = aggregateDefects(line.stations)

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* ── 顶栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 56, borderBottom: `1px solid ${t.border}`, background: t.headerBg }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveLine(null)}
            style={{ fontSize: 13, padding: '5px 12px', borderRadius: 5, color: t.textMuted, border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer' }}>
            ← 车间总览
          </button>
          <span className="font-bold" style={{ fontSize: 22, color: t.text }}>{line.name}</span>
          <StatusDot status={line.status} showLabel size={10} />
          <div className="px-2.5 py-1 rounded"
            style={{ background: `${t.primary}15`, color: t.primary, border: `1px solid ${t.primary}30`, fontSize: 12 }}>
            组长视图
          </div>
        </div>
        <div className="flex items-center gap-7">
          <TopMetric label="产线OEE" value={`${(line.oee * 100).toFixed(1)}%`} color={oeeColor} />
          <TopMetric label="良率" value={`${(line.goodRate * 100).toFixed(1)}%`} color={line.goodRate >= 0.99 ? t.good : t.warn} />
          <TopMetric label="瓶颈" value={bottleneck?.name ?? '—'} color={t.warn} small />
          <ThemeSwitcher />
        </div>
      </div>

      {/* ── 当前工单横条 ─────────────────────────────────────── */}
      <OrderBanner line={line} />

      {/* ── Pacing 巨幅横条 ────────────────────────────────────── */}
      <PacingBanner line={line} workshop={workshop} />

      {/* ── 产线流（大字版）──────────────────────────────────── */}
      <div className="px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${t.border}`, overflowX: 'auto', background: `${t.primary}05` }}>
        <div className="flex items-center gap-1 min-w-max">
          <SourceSink label="来料" color={t.primary} />
          {line.stations.map((s, i) => {
            const stColor = s.status === 'alarm' ? t.alarm : s.status === 'stopped' ? '#4b5563' : s.status === 'idle' ? t.warn : t.primary
            const overTakt = s.cycletime / 1000 > line.taktSec
            return (
              <div key={s.id} className="flex items-center gap-1">
                <FlowArrow running={s.status === 'running'} color={stColor} />
                <div className="flex flex-col items-center px-3 py-2 rounded"
                  style={{ minWidth: 104, background: t.bgCard, border: `1px solid ${s.status === 'alarm' ? t.alarm + '60' : s.id === bottleneckId ? t.warn + '80' : t.border}` }}>
                  <span style={{ fontSize: 15, color: t.text }}>{s.name}</span>
                  <span className="font-bold" style={{ color: t.primary, fontFamily: 'Rajdhani, monospace', fontSize: 28 }}>
                    {s.passCount.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 14, color: overTakt ? t.alarm : t.good }}>
                    {(s.cycletime / 1000).toFixed(1)}s{overTakt ? ' ⚠' : ''}
                  </span>
                </div>
                {i < line.stations.length - 1 && <FlowArrow running={s.status === 'running'} color={stColor} />}
              </div>
            )
          })}
          <FlowArrow running color={t.good} />
          <SourceSink label="成品" color={t.good} />
        </div>
      </div>

      {/* ── 主内容区：站位卡（主体）+ 右侧精简 ──────────────── */}
      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* 站位卡（占主体，大字）*/}
        <div className="grid gap-2 flex-1"
          style={{ gridTemplateColumns: `repeat(${line.stations.length}, 1fr)`, gridTemplateRows: '1fr' }}>
          {line.stations.map(s => (
            <StationCard key={s.id} station={s} taktSec={line.taktSec} isBottleneck={s.id === bottleneckId} />
          ))}
        </div>

        {/* 右侧：OEE分解 + 缺陷Pareto（无趋势图）*/}
        <div className="flex flex-col gap-2" style={{ width: 280 }}>
          {/* OEE 分解 */}
          <div className="rounded-xl p-3 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 13, color: t.primary, fontWeight: 700, marginBottom: 8 }}>OEE 分解</div>
            <div className="flex items-center gap-3">
              <OeeGauge value={line.oee} size={104} />
              <div className="flex flex-col gap-2 flex-1">
                <OeeMiniRow label="可用率" value={line.availability} theme={t} />
                <OeeMiniRow label="表现率" value={line.performance} theme={t} />
                <OeeMiniRow label="质量率" value={line.goodRate} theme={t} />
              </div>
            </div>
          </div>

          {/* 关键指标三连 */}
          <div className="grid grid-cols-3 gap-2 shrink-0">
            <BigKv label="平衡率" value={`${Math.round(balanceRate * 100)}%`} color={balanceRate >= 0.85 ? t.good : t.warn} theme={t} />
            <BigKv label="直通率" value={`${(rty * 100).toFixed(1)}%`} color={rty >= 0.97 ? t.good : t.warn} theme={t} />
            <BigKv label="总不良" value={`${totalDefects}`} color={t.alarm} theme={t} />
          </div>

          {/* 缺陷 Pareto（占满剩余）*/}
          <div className="rounded-xl p-3 flex flex-col flex-1 min-h-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between mb-1 shrink-0">
              <span style={{ fontSize: 15, color: t.alarm, fontWeight: 700 }}>缺陷 Pareto（按原因）</span>
            </div>
            <div className="flex-1 min-h-0">
              <ParetoChart data={defectPareto} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 底栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 32, borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.3)', fontSize: 13, color: t.textMuted }}>
        <span>
          {line.name} · 本班 <span style={{ color: t.text, fontFamily: 'Rajdhani, monospace' }}>{line.passCount.toLocaleString()}</span> 件 ·
          不良 <span style={{ color: t.alarm, fontFamily: 'Rajdhani, monospace' }}>{totalDefects}</span> 件 ·
          Takt <span style={{ color: t.primary, fontFamily: 'Rajdhani, monospace' }}>{line.taktSec}s</span>
        </span>
        <span>
          瓶颈 <span style={{ color: t.warn }}>{bottleneck?.name ?? '无'}</span> ·
          平衡率 <span style={{ color: balanceRate >= 0.85 ? t.good : t.warn }}>{Math.round(balanceRate * 100)}%</span> ·
          RTY <span style={{ color: t.primary }}>{(rty * 100).toFixed(1)}%</span>
        </span>
      </div>
    </div>
  )
}

function OeeMiniRow({ label, value, theme: t }: { label: string; value: number; theme: ReturnType<typeof useTheme>['current'] }) {
  const color = value >= 0.9 ? t.good : value >= 0.75 ? t.warn : t.alarm
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 13, color: t.textMuted, minWidth: 42 }}>{label}</span>
      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
      <span style={{ fontSize: 15, color, fontFamily: 'Rajdhani, monospace', minWidth: 40, textAlign: 'right' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

function SourceSink({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded text-center shrink-0"
      style={{ minWidth: 52, background: `${color}15`, border: `1px solid ${color}30` }}>
      <span style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function TopMetric({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="text-right">
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
      <div className="font-bold" style={{ color, fontFamily: small ? 'Inter' : 'Rajdhani, monospace', fontSize: small ? 16 : 26 }}>{value}</div>
    </div>
  )
}

function BigKv({ label, value, color, theme: t }: { label: string; value: string; color: string; theme: ReturnType<typeof useTheme>['current'] }) {
  return (
    <div className="rounded-xl py-2 flex flex-col items-center" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 12, color: t.textMuted }}>{label}</span>
      <span className="font-bold" style={{ fontSize: 22, color, fontFamily: 'Rajdhani, monospace', lineHeight: 1.2 }}>{value}</span>
    </div>
  )
}
