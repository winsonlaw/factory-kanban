/**
 * MES 适配器 —— 上层只依赖 MesAdapter 接口；底层 REST / mock 可切换。
 * 通道：REST + Webhook（见《对外接口与通道设计》）。
 */

import { config } from '../config.js'
import { SCHEMA_VERSION } from '../contracts/index.js'
import type {
  MesAdapter,
  MesAck,
  MesEventEnvelope,
  MesOrderPage,
  MesOrderQuery,
  MesWorkOrder
} from '../contracts/index.js'

/** REST 实现：调用真实 MES 的 HTTP 接口（用 Node 全局 fetch）。 */
export class RestMesAdapter implements MesAdapter {
  constructor(
    private baseUrl = config.mes.baseUrl,
    private callbackUrl = config.mes.callbackUrl,
    private apiKey = config.mes.apiKey
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    if (this.apiKey) h['authorization'] = `Bearer ${this.apiKey}`
    return h
  }

  async fetchOrders(query: MesOrderQuery): Promise<MesOrderPage> {
    const qs = new URLSearchParams()
    if (query.factoryId) qs.set('factoryId', query.factoryId)
    if (query.zoneId) qs.set('zoneId', query.zoneId)
    if (query.updatedSince) qs.set('updatedSince', String(query.updatedSince))
    if (query.status) qs.set('status', query.status.join(','))
    qs.set('page', String(query.page ?? 1))
    qs.set('pageSize', String(query.pageSize ?? 100))
    const res = await fetch(`${this.baseUrl}/mes/orders?${qs}`, { headers: this.headers() })
    if (!res.ok) throw new Error(`MES fetchOrders ${res.status}`)
    return (await res.json()) as MesOrderPage
  }

  async pushEvent(event: MesEventEnvelope): Promise<MesAck> {
    const res = await fetch(this.callbackUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(event)
    })
    if (!res.ok) throw new Error(`MES pushEvent ${res.status}`)
    return (await res.json()) as MesAck
  }

  async pushBatch(events: MesEventEnvelope[]): Promise<MesAck[]> {
    return Promise.all(events.map((e) => this.pushEvent(e)))
  }
}

/**
 * Mock 实现：内置假 MES，使系统脱离真实 MES 也能跑通工单 → Pacing 全链路。
 * 返回一组贴合 SMT 车间的工单；出站事件仅打日志并 ACK。
 */
export class MockMesAdapter implements MesAdapter {
  private orders: MesWorkOrder[]

  constructor() {
    const now = Date.now()
    const mk = (
      line: string, no: string, model: string, planned: number, dueOffH: number, pri: number
    ): MesWorkOrder => ({
      orderNo: no, mesOrderId: `MES-${no}`, status: 'in_progress',
      productModel: model, productCode: model.split('-')[0] ?? model,
      plannedQty: planned, completedQty: 0,
      dueTs: now + dueOffH * 3_600_000, releaseTs: now - 3_600_000,
      priority: pri, targetFactoryId: 'F01', targetZoneId: 'Z01', targetLineId: line,
      standardCycleSec: 18, unitCost: 28
    })
    this.orders = [
      mk('L01', 'WO-0602-001', 'A203-主板', 12000, 6, 1),
      mk('L02', 'WO-0602-002', 'B107-控制板', 8000, 8, 2),
      mk('L03', 'WO-0602-003', 'C055-电源板', 6000, 4, 1),
      mk('L04', 'WO-0602-004', 'D211-接口板', 5000, 10, 3),
      mk('L05', 'WO-0602-005', 'A203-主板', 10000, 12, 2),
      mk('L06', 'WO-0602-006', 'E330-传感板', 9000, 6, 1)
    ]
  }

  async fetchOrders(_query: MesOrderQuery): Promise<MesOrderPage> {
    return { total: this.orders.length, page: 1, pageSize: 100, items: this.orders }
  }

  async pushEvent(event: MesEventEnvelope): Promise<MesAck> {
    return { accepted: true, eventId: event.eventId, mesRef: `MOCK-${event.eventId.slice(0, 8)}` }
  }

  async pushBatch(events: MesEventEnvelope[]): Promise<MesAck[]> {
    return Promise.all(events.map((e) => this.pushEvent(e)))
  }
}

export function createMesAdapter(): MesAdapter {
  return config.mes.mode === 'rest' ? new RestMesAdapter() : new MockMesAdapter()
}

export { SCHEMA_VERSION }
