/**
 * 视图模型 —— data-platform 通过 WebSocket 推给大屏（display-app）的快照结构。
 *
 * 与 display-app/src/renderer/src/types 一一对齐：WS 推送的 WorkshopData 可被前端直接消费，
 * 无需转换。前端的 mock 数据未来即由这里的实时计算结果替换。
 */

export type EquipmentStatus = 'running' | 'idle' | 'stopped' | 'alarm'

export interface DefectItem {
  code: string
  name: string
  count: number
}

export interface StationData {
  id: string
  name: string
  status: EquipmentStatus
  passCount: number
  failCount: number
  cycletime: number // ms 实际节拍
  stdCycletime: number // ms 标准节拍
  goodRate: number // 0-1
  todayTotal: number
  hourlyTrend: number[] // 最近 8 小时每小时产量
  defects: DefectItem[]
  consecutiveFail: number
  consecutiveDefect?: string
}

export interface WorkOrder {
  id: string
  model: string
  plannedQty: number
  completedQty: number
  dueTs: number
  startTs: number
}

export interface WorkOrderBrief {
  model: string
  qty: number
  goodRate: number
}

export interface TrendPoint {
  time: string
  count: number
  oee: number
}

export interface LineData {
  id: string
  name: string
  status: EquipmentStatus
  oee: number
  passCount: number
  targetCount: number
  goodRate: number
  availability: number
  performance: number
  taktSec: number
  currentOrder: WorkOrder
  nextModel?: string
  orderHistory?: WorkOrderBrief[]
  stations: StationData[]
  trendData: TrendPoint[]
}

export interface AlarmItem {
  id: string
  lineId: string
  lineName: string
  stationId?: string
  stationName?: string
  level: 'warn' | 'alarm'
  message: string
  time: string
  startTs: number
}

export interface MaterialAlert {
  id: string
  lineId: string
  lineName: string
  station?: string
  material: string
  remainMin: number
}

export interface Changeover {
  id: string
  lineId: string
  lineName: string
  toModel: string
  startTs: number
  durationSec: number
}

export interface OrderProgress {
  id: string
  model: string
  qty: number
  done: number
  etaText: string
  risk: boolean
}

export interface WorkshopData {
  id: string
  name: string
  factoryName: string
  shiftName: string
  shiftStartTs: number
  shiftDurationH: number
  lines: LineData[]
  alarms: AlarmItem[]
  materialAlerts: MaterialAlert[]
  changeovers: Changeover[]
  costPerUnit: number
  monthTarget: number
  monthActual: number
  oeeTrend7d: number[]
  orders: OrderProgress[]
  safeDays: number
  monthYoY: number
}
