import { useEffect, useState, type ReactNode } from 'react'
import { PullToRefresh, ProgressBar, ProgressCircle, Tag, DotLoading, ErrorBlock } from 'antd-mobile'
import ReactECharts from 'echarts-for-react'
import { fetchBoardData } from '../api'
import { computePacing, ranking, yuan, pct, LEVEL_COLOR, statusColor } from '../derive'
import type { ExecSummary, WorkshopData } from '../types'

export function Dashboard() {
  const [data, setData] = useState<{ workshop: WorkshopData; exec: ExecSummary } | null>(null)
  const [updatedAt, setUpdatedAt] = useState(0)
  const [error, setError] = useState<string>()

  const load = async () => {
    try {
      setData(await fetchBoardData())
      setUpdatedAt(Date.now())
      setError(undefined)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30000) // 30s 自动刷新
    return () => clearInterval(t)
  }, [])

  if (!data) {
    return (
      <Center>
        {error ? <ErrorBlock status="disconnected" title="连接后端失败" description={error} /> : <DotLoading color="primary" />}
      </Center>
    )
  }

  const { workshop: w, exec } = data
  const pacing = computePacing(w)
  const rank = ranking(w)
  const monthPct = w.monthTarget > 0 ? (w.monthActual / w.monthTarget) * 100 : 0
  const overallGood = w.lines.length ? w.lines.reduce((s, l) => s + l.goodRate, 0) / w.lines.length : 1
  const openLines = w.lines.filter((l) => l.status === 'running').length
  const alarmCount = w.alarms.filter((a) => a.level === 'alarm').length
  const todayPct = Math.round(pacing.ratio * 100)

  return (
    <PullToRefresh onRefresh={load}>
      <div style={{ minHeight: '100vh', paddingBottom: 24 }}>
        {/* 顶栏 */}
        <div style={{ background: 'linear-gradient(135deg,#0b1f3a,#16407a)', color: '#fff', padding: '14px 16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{w.factoryName}</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{w.shiftName} · {new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{w.name} · 经营看板</div>
        </div>

        {/* ① 今日经营达成大灯 */}
        <Block>
          <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <div style={{ fontSize: 13, color: '#888' }}>今日达成（实产 / 应产）</div>
            <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, color: LEVEL_COLOR[pacing.level] }}>
              {todayPct}<span style={{ fontSize: 24 }}>%</span>
            </div>
            <div style={{ fontSize: 15, marginTop: 4 }}>
              产值 <b>{yuan(exec.todayOutputValue)}</b> <span style={{ color: '#aaa' }}>/ {yuan(exec.targetValue)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {pacing.behindQty > 0 ? (
                <Tag color="danger" style={{ fontSize: 13 }}>⏱ 落后 {pacing.behindMin} 分 · 欠产 {pacing.behindQty} 件</Tag>
              ) : (
                <Tag color="success" style={{ fontSize: 13 }}>✓ 进度达标 · 实产 {pacing.actualQty} 件</Tag>
              )}
            </div>
          </div>
        </Block>

        {/* ② 月度达成 + 同比 */}
        <Block title="本月达成">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ProgressCircle percent={Math.min(100, monthPct)} style={{ '--size': '76px', '--track-width': '8px', '--fill-color': LEVEL_COLOR[monthPct >= 100 ? 'green' : monthPct >= 85 ? 'yellow' : 'red'] } as React.CSSProperties}>
              <b style={{ fontSize: 16 }}>{Math.round(monthPct)}%</b>
            </ProgressCircle>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>{w.monthActual.toLocaleString()} / {w.monthTarget.toLocaleString()} 件</div>
              <div style={{ fontSize: 13, color: w.monthYoY >= 0 ? '#00b96b' : '#ff4d4f', marginTop: 4 }}>
                同比 {w.monthYoY >= 0 ? '↑' : '↓'} {Math.abs(w.monthYoY * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Block>

        {/* ③ 产线红黑榜 */}
        <Block title="产线红黑榜">
          {rank.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < rank.length - 1 ? '1px solid #f5f5f5' : undefined }}>
              <span style={{ width: 18, color: i === 0 ? '#faad14' : '#bbb', fontWeight: 700 }}>{i + 1}</span>
              <span style={{ width: 64, fontSize: 14 }}>{r.name}</span>
              <div style={{ flex: 1 }}><ProgressBar percent={Math.min(100, r.attainPct * 100)} style={{ '--fill-color': statusColor(r.status) } as React.CSSProperties} /></div>
              <span style={{ width: 38, textAlign: 'right', fontSize: 13 }}>{pct(r.attainPct)}</span>
              <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: r.delta >= 0 ? '#00b96b' : '#ff4d4f' }}>{r.delta >= 0 ? `超+${r.delta}` : `欠${-r.delta}`}</span>
            </div>
          ))}
        </Block>

        {/* ④ 今日损失（金额化）+ 能耗 */}
        <Block title="今日损失 / 能耗">
          <div style={{ display: 'flex', textAlign: 'center' }}>
            <Stat label="停机损失" value={yuan(exec.downtimeLossAmount)} color="#ff4d4f" />
            <Stat label="质量损失" value={yuan(exec.qualityLossAmount)} color="#faad14" />
            <Stat label="今日能耗" value={`${exec.energyKwhToday} kWh`} color="#1677ff" />
          </div>
          {exec.downtimeTopReasons.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
              停机 Top：{exec.downtimeTopReasons.map((r) => `${r.reason} ${r.hours}h`).join(' · ')}
            </div>
          )}
        </Block>

        {/* ⑤ 订单交付 */}
        <Block title="订单交付">
          {w.orders.length === 0 ? <Empty /> : w.orders.map((o) => (
            <div key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{o.model}</span>
                <span style={{ color: o.risk ? '#ff4d4f' : '#888', fontSize: 12 }}>{o.risk ? '⚠ ' : ''}{o.etaText}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1 }}><ProgressBar percent={(o.done / o.qty) * 100} style={{ '--fill-color': o.risk ? '#ff4d4f' : '#1677ff' } as React.CSSProperties} /></div>
                <span style={{ fontSize: 12, color: '#888' }}>{Math.round((o.done / o.qty) * 100)}% ({o.done}/{o.qty})</span>
              </div>
            </div>
          ))}
        </Block>

        {/* ⑥ 综合 OEE 近7天趋势 */}
        <Block title="综合 OEE · 近7天">
          <ReactECharts option={oeeOption(w.oeeTrend7d)} style={{ height: 150 }} opts={{ renderer: 'svg' }} />
        </Block>

        {/* ⑦ 待关注异常 */}
        <Block title={`待关注 (${w.alarms.length + w.materialAlerts.length})`}>
          {w.alarms.length + w.materialAlerts.length === 0 ? <Empty text="暂无异常" /> : (
            <>
              {w.alarms.slice(0, 4).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ color: a.level === 'alarm' ? '#ff4d4f' : '#faad14' }}>●</span>
                  <span style={{ flex: 1 }}>{a.lineName}{a.stationName ? `/${a.stationName}` : ''}：{a.message}</span>
                  <span style={{ color: '#bbb', fontSize: 12 }}>{Math.round((Date.now() - a.startTs) / 60000)}分</span>
                </div>
              ))}
              {w.materialAlerts.slice(0, 3).map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: '#1677ff' }}>缺料</span>
                  <span style={{ flex: 1 }}>{m.lineName}：{m.material}</span>
                  <span style={{ color: '#faad14', fontSize: 12 }}>剩 {m.remainMin} 分</span>
                </div>
              ))}
            </>
          )}
        </Block>

        {/* ⑧ 底部汇总 */}
        <div style={{ display: 'flex', textAlign: 'center', margin: '4px 12px 0', color: '#555' }}>
          <Stat label="开机" value={`${openLines}/${w.lines.length}`} />
          <Stat label="综合良率" value={pct(overallGood)} />
          <Stat label="活动报警" value={String(alarmCount)} color={alarmCount ? '#ff4d4f' : undefined} />
          <Stat label="安全运行" value={`${w.safeDays}天`} />
        </div>
      </div>
    </PullToRefresh>
  )
}

// ───────────── 小组件 ─────────────

function Block({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, margin: '10px 12px', padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      {title && <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: color ?? '#222' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
}

function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div style={{ color: '#bbb', fontSize: 13, padding: '8px 0' }}>{text}</div>
}

function oeeOption(trend: number[]) {
  const days = trend.map((_, i) => `D${i + 1}`)
  return {
    grid: { left: 36, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#ddd' } }, axisLabel: { color: '#999', fontSize: 10 } },
    yAxis: { type: 'value', min: 0.5, max: 1, axisLabel: { color: '#999', fontSize: 10, formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [
      {
        type: 'line', data: trend, smooth: true, symbolSize: 5,
        lineStyle: { color: '#1677ff', width: 2 }, itemStyle: { color: '#1677ff' },
        areaStyle: { color: 'rgba(22,119,255,0.08)' },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0.85 }], lineStyle: { color: '#faad14', type: 'dashed' }, label: { formatter: '目标85%', color: '#faad14', fontSize: 10 } }
      }
    ]
  }
}
