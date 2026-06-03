/**
 * 线协议（wire format）—— 边缘网关上报给中心的规范化消息形状 + MQTT 主题。
 *
 * 这是 data-platform `contracts/` 的最小镜像（事实源在 data-platform，运行时由其 zod 校验）。
 * 网关与中心是两个独立部署，各自持有线格式表示，在 MQTT 边界对齐——刻意不做编译期共享，
 * 避免跨包构建耦合。新增/变更字段时两端同步。
 */

export const SCHEMA_VERSION = '1.0'

/** 设备状态码：0停机 1运行 2待机 3报警 */
export enum EquipmentStatusCode {
  Stopped = 0,
  Running = 1,
  Idle = 2,
  Alarm = 3
}

export type DeviceType =
  | 'solder_printer'
  | 'smt_mounter'
  | 'reflow_oven'
  | 'aoi'
  | 'spi'
  | 'dip_inserter'
  | 'wave_solder'
  | 'ict_fct'
  | 'laser_marker'
  // IoT / 家电 / 智控
  | 'air_conditioner'
  | 'th_sensor'
  | 'smart_plug'
  | 'fresh_air'
  | 'lighting'
  | 'generic'

export interface DefectRecord {
  code: string
  name?: string
  count?: number
}

export interface AlarmRecord {
  code: string
  name?: string
  severity: 'info' | 'warn' | 'alarm'
  raisedTs: number
  clearedTs?: number
  message?: string
}

export interface DeviceTelemetry {
  schemaVersion: string
  messageId: string
  timestamp: number
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  deviceId: string
  deviceType: DeviceType
  passCount: number
  failCount: number
  cycleTimeMs: number
  equipmentStatus: EquipmentStatusCode
  defects?: DefectRecord[]
  alarm?: AlarmRecord | null
  wipBuffer?: number
  orderNo?: string | null
  model?: string | null
  metrics?: Record<string, unknown>
}

export interface DeviceEvent {
  schemaVersion: string
  messageId: string
  timestamp: number
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  deviceId: string
  deviceType: DeviceType
  eventType:
    | 'status_change'
    | 'alarm_raised'
    | 'alarm_cleared'
    | 'changeover_start'
    | 'changeover_end'
    | 'order_start'
    | 'order_end'
  alarm?: AlarmRecord
  toModel?: string
  orderNo?: string
}

const PREFIX = 'fk'
const VERSION = 'v1'

export interface TopicParts {
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
}

export function telemetryTopic(a: TopicParts): string {
  return `${PREFIX}/${VERSION}/telemetry/${a.factoryId}/${a.zoneId}/${a.lineId}/${a.stationId}`
}

export function eventTopic(a: TopicParts): string {
  return `${PREFIX}/${VERSION}/event/${a.factoryId}/${a.zoneId}/${a.lineId}/${a.stationId}`
}

let counter = 0
/** 单调消息 ID（幂等键）。 */
export function nextMessageId(): string {
  counter += 1
  return `MSG-${Date.now().toString(36)}-${counter.toString(36)}`
}
