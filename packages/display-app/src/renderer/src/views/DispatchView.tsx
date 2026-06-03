import { motion } from 'framer-motion'
import { useKanban } from '../store/kanban'
import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { AlarmTimer } from '../components/AlarmTimer'
import { ViewSwitcher } from '../components/ViewSwitcher'
import { CountdownChip, RemainMinChip } from '../components/CountdownChip'
import { StatusDot } from '../components/StatusDot'
import { calcPacing, formatElapsed } from '../utils/pacing'
import type { LineData, WorkshopData } from '../types'

// ─── 各产线状态墙卡 ──────────────────────────────────────────────
function StatusWallCard({ line, workshop, accent, now, onClick }: {
  line: LineData; workshop: WorkshopData; accent: string; now: number; onClick: () => void
}) {
  const { current: t } = useTheme()
  const statusColor = line.status === 'running' ? t.good : line.status === 'alarm' ? t.alarm : line.status === 'idle' ? t.warn : '#4b5563'

  // 节拍达成判断
  let lamp: { color: string; text: string }
  if (line.status === 'stopped') lamp = { color: '#4b5563', text: '停机' }
  else if (line.status === 'idle') lamp = { color: t.warn, text: '待机/换型' }
  else {
    const p = calcPacing(workshop.shiftStartTs, workshop.shiftDurationH, line.taktSec, line.passCount, line.targetCount, now)
    lamp = p.onTrack ? { color: t.good, text: '可达标' } : { color: t.alarm, text: `缺口 ${-p.delta}` }
  }

  return (
    <motion.div
      className="rounded-lg cursor-pointer flex flex-col px-3 py-2 relative overflow-hidden"
      style={{ background: t.bgCard, border: `2px solid ${line.status === 'alarm' ? t.alarm : statusColor + '40'}` }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      animate={line.status === 'alarm' ? { borderColor: [`${t.alarm}50`, `${t.alarm}`, `${t.alarm}50`] } : {}}
      transition={{ duration: 1.4, repeat: Infinity }}
    >
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: accent }} />
      <div className="flex items-center gap-1.5 pl-1.5">
        <StatusDot status={line.status} showLabel={false} size={9} />
        <span className="font-bold" style={{ fontSize: 16, color: t.text }}>{line.name}</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>· {line.currentOrder.model}</span>
      </div>
      <div className="flex items-center justify-between pl-1.5 mt-1">
        <span style={{ fontSize: 14, color: statusColor, fontWeight: 600 }}>
          {line.status === 'running' ? '运行' : line.status === 'alarm' ? '报警' : line.status === 'idle' ? '待机' : '停机'}
        </span>
        <span className="px-2 py-0.5 rounded font-bold" style={{ fontSize: 13, color: '#fff', background: lamp.color }}>
          {lamp.text}
        </span>
      </div>
    </motion.div>
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

const ACCENTS = ['#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#818cf8', '#2dd4bf', '#e879f9', '#38bdf8']

// ─── 主视图 ──────────────────────────────────────────────────────
export function DispatchView() {
  const { workshop, setActiveLine } = useKanban()
  const { current: t } = useTheme()
  const now = useNow(1000)
  if (!workshop) return null

  const alarmCount = workshop.alarms.filter(a => a.level === 'alarm').length
  const warnCount = workshop.alarms.filter(a => a.level === 'warn').length

  // 异常流：故障优先，同级按发生时间升序（持续越久越靠上）
  const sortedAlarms = [...workshop.alarms].sort((a, b) => {
    if (a.level !== b.level) return a.level === 'alarm' ? -1 : 1
    return a.startTs - b.startTs
  })
  // 最久未处理
  const longest = sortedAlarms[0] ? now - Math.min(...workshop.alarms.map(a => a.startTs)) : 0
  const accentMap = Object.fromEntries(workshop.lines.map((l, i) => [l.id, ACCENTS[i % ACCENTS.length]]))

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* ── 顶栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 56, borderBottom: `1px solid ${t.border}`, background: t.headerBg }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-9 rounded-full" style={{ background: `linear-gradient(to bottom, ${t.alarm}, ${t.warn})` }} />
          <div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{workshop.factoryName} · {workshop.name}</div>
            <div className="font-bold" style={{ fontSize: 20, color: t.text }}>调度中心</div>
          </div>
          <div className="ml-1"><ViewSwitcher /></div>
        </div>
        <div className="flex items-center gap-3">
          {warnCount > 0 && (
            <span style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6, background: `${t.warn}22`, color: t.warn, border: `1px solid ${t.warn}40` }}>▲ {warnCount} 预警</span>
          )}
          {alarmCount > 0 && (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6, background: `${t.alarm}22`, color: t.alarm, border: `1px solid ${t.alarm}60` }}>● {alarmCount} 故障</motion.span>
          )}
          <Clock shiftName={workshop.shiftName} />
        </div>
      </div>

      {/* ── 内容区 ─────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* 左：实时异常流（救火核心）*/}
        <div className="flex flex-col rounded-xl p-3 min-h-0" style={{ width: 760, background: t.bgCard, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span style={{ fontSize: 16, color: t.alarm, fontWeight: 700 }}>🚨 实时异常流</span>
            <span style={{ fontSize: 13, color: t.textMuted }}>按紧急度·持续时长排序</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
            {sortedAlarms.length === 0 && (
              <div className="flex items-center justify-center h-full" style={{ color: t.good, fontSize: 18, opacity: 0.6 }}>✓ 当前无异常</div>
            )}
            {sortedAlarms.map(a => (
              <AlarmTimer key={a.id} alarm={a} onAction={() => setActiveLine(a.lineId)} />
            ))}
          </div>
        </div>

        {/* 右：状态墙 + 缺料 + 换型 */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* 各产线状态墙 */}
          <div className="rounded-xl p-3 flex flex-col flex-1 min-h-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 15, color: t.primary, fontWeight: 700, marginBottom: 8 }}>各产线状态墙</div>
            <div className="grid gap-2 flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' }}>
              {workshop.lines.map(line => (
                <StatusWallCard key={line.id} line={line} workshop={workshop} accent={accentMap[line.id]} now={now} onClick={() => setActiveLine(line.id)} />
              ))}
            </div>
          </div>

          {/* 缺料预警 */}
          <div className="rounded-xl p-3 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 15, color: t.warn, fontWeight: 700 }}>⚠ 缺料预警</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>剩余可支撑</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {workshop.materialAlerts.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded px-3 py-2"
                  style={{ background: m.remainMin < 20 ? `${t.alarm}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${m.remainMin < 20 ? t.alarm + '40' : t.border}` }}>
                  <div className="flex flex-col">
                    <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>{m.material}</span>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{m.lineName}{m.station ? ` · ${m.station}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RemainMinChip remainMin={m.remainMin} />
                    <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 5, color: t.warn, background: 'transparent', border: `1px solid ${t.warn}50`, cursor: 'pointer' }}>催料</button>
                  </div>
                </div>
              ))}
              {workshop.materialAlerts.length === 0 && <div className="text-center py-2" style={{ fontSize: 13, color: t.good, opacity: 0.6 }}>✓ 物料齐套</div>}
            </div>
          </div>

          {/* 换型倒计时 */}
          <div className="rounded-xl p-3 shrink-0" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 15, color: t.primary, fontWeight: 700, marginBottom: 8 }}>🔄 换型倒计时</div>
            <div className="flex flex-col gap-1.5">
              {workshop.changeovers.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}` }}>
                  <div className="flex flex-col">
                    <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>{c.lineName} → {c.toModel}</span>
                    <span style={{ fontSize: 12, color: t.textMuted }}>计划换型 {Math.round(c.durationSec / 60)} 分钟</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div style={{ fontSize: 10, color: t.textMuted }}>剩余</div>
                      <CountdownChip startTs={c.startTs} durationSec={c.durationSec} />
                    </div>
                    <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 5, color: t.primary, background: 'transparent', border: `1px solid ${t.primary}50`, cursor: 'pointer' }}>跟进</button>
                  </div>
                </div>
              ))}
              {workshop.changeovers.length === 0 && <div className="text-center py-2" style={{ fontSize: 13, color: t.textMuted, opacity: 0.6 }}>无换型任务</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── 底栏 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 32, borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.3)', fontSize: 13, color: t.textMuted }}>
        <span>
          活动异常 <span style={{ color: t.alarm, fontFamily: 'Rajdhani, monospace' }}>{workshop.alarms.length}</span> 起 ·
          缺料 <span style={{ color: t.warn, fontFamily: 'Rajdhani, monospace' }}>{workshop.materialAlerts.length}</span> 项 ·
          换型 <span style={{ color: t.primary, fontFamily: 'Rajdhani, monospace' }}>{workshop.changeovers.length}</span> 条
        </span>
        <span>最久未处理 <span style={{ color: t.alarm, fontFamily: 'Rajdhani, monospace' }}>{formatElapsed(longest)}</span> · 点击异常/产线进入详情</span>
      </div>
    </div>
  )
}
