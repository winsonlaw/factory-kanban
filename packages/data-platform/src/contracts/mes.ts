/**
 * MES 对接契约 —— 数据平台 ↔ MES 的业务消息。
 *
 * 通道（已选定）：REST + Webhook
 *   · 入站（MES → 看板）：拉取工单/订单（数据平台主动 GET），或 MES 主动推送（Webhook）。
 *   · 出站（看板 → MES）：生产实时消息回传（数据平台调用 MES 回调 URL）。
 *
 * 设计要点：
 *   1. 所有出站事件走统一信封 `MesEventEnvelope`，MES 侧一个回调端点即可全收。
 *   2. 幂等：每条事件带 `eventId`，MES 去重；失败按指数退避重试。
 *   3. 对账：提供批量补发/对账接口，避免漏报导致 MES 与现场数据不一致。
 *   4. 解耦：REST 为主，但所有 DTO 与传输无关，可平滑切到 MQ/DB 适配器（见接口文档）。
 */

import type { EpochMs } from './common.js'

// ════════════════════════ 入站：MES → 看板 ════════════════════════
//
// 看板需要从 MES 获取的核心业务数据：工单（订单）、数量、交货时间。
// 这些是 Pacing / 达成率 / 交付预测 / 换型倒计时的源头。

/** MES 工单状态。 */
export type MesOrderStatus = 'released' | 'in_progress' | 'paused' | 'completed' | 'closed'

/**
 * MES 工单（生产订单）。这是入站最核心的对象。
 * 看板用它生成 display-app 的 WorkOrder / OrderProgress，并计算 Takt 与交付预测。
 */
export interface MesWorkOrder {
  orderNo: string // 工单号（业务键）  WO-20260602-001
  mesOrderId: string // MES 内部主键
  salesOrderNo?: string // 关联销售订单号（交付追溯）
  status: MesOrderStatus

  productModel: string // 产品型号  A203-主板
  productCode: string // 物料/产品编码
  plannedQty: number // 计划数量 ← 用户要的「数量」
  completedQty?: number // MES 侧已报完工数（对账用）
  dueTs: EpochMs // 交货时间 ← 用户要的「交货时间」
  releaseTs?: EpochMs // 下达时间
  planStartTs?: EpochMs // 计划开工
  planEndTs?: EpochMs // 计划完工

  priority?: number // 优先级（数字越小越急），驱动看板排序
  targetFactoryId?: string // 指定工厂
  targetZoneId?: string // 指定车间
  targetLineId?: string // 指定产线（空则由排产/调度决定）
  routeId?: string // 工艺路线 ID
  bomId?: string // BOM ID（缺料预警）
  standardCycleSec?: number // 标准节拍（秒），无则看板按 Takt 估算
  standardUph?: number // 标准 UPH
  unitCost?: number // 单件成本（金额化损失）
  remark?: string
}

/** 拉取工单的查询条件（数据平台 GET 时用）。 */
export interface MesOrderQuery {
  factoryId?: string
  zoneId?: string
  lineId?: string
  status?: MesOrderStatus[]
  updatedSince?: EpochMs // 增量拉取：只取该时刻后变更的工单
  page?: number
  pageSize?: number
}

/** 工单分页结果。 */
export interface MesOrderPage {
  total: number
  page: number
  pageSize: number
  items: MesWorkOrder[]
}

/** MES 排产/工单变更通知（Webhook 入站，MES 主动推）。 */
export interface MesOrderChangeNotice {
  noticeId: string // 幂等键
  changeType: 'created' | 'updated' | 'rescheduled' | 'cancelled'
  occurredTs: EpochMs
  order: MesWorkOrder
}

// ════════════════════════ 出站：看板 → MES ════════════════════════
//
// 看板向 MES 推送的实时生产消息。统一信封 + 可辨识联合 payload。

/** 出站事件类型。 */
export type MesEventType =
  | 'production.progress' // 生产进度（周期增量上报）
  | 'production.completed' // 工单完工
  | 'quality.report' // 质量/不良上报
  | 'equipment.downtime' // 停机事件
  | 'equipment.alarm' // 报警事件
  | 'changeover' // 换型开始/结束

/** 出站事件统一信封。MES 侧单端点接收，按 eventType 分发。 */
export interface MesEventEnvelope<T extends MesEventType = MesEventType> {
  schemaVersion: string
  eventId: string // 幂等键（MES 去重）
  eventType: T
  occurredTs: EpochMs // 业务发生时刻
  source: {
    factoryId: string
    zoneId: string
    lineId: string
    stationId?: string
  }
  orderNo?: string // 关联工单（多数事件都带）
  data: MesEventDataMap[T]
}

/** 生产进度上报（周期，如每分钟或每 N 件）。 */
export interface ProductionProgressData {
  goodQty: number // 区间良品增量
  failQty: number // 区间不良增量
  cumulativeGoodQty: number // 工单累计良品
  cumulativeFailQty: number // 工单累计不良
  oee?: number // 0-1
  uph?: number // 当前 UPH
  intervalStartTs: EpochMs // 统计区间起
  intervalEndTs: EpochMs // 统计区间止
}

/** 工单完工。 */
export interface ProductionCompletedData {
  totalGoodQty: number
  totalFailQty: number
  goodRate: number // 0-1
  actualStartTs: EpochMs
  actualEndTs: EpochMs
  avgCycleSec?: number
}

/** 质量上报（含缺陷分布）。 */
export interface QualityReportData {
  goodQty: number
  failQty: number
  fpy?: number // 直通率 0-1
  defects: { code: string; name?: string; count: number }[] // 缺陷 Pareto
  intervalStartTs: EpochMs
  intervalEndTs: EpochMs
}

/** 停机事件。 */
export interface DowntimeData {
  reasonCode: string // 停机原因（停机原因字典）
  reasonName?: string
  startTs: EpochMs
  endTs?: EpochMs // 未恢复为空
  durationSec?: number
  category?: 'unplanned' | 'planned' | 'changeover' // 计划外/计划内/换型
  lossQty?: number // 估算损失产能（件）
  lossAmount?: number // 估算损失金额（元）
}

/** 报警事件。 */
export interface AlarmData {
  alarmCode: string
  alarmName?: string
  severity: 'info' | 'warn' | 'alarm'
  raisedTs: EpochMs
  clearedTs?: EpochMs
  message?: string
}

/** 换型事件。 */
export interface ChangeoverData {
  phase: 'start' | 'end'
  fromModel?: string
  toModel: string
  startTs: EpochMs
  endTs?: EpochMs
  standardSec?: number // SMED 标准时长
  actualSec?: number
}

/** 事件类型 → payload 映射（驱动 MesEventEnvelope 的可辨识联合）。 */
export interface MesEventDataMap {
  'production.progress': ProductionProgressData
  'production.completed': ProductionCompletedData
  'quality.report': QualityReportData
  'equipment.downtime': DowntimeData
  'equipment.alarm': AlarmData
  changeover: ChangeoverData
}

/** MES 回调统一应答（看板 → MES 推送后，MES 的响应体）。 */
export interface MesAck {
  accepted: boolean
  eventId: string
  mesRef?: string // MES 侧落库引用号
  error?: { code: string; message: string }
}

// ════════════════════════ 适配器抽象 ════════════════════════
//
// REST 为默认实现；保留 MQ / DB 中间表适配器，落地时按客户 MES 选配（见接口文档）。

/** MES 适配器统一接口：上层业务只依赖它，不关心底层是 REST / MQ / DB。 */
export interface MesAdapter {
  /** 入站：拉取工单（增量）。 */
  fetchOrders(query: MesOrderQuery): Promise<MesOrderPage>
  /** 出站：推送单条生产事件，返回 MES 应答。 */
  pushEvent(event: MesEventEnvelope): Promise<MesAck>
  /** 出站：批量补发（对账/断点续传）。 */
  pushBatch(events: MesEventEnvelope[]): Promise<MesAck[]>
}
