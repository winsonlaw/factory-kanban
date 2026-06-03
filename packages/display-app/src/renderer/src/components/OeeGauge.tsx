import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import { useTheme } from '../store/theme'

interface Props {
  value: number
  size?: number
}

export function OeeGauge({ value, size = 120 }: Props) {
  const { current: t } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current, null, { renderer: 'svg' })
    return () => chart.current?.dispose()
  }, [])

  useEffect(() => {
    if (!chart.current) return
    const pct = Math.round(value * 100)
    const color = value >= 0.85 ? t.good : value >= 0.6 ? t.warn : t.alarm

    chart.current.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        startAngle: 210, endAngle: -30,
        min: 0, max: 100,
        splitNumber: 0,
        radius: '90%',
        axisLine: {
          lineStyle: {
            width: 10,
            color: [[value, color], [1, 'rgba(255,255,255,0.07)']]
          }
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color,
          fontSize: size * 0.22,
          fontFamily: 'Rajdhani, monospace',
          fontWeight: 700,
          offsetCenter: [0, '10%']
        },
        data: [{ value: pct }]
      }]
    }, true)
  }, [value, t, size])

  return <div ref={ref} style={{ width: size, height: size, flexShrink: 0 }} />
}
