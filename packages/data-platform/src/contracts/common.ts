/**
 * 通用契约 —— 全系统共享的基础类型、标识与枚举。
 *
 * 这一层是「设备 → 边缘网关 → 数据平台 → MES / 大屏」整条链路的公共词汇表。
 * 所有对外消息（设备遥测、MES 报工）都复用这里的标识与状态语义。
 */

/** 当前契约版本。任何破坏性变更都要升版本，消费端按 schemaVersion 兼容处理。 */
export const SCHEMA_VERSION = '1.0' as const

// ───────────────────────────── 层级标识 ─────────────────────────────
//
// 设备/产线/车间的唯一定位遵循「工厂 > 厂区/车间 > 产线 > 站位 > 设备」五级。
// 所有标识均为业务可读字符串（如 F01 / Z03 / L02 / S05），由基础数据配置统一分配。

/** 五级层级定位。任何一条遥测/事件都必须携带，作为路由与聚合的键。 */
export interface AssetRef {
  factoryId: string // 工厂  F01
  zoneId: string // 厂区/车间 Z03
  lineId: string // 产线  L02
  stationId: string // 站位  S05
  deviceId: string // 物理设备 DEV-RFL-001（一站可挂多设备）
}

// ───────────────────────────── 设备状态 ─────────────────────────────
//
// 设备侧上报数字码（PLC 友好），数据平台落库后映射为前端可读字符串。

/** 设备状态数字码（设备/网关侧上报值）。 */
export enum EquipmentStatusCode {
  Stopped = 0, // 停机（计划外停止）
  Running = 1, // 运行
  Idle = 2, // 待机（无料/等待）
  Alarm = 3 // 报警（异常）
}

/** 前端展示用状态字符串，与 display-app 的 EquipmentStatus 对齐。 */
export type EquipmentStatusLabel = 'stopped' | 'running' | 'idle' | 'alarm'

/** 数字码 → 前端字符串映射。数据平台在落库/推送时统一转换。 */
export const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatusCode, EquipmentStatusLabel> = {
  [EquipmentStatusCode.Stopped]: 'stopped',
  [EquipmentStatusCode.Running]: 'running',
  [EquipmentStatusCode.Idle]: 'idle',
  [EquipmentStatusCode.Alarm]: 'alarm'
}

// ───────────────────────────── 缺陷 / 报警 ─────────────────────────────

/** 单条缺陷记录（支撑缺陷 Pareto）。code 取自缺陷字典，AOI 等检测设备可带坐标。 */
export interface DefectRecord {
  code: string // 缺陷代码 SHORT/OFFSET/MISSING（缺陷字典）
  name?: string // 缺陷名称（可由字典反查，遥测可省略）
  count?: number // 数量，默认 1
  refDes?: string // 元件位号（如 R12），AOI/ICT 可带
  x?: number // 缺陷坐标 X（mm），光学检测可带
  y?: number // 缺陷坐标 Y（mm）
}

/** 报警/停机代码记录（支撑停机 Pareto、MTTR）。 */
export interface AlarmRecord {
  code: string // 报警代码（停机原因字典）
  name?: string // 报警名称
  severity: 'info' | 'warn' | 'alarm' // 级别
  raisedTs: number // 报警发生时刻 epoch ms
  clearedTs?: number // 报警恢复时刻（未恢复为空，用于算已持续时长）
  message?: string // 人读描述
}

// ───────────────────────────── 消息信封 ─────────────────────────────

/**
 * 所有跨边界消息的公共信封字段。
 * messageId 用于消费端幂等去重；schemaVersion 用于兼容；timestamp 为业务发生时刻。
 */
export interface MessageEnvelope {
  schemaVersion: string // 契约版本，见 SCHEMA_VERSION
  messageId: string // 全局唯一 ID（推荐 ULID/UUIDv7），幂等键
  timestamp: number // 业务发生时刻 epoch ms（非传输时刻）
}

/** epoch 毫秒时间戳别名，便于阅读。 */
export type EpochMs = number
