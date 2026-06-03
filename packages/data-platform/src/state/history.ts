/**
 * 内存历史存储 —— 每个快照 tick 记录各产线/站位的采样，供历史查询接口。
 * 这是 TDengine 时序落库的「免基础设施」过渡实现：进程内环形缓冲，重启即清空、窗口有限。
 * 接入 TDengine 后由其替换（接口不变）。
 */

import type { WorkshopData } from '../view/types.js'

export interface LineSample {
  ts: number
  oee: number
  availability: number
  performance: number
  goodRate: number
  passCount: number
}

export interface StationSample {
  ts: number
  passCount: number
  failCount: number
  cycletime: number
}

export interface ShiftSummaryRow {
  lineId: string
  lineName: string
  good: number
  fail: number
  goodRate: number
  oee: number
}

const CAP = 500 // 每序列最多保留采样数

export class HistoryStore {
  private lineHist = new Map<string, LineSample[]>()
  private stationHist = new Map<string, StationSample[]>()
  private latest: WorkshopData | null = null
  private lastTs = 0

  /** 每 ~10 秒落一帧（节流，避免过密）。 */
  record(w: WorkshopData, now = Date.now()): void {
    this.latest = w
    if (now - this.lastTs < 10_000) return
    this.lastTs = now
    for (const l of w.lines) {
      push(this.lineHist, l.id, {
        ts: now, oee: l.oee, availability: l.availability, performance: l.performance,
        goodRate: l.goodRate, passCount: l.passCount
      })
      for (const s of l.stations) {
        push(this.stationHist, `${l.id}/${s.id}`, {
          ts: now, passCount: s.passCount, failCount: s.failCount, cycletime: s.cycletime
        })
      }
    }
  }

  /** 某产线 OEE 历史趋势。 */
  lineOee(lineId: string): LineSample[] {
    return this.lineHist.get(lineId) ?? []
  }

  /** 某站位过机历史。 */
  stationHistory(lineId: string, stationId: string): StationSample[] {
    return this.stationHist.get(`${lineId}/${stationId}`) ?? []
  }

  /** 本班各产线汇总（取最新快照）。 */
  shiftSummary(): ShiftSummaryRow[] {
    if (!this.latest) return []
    return this.latest.lines.map((l) => ({
      lineId: l.id, lineName: l.name,
      good: l.passCount, fail: Math.round((l.passCount / Math.max(l.goodRate, 1e-6)) - l.passCount),
      goodRate: l.goodRate, oee: l.oee
    }))
  }
}

function push<T>(map: Map<string, T[]>, key: string, sample: T): void {
  const arr = map.get(key) ?? []
  arr.push(sample)
  if (arr.length > CAP) arr.shift()
  map.set(key, arr)
}
