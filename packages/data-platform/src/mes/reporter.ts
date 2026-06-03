/**
 * MES 报工器 —— 出站：周期把生产进度回传 MES，带重试 + 待发队列（零丢失）。
 * 同时负责入站工单的周期拉取并灌入聚合引擎。
 */

import { config } from '../config.js'
import { SCHEMA_VERSION } from '../contracts/index.js'
import type { MesAdapter, MesEventEnvelope } from '../contracts/index.js'
import type { Aggregator } from '../state/aggregator.js'
import type { WorkshopData } from '../view/types.js'

let seq = 0
function eventId(): string {
  // 简易单调 ID（非随机，便于幂等与排序）
  seq += 1
  return `EVT-${Date.now().toString(36)}-${seq.toString(36)}`
}

const SRC = { factoryId: 'F01', zoneId: 'Z01' }

export class MesReporter {
  private deadLetter: MesEventEnvelope[] = []
  private prevGood = new Map<string, number>()
  private prevFail = new Map<string, number>()
  private sentAlarms = new Set<string>()
  private sentChangeovers = new Set<string>()
  private sentCompleted = new Set<string>()
  private downSince = new Map<string, number>()
  private timers: NodeJS.Timeout[] = []

  constructor(private mes: MesAdapter, private agg: Aggregator) {}

  start(): void {
    void this.pollOrders()
    this.timers.push(setInterval(() => void this.pollOrders(), config.mes.pollIntervalSec * 1000))
    this.timers.push(setInterval(() => void this.reportTick(), config.mes.reportIntervalSec * 1000))
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t)
  }

  /** 入站：拉取工单 → 灌入聚合引擎。 */
  async pollOrders(): Promise<void> {
    try {
      const page = await this.mes.fetchOrders({
        factoryId: 'F01',
        zoneId: 'Z01',
        status: ['released', 'in_progress']
      })
      this.agg.setOrders(page.items)
    } catch (err) {
      console.error('[mes] pollOrders failed:', (err as Error).message)
    }
  }

  /** 出站：周期上报六类生产事件（进度/质量/报警/停机/换型/完工）。 */
  async reportTick(): Promise<void> {
    const now = Date.now()
    const w = this.agg.buildSnapshot(now)
    const interval = config.mes.reportIntervalSec * 1000
    const events: MesEventEnvelope[] = []

    for (const l of w.lines) {
      const fail = Math.max(0, Math.round(l.passCount / Math.max(l.goodRate, 1e-6) - l.passCount))
      const prevG = this.prevGood.get(l.id) ?? 0
      const prevF = this.prevFail.get(l.id) ?? 0
      const dGood = l.passCount - prevG
      const dFail = fail - prevF
      this.prevGood.set(l.id, l.passCount)
      this.prevFail.set(l.id, fail)

      // ① 进度
      if (l.currentOrder.plannedQty > 0 && dGood > 0) {
        events.push(this.env('production.progress', l.id, l.currentOrder.id, {
          goodQty: dGood, failQty: Math.max(0, dFail),
          cumulativeGoodQty: l.passCount, cumulativeFailQty: fail,
          intervalStartTs: now - interval, intervalEndTs: now
        }))
      }
      // ② 质量（含缺陷分布）
      const defects = aggregateDefects(l)
      if (dGood + dFail > 0) {
        events.push(this.env('quality.report', l.id, l.currentOrder.id, {
          goodQty: dGood, failQty: Math.max(0, dFail),
          fpy: l.goodRate, defects,
          intervalStartTs: now - interval, intervalEndTs: now
        }))
      }
      // ③ 停机（状态进入 stopped/alarm → 发起；恢复 → 结束）
      const down = l.status === 'stopped' || l.status === 'alarm'
      if (down && !this.downSince.has(l.id)) {
        this.downSince.set(l.id, now)
        events.push(this.env('equipment.downtime', l.id, l.currentOrder.id, {
          reasonCode: l.status === 'alarm' ? 'ALARM' : 'STOP', startTs: now,
          category: 'unplanned'
        }))
      } else if (!down && this.downSince.has(l.id)) {
        const startTs = this.downSince.get(l.id)!
        this.downSince.delete(l.id)
        events.push(this.env('equipment.downtime', l.id, l.currentOrder.id, {
          reasonCode: 'RECOVER', startTs, endTs: now, durationSec: Math.round((now - startTs) / 1000)
        }))
      }
      // ④ 完工
      if (l.currentOrder.plannedQty > 0 && l.currentOrder.completedQty >= l.currentOrder.plannedQty &&
        !this.sentCompleted.has(l.currentOrder.id)) {
        this.sentCompleted.add(l.currentOrder.id)
        events.push(this.env('production.completed', l.id, l.currentOrder.id, {
          totalGoodQty: l.passCount, totalFailQty: fail, goodRate: l.goodRate,
          actualStartTs: l.currentOrder.startTs, actualEndTs: now
        }))
      }
    }

    // ⑤ 报警（去重）
    for (const a of w.alarms) {
      const key = `${a.id}@${a.startTs}`
      if (this.sentAlarms.has(key)) continue
      this.sentAlarms.add(key)
      events.push(this.env('equipment.alarm', a.lineId, undefined, {
        alarmCode: a.id.split('|').pop() ?? 'ALARM',
        alarmName: a.message, severity: a.level === 'alarm' ? 'alarm' : 'warn', raisedTs: a.startTs
      }))
    }
    // ⑥ 换型（去重）
    for (const c of w.changeovers) {
      const key = `${c.id}@${c.startTs}`
      if (this.sentChangeovers.has(key)) continue
      this.sentChangeovers.add(key)
      events.push(this.env('changeover', c.lineId, undefined, {
        phase: 'start', toModel: c.toModel, startTs: c.startTs, standardSec: c.durationSec
      }))
    }

    if (events.length === 0) return
    const byType = events.reduce<Record<string, number>>((m, e) => {
      m[e.eventType] = (m[e.eventType] ?? 0) + 1
      return m
    }, {})
    console.log('[mes] push', events.length, 'events', byType)
    await this.pushWithRetry(events)
  }

  /** 构造统一信封。data 类型按 eventType 校验（contracts 中的可辨识联合）。 */
  private env(
    eventType: MesEventEnvelope['eventType'],
    lineId: string,
    orderNo: string | undefined,
    data: MesEventEnvelope['data']
  ): MesEventEnvelope {
    return {
      schemaVersion: SCHEMA_VERSION,
      eventId: eventId(),
      eventType,
      occurredTs: Date.now(),
      source: { ...SRC, lineId },
      orderNo,
      data
    }
  }

  private async pushWithRetry(events: MesEventEnvelope[], attempt = 0): Promise<void> {
    try {
      await this.mes.pushBatch([...this.deadLetter, ...events])
      this.deadLetter = [] // 补发成功，清空待发队列
    } catch (err) {
      if (attempt < 4) {
        const backoff = 1000 * 2 ** attempt
        setTimeout(() => void this.pushWithRetry(events, attempt + 1), backoff)
      } else {
        console.error('[mes] reportProgress giving up, queued to dead-letter')
        this.deadLetter.push(...events) // 留待下次补发
      }
    }
  }
}

/** 按缺陷代码聚合一条产线全站的缺陷（支撑 quality.report 的 Pareto）。 */
function aggregateDefects(l: WorkshopData['lines'][number]): { code: string; name?: string; count: number }[] {
  const map = new Map<string, { code: string; name?: string; count: number }>()
  for (const s of l.stations) {
    for (const d of s.defects) {
      const e = map.get(d.code) ?? { code: d.code, name: d.name, count: 0 }
      e.count += d.count
      map.set(d.code, e)
    }
  }
  return [...map.values()]
}
