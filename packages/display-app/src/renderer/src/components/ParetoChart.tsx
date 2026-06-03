import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import { useTheme } from '../store/theme'
import type { DefectItem } from '../types'

/**
 * 缺陷 Pareto 图 —— 按缺陷原因排行 + 累计百分比线
 * 告诉组长"改善力气往哪使"（80/20）
 */
export function ParetoChart({ data }: { data: DefectItem[] }) {
  const { current: t } = useTheme()
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
    const total = data.reduce((s, d) => s + d.count, 0) || 1
    let acc = 0
    const cumulative = data.map(d => {
      acc += d.count
      return Math.round((acc / total) * 100)
    })

    chart.current.setOption({
      backgroundColor: 'transparent',
      grid: { top: 16, right: 36, bottom: 24, left: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0d1629',
        borderColor: `${t.alarm}30`,
        textStyle: { color: t.text, fontSize: 11 }
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLabel: { color: t.textMuted, fontSize: 10, interval: 0 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: t.textMuted, fontSize: 9 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
        },
        {
          type: 'value',
          min: 0, max: 100,
          axisLabel: { color: t.textMuted, fontSize: 9, formatter: '{value}%' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          type: 'bar',
          data: data.map(d => d.count),
          itemStyle: { color: `${t.alarm}90`, borderColor: t.alarm, borderWidth: 1, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 26,
          label: { show: true, position: 'top', color: t.text, fontSize: 10, fontFamily: 'Rajdhani, monospace' }
        },
        {
          type: 'line',
          yAxisIndex: 1,
          data: cumulative,
          smooth: false,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: t.warn, width: 1.5 },
          itemStyle: { color: t.warn }
        }
      ]
    }, true)
  }, [data, t])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: t.good, fontSize: 12, opacity: 0.6 }}>
        ✓ 本班无不良
      </div>
    )
  }

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}
