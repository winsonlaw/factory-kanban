/**
 * 产线级派生指标 —— 瓶颈站、产线平衡率、滚动直通率 RTY。
 */

export interface StationTiming {
  stationId: string
  cycleMs: number // 实际节拍
  goodRate: number // 0-1（用于 RTY）
}

export interface LineDerived {
  bottleneckStationId: string | null // 瓶颈站（节拍最慢）
  balanceRate: number // 产线平衡率 0-1
  rty: number // 滚动直通率 0-1（各站良率连乘）
}

export function computeLineDerived(stations: StationTiming[]): LineDerived {
  if (stations.length === 0) {
    return { bottleneckStationId: null, balanceRate: 0, rty: 0 }
  }
  let bottleneck = stations[0]!
  let sumCycle = 0
  let rty = 1
  for (const s of stations) {
    sumCycle += s.cycleMs
    rty *= s.goodRate
    if (s.cycleMs > bottleneck.cycleMs) bottleneck = s
  }
  const maxCycle = bottleneck.cycleMs
  const balanceRate = maxCycle > 0 ? sumCycle / (maxCycle * stations.length) : 0
  return {
    bottleneckStationId: bottleneck.stationId,
    balanceRate: Math.min(1, balanceRate),
    rty: Math.max(0, Math.min(1, rty))
  }
}
