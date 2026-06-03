/**
 * 运行时校验 schema（zod）—— 在系统边界处校验入站消息。
 *
 * 这是「线协议」的运行时事实源：边缘网关上报的遥测/事件、MES 推送的 Webhook，
 * 都在进入系统前用这里的 schema 校验，不合规直接拒绝（SCHEMA_MISMATCH）。
 * 类型与 device.ts / mes.ts 保持一致（z.infer 可反推，亦可与 TS interface 交叉验证）。
 */

import { z } from 'zod'

// ───────────── 公共 ─────────────

export const defectRecordSchema = z.object({
  code: z.string(),
  name: z.string().optional(),
  count: z.number().optional(),
  refDes: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional()
})

export const alarmRecordSchema = z.object({
  code: z.string(),
  name: z.string().optional(),
  severity: z.enum(['info', 'warn', 'alarm']),
  raisedTs: z.number(),
  clearedTs: z.number().optional(),
  message: z.string().optional()
})

const envelope = {
  schemaVersion: z.string(),
  messageId: z.string(),
  timestamp: z.number()
}

const assetRef = {
  factoryId: z.string(),
  zoneId: z.string(),
  lineId: z.string(),
  stationId: z.string(),
  deviceId: z.string()
}

// ───────────── 设备遥测 ─────────────

export const deviceTypeSchema = z.enum([
  'solder_printer',
  'smt_mounter',
  'reflow_oven',
  'aoi',
  'spi',
  'dip_inserter',
  'wave_solder',
  'ict_fct',
  'laser_marker',
  'generic'
])

/** 遥测校验：公共字段严格，metrics 宽松（各设备类型差异大，按需在业务层细化）。 */
export const deviceTelemetrySchema = z.object({
  ...envelope,
  ...assetRef,
  deviceType: deviceTypeSchema,
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  cycleTimeMs: z.number().nonnegative(),
  equipmentStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  defects: z.array(defectRecordSchema).optional(),
  alarm: alarmRecordSchema.nullable().optional(),
  wipBuffer: z.number().optional(),
  orderNo: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  metrics: z.record(z.unknown()).optional()
})

export const deviceEventSchema = z.object({
  ...envelope,
  ...assetRef,
  deviceType: deviceTypeSchema,
  eventType: z.enum([
    'status_change',
    'alarm_raised',
    'alarm_cleared',
    'changeover_start',
    'changeover_end',
    'order_start',
    'order_end'
  ]),
  prevStatus: z.number().optional(),
  nextStatus: z.number().optional(),
  alarm: alarmRecordSchema.optional(),
  orderNo: z.string().optional(),
  toModel: z.string().optional(),
  payload: z.record(z.unknown()).optional()
})

export const gatewayHeartbeatSchema = z.object({
  ...envelope,
  factoryId: z.string(),
  zoneId: z.string(),
  gatewayId: z.string(),
  online: z.boolean(),
  bufferedCount: z.number(),
  connectedDevices: z.number(),
  firmwareVersion: z.string().optional()
})

// ───────────── MES Webhook 入站 ─────────────

export const mesWorkOrderSchema = z.object({
  orderNo: z.string(),
  mesOrderId: z.string(),
  salesOrderNo: z.string().optional(),
  status: z.enum(['released', 'in_progress', 'paused', 'completed', 'closed']),
  productModel: z.string(),
  productCode: z.string(),
  plannedQty: z.number(),
  completedQty: z.number().optional(),
  dueTs: z.number(),
  releaseTs: z.number().optional(),
  planStartTs: z.number().optional(),
  planEndTs: z.number().optional(),
  priority: z.number().optional(),
  targetFactoryId: z.string().optional(),
  targetZoneId: z.string().optional(),
  targetLineId: z.string().optional(),
  routeId: z.string().optional(),
  bomId: z.string().optional(),
  standardCycleSec: z.number().optional(),
  standardUph: z.number().optional(),
  unitCost: z.number().optional(),
  remark: z.string().optional()
})

export const mesOrderChangeNoticeSchema = z.object({
  noticeId: z.string(),
  changeType: z.enum(['created', 'updated', 'rescheduled', 'cancelled']),
  occurredTs: z.number(),
  order: mesWorkOrderSchema
})
