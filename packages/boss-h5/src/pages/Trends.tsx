import { useEffect, useState, type ReactNode } from 'react'
import { PullToRefresh, Segmented, DotLoading, ErrorBlock } from 'antd-mobile'
import ReactECharts from 'echarts-for-react'
import { fetchHistory } from '../api'
import { yuan } from '../derive'
import type { DailyRow, WorkshopSample } from '../types'

export function Trends() {
  const [days, setDays] = useState(7)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [intraday, setIntraday] = useState<WorkshopSample[]>([])
  const [error, setError] = useState<string>()
  const [loaded, setLoaded] = useState(false)

  const load = async (d = days) => {
    try {
      const r = await fetchHistory(d)
      setDaily(r.daily)
      setIntraday(r.intraday)
      setError(undefined)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void load(days)
    const t = setInterval(() => void load(days), 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  if (!loaded) {
    return <Center>{error ? <ErrorBlock status="disconnected" title="连接失败" description={error} /> : <DotLoading color="primary" />}</Center>
  }

  const labels = daily.map((d) => d.date.slice(5)) // MM-DD
  const lastClosed = daily.filter((d) => !d.partial)
  const avgAttain = lastClosed.length ? lastClosed.reduce((s, d) => s + d.attainment, 0) / lastClosed.length : 0
  const avgOee = lastClosed.length ? lastClosed.reduce((s, d) => s + d.oee, 0) / lastClosed.length : 0
  const totalLoss = daily.reduce((s, d) => s + d.downtimeLossAmount + d.qualityLossAmount, 0)

  return (
    <PullToRefresh onRefresh={() => load(days)}>
      <div style={{ minHeight: '100vh', paddingBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg,#0b1f3a,#16407a)', color: '#fff', padding: '14px 16px' }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>经营趋势</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>历史日报 · 跨天对比</div>
        </div>

        <div style={{ padding: '12px 12px 0' }}>
          <Segmented
            block
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={[{ label: '近7天', value: '7' }, { label: '近30天', value: '30' }]}
          />
        </div>

        {/* 区间概览 */}
        <Block>
          <div style={{ display: 'flex', textAlign: 'center' }}>
            <Stat label="均达成率" value={`${Math.round(avgAttain * 100)}%`} />
            <Stat label="均OEE" value={`${Math.round(avgOee * 100)}%`} />
            <Stat label="累计损失" value={yuan(totalLoss)} color="#ff4d4f" />
          </div>
        </Block>

        {/* 产量 vs 目标 */}
        <Block title="日产量 vs 目标">
          <ReactECharts option={outputOption(daily, labels)} style={{ height: 180 }} opts={{ renderer: 'svg' }} />
        </Block>

        {/* 达成率 + OEE 趋势 */}
        <Block title="达成率 / OEE 趋势">
          <ReactECharts option={rateOption(daily, labels)} style={{ height: 180 }} opts={{ renderer: 'svg' }} />
        </Block>

        {/* 损失趋势（停机+质量，堆叠） */}
        <Block title="损失趋势（金额）">
          <ReactECharts option={lossOption(daily, labels)} style={{ height: 170 }} opts={{ renderer: 'svg' }} />
        </Block>

        {/* 本班实时产量曲线 */}
        <Block title="本班实时产量">
          {intraday.length < 2 ? (
            <div style={{ color: '#bbb', fontSize: 13, padding: '8px 0' }}>采集中…（运行一会儿后出现曲线）</div>
          ) : (
            <ReactECharts option={intradayOption(intraday)} style={{ height: 150 }} opts={{ renderer: 'svg' }} />
          )}
        </Block>
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
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? '#222' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{label}</div>
    </div>
  )
}
function Center({ children }: { children: ReactNode }) {
  return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
}

// ───────────── 图表 option ─────────────

const AXIS_LABEL = { color: '#999', fontSize: 10 }
const baseGrid = { left: 40, right: 12, top: 24, bottom: 22 }

function outputOption(daily: DailyRow[], labels: string[]) {
  return {
    grid: baseGrid,
    legend: { right: 0, top: 0, textStyle: { fontSize: 10 }, itemHeight: 8, itemWidth: 12 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLabel: AXIS_LABEL, axisLine: { lineStyle: { color: '#ddd' } } },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [
      { name: '产量', type: 'bar', data: daily.map((d) => d.outputQty), itemStyle: { color: '#1677ff', borderRadius: [3, 3, 0, 0] }, barWidth: '55%' },
      { name: '目标', type: 'line', data: daily.map((d) => d.targetQty), symbol: 'none', lineStyle: { color: '#faad14', type: 'dashed', width: 1.5 } }
    ]
  }
}

function rateOption(daily: DailyRow[], labels: string[]) {
  return {
    grid: baseGrid,
    legend: { right: 0, top: 0, textStyle: { fontSize: 10 }, itemHeight: 8, itemWidth: 12 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Math.round(v * 100)}%` },
    xAxis: { type: 'category', data: labels, axisLabel: AXIS_LABEL, axisLine: { lineStyle: { color: '#ddd' } } },
    yAxis: { type: 'value', min: 0.5, max: 1, axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [
      { name: '达成率', type: 'line', smooth: true, data: daily.map((d) => d.attainment), itemStyle: { color: '#00b96b' }, lineStyle: { color: '#00b96b' } },
      { name: 'OEE', type: 'line', smooth: true, data: daily.map((d) => d.oee), itemStyle: { color: '#1677ff' }, lineStyle: { color: '#1677ff' },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0.85 }], lineStyle: { color: '#faad14', type: 'dashed' }, label: { formatter: '85%', fontSize: 9, color: '#faad14' } } }
    ]
  }
}

function lossOption(daily: DailyRow[], labels: string[]) {
  return {
    grid: baseGrid,
    legend: { right: 0, top: 0, textStyle: { fontSize: 10 }, itemHeight: 8, itemWidth: 12 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `¥${v}` },
    xAxis: { type: 'category', data: labels, axisLabel: AXIS_LABEL, axisLine: { lineStyle: { color: '#ddd' } } },
    yAxis: { type: 'value', axisLabel: { ...AXIS_LABEL, formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v) }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [
      { name: '停机损失', type: 'bar', stack: 'loss', data: daily.map((d) => d.downtimeLossAmount), itemStyle: { color: '#ff4d4f' }, barWidth: '55%' },
      { name: '质量损失', type: 'bar', stack: 'loss', data: daily.map((d) => d.qualityLossAmount), itemStyle: { color: '#faad14' } }
    ]
  }
}

function intradayOption(series: { ts: number; outputQty: number }[]) {
  return {
    grid: { left: 44, right: 12, top: 16, bottom: 22 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: series.map((s) => new Date(s.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })), axisLabel: { ...AXIS_LABEL, interval: Math.max(0, Math.floor(series.length / 6)) }, axisLine: { lineStyle: { color: '#ddd' } } },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [{ type: 'line', data: series.map((s) => s.outputQty), smooth: true, symbol: 'none', areaStyle: { color: 'rgba(22,119,255,0.1)' }, lineStyle: { color: '#1677ff', width: 2 } }]
  }
}
