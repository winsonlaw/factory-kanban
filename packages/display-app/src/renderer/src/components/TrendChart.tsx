import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import type { TrendPoint } from '../types'

interface Props {
  data: TrendPoint[]
  color?: string
  height?: number
}

export function TrendChart({ data, color = '#00d4ff', height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    chartRef.current = echarts.init(el, null, { renderer: 'svg' })

    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chartRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 8, right: 8, bottom: 20, left: 36 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0d1629',
        borderColor: `${color}30`,
        textStyle: { color: '#e2e8f0', fontSize: 11 }
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.time),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, interval: Math.floor(data.length / 4) }
      },
      yAxis: {
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
        scale: true
      },
      series: [{
        type: 'line',
        data: data.map(d => d.count),
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}40` },
            { offset: 1, color: `${color}00` }
          ])
        }
      }]
    }
    chartRef.current.setOption(option, true)
  }, [data, color])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: height ?? '100%' }}
    />
  )
}
