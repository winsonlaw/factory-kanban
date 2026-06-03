/**
 * MES 报工器 —— 出站：周期把生产进度回传 MES，带重试 + 待发队列（零丢失）。
 * 同时负责入站工单的周期拉取并灌入聚合引擎。
 */

import { config } from '../config.js'
import { SCHEMA_VERSION } from '../contracts/index.js'
import type { MesAdapter, MesEventEnvelope } from '../contracts/index.js'
import type { Aggregator } from '../state/aggregator.js'

let seq = 0
function eventId(): string {
  // 简易单调 ID（非随机，便于幂等与排序）
  seq += 1
  return `EVT-${Date.now().toString(36)}-${seq.toString(36)}`
}

export class MesReporter {
  private deadLetter: MesEventEnvelope[] = []
  private prevGood = new Map<string, number>()
  private timers: NodeJS.Timeout[] = []

  constructor(private mes: MesAdapter, private agg: Aggregator) {}

  start(): void {
    void this.pollOrders()
    this.timers.push(setInterval(() => void this.pollOrders(), config.mes.pollIntervalSec * 1000))
    this.timers.push(setInterval(() => void this.reportProgress(), config.mes.reportIntervalSec * 1000))
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

  /** 出站：周期上报各产线生产进度（增量）。 */
  async reportProgress(): Promise<void> {
    const now = Date.now()
    const events: MesEventEnvelope[] = []
    for (const t of this.agg.lineTotals()) {
      if (!t.orderNo) continue
      const prev = this.prevGood.get(t.lineId) ?? 0
      const delta = t.good - prev
      this.prevGood.set(t.lineId, t.good)
      if (delta <= 0) continue
      events.push({
        schemaVersion: SCHEMA_VERSION,
        eventId: eventId(),
        eventType: 'production.progress',
        occurredTs: now,
        source: { factoryId: 'F01', zoneId: 'Z01', lineId: t.lineId },
        orderNo: t.orderNo,
        data: {
          goodQty: delta,
          failQty: 0,
          cumulativeGoodQty: t.good,
          cumulativeFailQty: t.fail,
          intervalStartTs: now - config.mes.reportIntervalSec * 1000,
          intervalEndTs: now
        }
      })
    }
    if (events.length === 0) return
    await this.pushWithRetry(events)
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
