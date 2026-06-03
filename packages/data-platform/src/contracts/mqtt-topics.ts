/**
 * MQTT 主题约定 —— 边缘网关 ↔ 数据平台（EMQX）的通道命名。
 *
 * 主题模板：fk/{version}/{kind}/{factoryId}/{zoneId}/{lineId}/{stationId}
 *   · fk          固定前缀（factory-kanban）
 *   · version     契约大版本 v1（破坏性变更才升）
 *   · kind        消息类别：telemetry / event / status / cmd
 *   · 层级段       便于按工厂/车间/产线做通配订阅与 EMQX 规则引擎分流
 *
 * 上行（边缘 → 中心）：telemetry / event / status
 * 下行（中心 → 边缘）：cmd（配置下发、轮播控制、设备指令）
 */

export const TOPIC_PREFIX = 'fk'
export const TOPIC_VERSION = 'v1'

/** 消息类别。 */
export type TopicKind = 'telemetry' | 'event' | 'status' | 'cmd'

/** 构造遥测上行主题（每站位一个）。 */
export function telemetryTopic(a: {
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
}): string {
  return `${TOPIC_PREFIX}/${TOPIC_VERSION}/telemetry/${a.factoryId}/${a.zoneId}/${a.lineId}/${a.stationId}`
}

/** 构造事件上行主题（状态变更/报警/换型）。 */
export function eventTopic(a: {
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
}): string {
  return `${TOPIC_PREFIX}/${TOPIC_VERSION}/event/${a.factoryId}/${a.zoneId}/${a.lineId}/${a.stationId}`
}

/** 构造网关心跳/状态主题（每网关一个）。 */
export function statusTopic(a: { factoryId: string; zoneId: string; gatewayId: string }): string {
  return `${TOPIC_PREFIX}/${TOPIC_VERSION}/status/${a.factoryId}/${a.zoneId}/${a.gatewayId}`
}

/** 构造下行指令主题（中心 → 边缘，按产线下发）。 */
export function cmdTopic(a: { factoryId: string; zoneId: string; lineId: string }): string {
  return `${TOPIC_PREFIX}/${TOPIC_VERSION}/cmd/${a.factoryId}/${a.zoneId}/${a.lineId}`
}

/**
 * 通配订阅模板（数据平台侧）：
 *   全部遥测：     fk/v1/telemetry/#
 *   某工厂全部事件：fk/v1/event/F01/#
 *   某车间遥测：   fk/v1/telemetry/F01/Z03/#
 */
export const SUBSCRIPTION = {
  allTelemetry: `${TOPIC_PREFIX}/${TOPIC_VERSION}/telemetry/#`,
  allEvents: `${TOPIC_PREFIX}/${TOPIC_VERSION}/event/#`,
  allStatus: `${TOPIC_PREFIX}/${TOPIC_VERSION}/status/#`,
  factoryEvents: (factoryId: string) =>
    `${TOPIC_PREFIX}/${TOPIC_VERSION}/event/${factoryId}/#`,
  zoneTelemetry: (factoryId: string, zoneId: string) =>
    `${TOPIC_PREFIX}/${TOPIC_VERSION}/telemetry/${factoryId}/${zoneId}/#`
} as const

/** 下行指令类型（中心 → 边缘）。 */
export type DownlinkCommandType =
  | 'reload_config' // 重载设备 Profile / 阈值配置
  | 'set_threshold' // 下发报警阈值
  | 'device_control' // 透传设备控制指令（需权限）
  | 'request_resync' // 请求网关重传缓冲数据

/** 下行指令消息。 */
export interface DownlinkCommand {
  schemaVersion: string
  commandId: string
  type: DownlinkCommandType
  issuedTs: number
  payload?: Record<string, unknown>
}
