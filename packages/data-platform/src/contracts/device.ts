/**
 * 设备遥测契约 —— 南向（设备 → 边缘网关 → 数据平台）的规范化消息。
 *
 * 设计目标：**不同设备类型、不同协议，统一成一套 canonical 消息**。
 *   - 公共字段（产量/节拍/状态/缺陷/报警）所有设备都填，支撑 OEE/Pacing/Pareto。
 *   - 设备类型专属遥测放进 `metrics`，用 `deviceType` 做可辨识联合（discriminated union），
 *     消费端 `switch(deviceType)` 即可类型安全地拿到对应字段。
 *
 * 原始协议（Modbus/OPC-UA/MQTT/SECS-GEM/RS485）的差异由边缘网关的「设备 Profile」
 * 吸收：Profile 负责把原始寄存器/标签映射成下面的 canonical 字段。数据平台只认 canonical。
 */

import type { AlarmRecord, AssetRef, DefectRecord, EquipmentStatusCode, MessageEnvelope } from './common.js'

// ───────────────────────────── 设备类型 ─────────────────────────────

/** 支持的设备类型。新增设备类型时：加枚举值 + 加一个 *Metrics + 加一个 *Telemetry 分支。 */
export type DeviceType =
  | 'solder_printer' // 锡膏印刷机
  | 'smt_mounter' // 贴片机（Pick & Place）
  | 'reflow_oven' // 回流焊
  | 'aoi' // AOI 光学检测
  | 'spi' // SPI 锡膏检测
  | 'dip_inserter' // DIP 插件
  | 'wave_solder' // 波峰焊
  | 'ict_fct' // ICT / FCT 测试
  | 'laser_marker' // 激光打标
  | 'generic' // 通用 / 未适配设备（用 GenericMetrics 兜底）

// ───────────────────────── 各设备类型专属遥测 ─────────────────────────

/** 锡膏印刷机 */
export interface SolderPrinterMetrics {
  squeegeePressureN?: number // 刮刀压力 N
  squeegeeSpeedMmS?: number // 刮刀速度 mm/s
  printGapUm?: number // 印刷间隙 μm
  cleanInterval?: number // 自动清洗间隔（片）
  pasteBatchId?: string // 锡膏批次
}

/** 贴片机 */
export interface SmtMounterMetrics {
  placedCount?: number // 本周期贴装点数
  cph?: number // 实际贴装速率 chips/hour
  pickupErrorRate?: number // 抛料率 0-1
  nozzleAlarms?: string[] // 异常吸嘴编号
  feederAlarms?: string[] // 异常飞达编号
  headCount?: number // 贴装头数
}

/** 回流焊 */
export interface ReflowOvenMetrics {
  zoneTempsC?: number[] // 各温区实测温度 ℃（按温区顺序）
  zoneSetpointsC?: number[] // 各温区设定温度 ℃
  conveyorSpeedMmMin?: number // 链速 mm/min
  peakTempC?: number // 峰值温度 ℃
  n2Ppm?: number // 氮气含氧量 ppm（氮气炉）
}

/** 波峰焊 */
export interface WaveSolderMetrics {
  solderPotTempC?: number // 锡炉温度 ℃
  preheatTempC?: number // 预热温度 ℃
  conveyorSpeedMmMin?: number // 链速 mm/min
  waveHeightMm?: number // 波峰高度 mm
}

/** AOI / SPI 光学检测（缺陷明细放公共 defects 字段，这里放检测统计） */
export interface InspectionMetrics {
  inspected?: number // 本周期检测点/板数
  passed?: number // 通过数
  failed?: number // 判废数
  falseCallRate?: number // 误判率 0-1
  programName?: string // 检测程序/机种
}

/** DIP 插件 */
export interface DipInserterMetrics {
  insertedCount?: number // 插装点数
  missInsertRate?: number // 漏插率 0-1
}

/** ICT / FCT 测试 */
export interface IctFctMetrics {
  tested?: number // 测试数
  passed?: number // 通过数
  failed?: number // 失败数
  failItems?: string[] // 失败测试项
  testProgram?: string // 测试程序
}

/** 通用兜底：未适配设备的任意键值遥测。 */
export interface GenericMetrics {
  [key: string]: number | string | boolean | null
}

// ──────────────────────── canonical 遥测信封 ────────────────────────

/** 所有设备遥测的公共字段（每次过机/周期上报）。 */
interface BaseTelemetry extends MessageEnvelope, AssetRef {
  /** 采集时刻 epoch ms（MessageEnvelope.timestamp 复用为业务时刻）。 */

  // —— 通用生产指标（所有设备都填，OEE/Pacing/质量的数据基础）——
  passCount: number // 本次良品过机增量（通常 1）
  failCount: number // 本次不良增量
  cycleTimeMs: number // 本次节拍（实际加工时间）
  equipmentStatus: EquipmentStatusCode // 设备状态数字码

  // —— 通用可选 ——
  defects?: DefectRecord[] // 本次缺陷明细（支撑缺陷 Pareto）
  alarm?: AlarmRecord | null // 当前报警（支撑停机 Pareto / MTTR）
  wipBuffer?: number // 本站在制品缓冲数（支撑 WIP / 断堵流）
  orderNo?: string | null // 当前在产工单号（设备若已知）
  model?: string | null // 当前型号
}

/** 设备类型 → 专属遥测的映射，便于按需取用。 */
export interface DeviceMetricsMap {
  solder_printer: SolderPrinterMetrics
  smt_mounter: SmtMounterMetrics
  reflow_oven: ReflowOvenMetrics
  aoi: InspectionMetrics
  spi: InspectionMetrics
  dip_inserter: DipInserterMetrics
  wave_solder: WaveSolderMetrics
  ict_fct: IctFctMetrics
  laser_marker: GenericMetrics
  generic: GenericMetrics
}

/** 单设备类型的遥测 = 公共字段 + 该类型的 metrics，靠 deviceType 字面量辨识。 */
export type DeviceTelemetry<T extends DeviceType = DeviceType> = {
  [K in T]: BaseTelemetry & {
    deviceType: K
    metrics?: DeviceMetricsMap[K]
  }
}[T]

/**
 * 用法示例（消费端类型安全地按设备类型分支）：
 *
 *   function handle(t: DeviceTelemetry) {
 *     switch (t.deviceType) {
 *       case 'reflow_oven':
 *         t.metrics?.peakTempC      // ✅ 收窄为 ReflowOvenMetrics
 *         break
 *       case 'smt_mounter':
 *         t.metrics?.cph            // ✅ 收窄为 SmtMounterMetrics
 *         break
 *     }
 *   }
 */

// ──────────────────────────── 设备事件 ────────────────────────────
//
// 遥测（telemetry）是高频周期流；事件（event）是状态变更，独立通道上报，便于 MES/报警订阅。

/** 设备事件类型。 */
export type DeviceEventType =
  | 'status_change' // 状态切换（运行↔停机↔待机）
  | 'alarm_raised' // 报警发生
  | 'alarm_cleared' // 报警恢复
  | 'changeover_start' // 换型开始
  | 'changeover_end' // 换型结束
  | 'order_start' // 上工单
  | 'order_end' // 工单完工

/** 设备事件消息（边缘 → 中心，事件通道）。 */
export interface DeviceEvent extends MessageEnvelope, AssetRef {
  deviceType: DeviceType
  eventType: DeviceEventType
  prevStatus?: EquipmentStatusCode // 状态切换前
  nextStatus?: EquipmentStatusCode // 状态切换后
  alarm?: AlarmRecord // 报警类事件携带
  orderNo?: string // 工单类事件携带
  toModel?: string // 换型目标型号
  payload?: Record<string, unknown> // 扩展
}

// ──────────────────────────── 网关心跳 ────────────────────────────

/** 边缘网关健康/在线状态（监控网关本身，支撑离线补传判断）。 */
export interface GatewayHeartbeat extends MessageEnvelope {
  factoryId: string
  zoneId: string
  gatewayId: string
  online: boolean
  bufferedCount: number // 本地缓冲待补传条数（断网时 >0）
  connectedDevices: number // 当前在线设备数
  firmwareVersion?: string
}
