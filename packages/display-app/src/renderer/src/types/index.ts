export type EquipmentStatus = 'running' | 'idle' | 'stopped' | 'alarm'

// 缺陷分类（用于缺陷 Pareto）
export interface DefectItem {
  code: string   // 缺陷代码 如 SHORT/OFFSET/MISSING
  name: string   // 缺陷名称 如 开短路/偏移/缺件
  count: number
}

export interface StationData {
  id: string
  name: string
  status: EquipmentStatus
  passCount: number
  failCount: number
  cycletime: number     // ms, actual 实际节拍
  stdCycletime: number  // ms, standard 标准节拍
  goodRate: number      // 0-1
  todayTotal: number
  hourlyTrend: number[]      // 最近8小时每小时产量
  defects: DefectItem[]      // 本站缺陷分类明细
  consecutiveFail: number    // 当前连续不良数（≥3触发工艺异常）
  consecutiveDefect?: string // 连续出现的缺陷名称
}

// 当前工单（产线正在生产的订单）
export interface WorkOrder {
  id: string          // 工单号 WO-20260602-001
  model: string       // 产品型号
  plannedQty: number  // 工单计划总量
  completedQty: number // 已完成数（缺口 = planned - completed）
  dueTs: number       // 交期时间戳（用于超期预警）
  startTs: number     // 开工时间戳
}

// 工单履历（已完成工单，用于切换历史+质量追溯）
export interface WorkOrderBrief {
  model: string
  qty: number
  goodRate: number    // 该工单良率
}

export interface LineData {
  id: string
  name: string
  status: EquipmentStatus
  oee: number           // 0-1
  passCount: number
  targetCount: number   // 当班计划产量
  goodRate: number      // 0-1
  availability: number  // 0-1
  performance: number   // 0-1
  taktSec: number       // 产距时间 Takt(秒) = 可用时间/计划量
  currentOrder: WorkOrder // 当前在产工单
  nextModel?: string      // 下一工单型号
  orderHistory?: WorkOrderBrief[] // 今日已完成工单（切换历史+质量追溯）
  stations: StationData[]
  trendData: TrendPoint[]
}

export interface TrendPoint {
  time: string
  count: number
  oee: number
}

export interface AlarmItem {
  id: string
  lineId: string
  lineName: string
  stationId?: string
  stationName?: string
  level: 'warn' | 'alarm'
  message: string
  time: string          // 显示用时间字符串
  startTs: number       // 报警发生时间戳（用于计算已持续时长）
}

// 缺料预警（调度屏）
export interface MaterialAlert {
  id: string
  lineId: string
  lineName: string
  station?: string
  material: string
  remainMin: number   // 当前库存可支撑分钟
}

// 换型/换线（调度屏）
export interface Changeover {
  id: string
  lineId: string
  lineName: string
  toModel: string     // 切换到的型号
  startTs: number     // 换型开始时间戳
  durationSec: number // 计划换型时长(秒)
}

// 订单/工单进度（主任屏）
export interface OrderProgress {
  id: string
  model: string       // 产品型号
  qty: number         // 订单总量
  done: number        // 已完成
  etaText: string     // 交付预测文本
  risk: boolean       // 是否有交付风险
}

export interface WorkshopData {
  id: string
  name: string
  factoryName: string
  shiftName: string
  shiftStartTs: number    // 班次开始时间戳（用于 Pacing/Takt 应产计算）
  shiftDurationH: number  // 班次时长(小时，含休息扣除后的有效)
  lines: LineData[]
  alarms: AlarmItem[]
  materialAlerts: MaterialAlert[]
  changeovers: Changeover[]
  costPerUnit: number     // 单件成本/产值(元)，用于金额化损失
  monthTarget: number     // 本月计划产量
  monthActual: number     // 本月累计产量
  oeeTrend7d: number[]    // 近7天综合OEE(0-1)
  orders: OrderProgress[] // 在产订单进度
  safeDays: number        // 安全运行天数(参观屏亮点)
  monthYoY: number        // 本月同比增长(0-1, 如0.123=+12.3%)
}

// Pacing 计算结果
export interface PacingResult {
  shouldProduce: number  // 应产数
  actual: number         // 实产数
  delta: number          // 差额（正=超产 负=欠产）
  behindMin: number      // 落后分钟（delta<0时）
  aheadMin: number       // 领先分钟（delta>0时）
  remainingQty: number   // 距目标剩余件数
  requiredRate: number   // 需提速到 件/小时
  onTrack: boolean       // 是否在轨
}

export interface AppConfig {
  workshopId: string
  wsUrl: string
  rotateInterval: number  // seconds, 0 = no rotation
  displayMode: 'workshop' | 'line' | 'auto'
}
