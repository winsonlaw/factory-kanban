import type { StationData } from '../types'

/**
 * 产线平衡率 = 各站作业时间总和 / (瓶颈站时间 × 站数)
 * <85% 说明产线不平衡、有等待浪费，组长应调线
 */
export function calcBalanceRate(stations: StationData[]): number {
  if (stations.length === 0) return 1
  const cts = stations.map(s => s.cycletime)
  const sum = cts.reduce((a, b) => a + b, 0)
  const max = Math.max(...cts)
  if (max === 0) return 1
  return sum / (max * stations.length)
}

/** 瓶颈站：节拍最慢（CT 最大）的运行中站位 */
export function findBottleneckId(stations: StationData[]): string | undefined {
  const running = stations.filter(s => s.status === 'running' || s.status === 'alarm')
  const pool = running.length > 0 ? running : stations
  return pool.reduce((max, s) => (s.cycletime > (max?.cycletime ?? 0) ? s : max), pool[0])?.id
}
