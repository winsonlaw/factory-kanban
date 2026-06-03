import type { StationData, DefectItem } from '../types'

/** 聚合一条产线所有站的缺陷，按数量降序（用于缺陷 Pareto） */
export function aggregateDefects(stations: StationData[]): DefectItem[] {
  const map = new Map<string, DefectItem>()
  for (const st of stations) {
    for (const d of st.defects) {
      const cur = map.get(d.code)
      if (cur) cur.count += d.count
      else map.set(d.code, { ...d })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

/** 滚动直通率 RTY = 各站 FPY(以良率近似) 连乘 */
export function calcRTY(stations: StationData[]): number {
  return stations.reduce((acc, s) => acc * s.goodRate, 1)
}
