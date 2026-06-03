/**
 * 配置域类型（镜像 data-platform/src/config-domain/types.ts）。
 * 前后端独立部署，各持类型，经 REST 边界对齐。
 */

export interface Factory { id: string; name: string }
export interface Workshop { id: string; factoryId: string; name: string }
export interface Line { id: string; workshopId: string; name: string; taktSec: number; targetCount: number; seq: number }
export interface Station { id: string; lineId: string; name: string; seq: number; deviceType: string; stdCycleMs: number }

export type MetricFieldType = 'number' | 'string' | 'bool' | 'number[]'
export interface MetricField { key: string; label: string; unit?: string; type: MetricFieldType }
export interface DeviceProfile { key: string; name: string; category: string; metrics: MetricField[] }

export interface EdgeGateway { id: string; factoryId: string; workshopId: string; name: string; host?: string; online?: boolean }

export type ProtocolType =
  | 'modbus_tcp' | 'modbus_rtu' | 'opcua' | 'mqtt' | 'siemens_s7'
  | 'tcp' | 'hilink' | 'http' | 'coap' | 'simulator'

export interface Collector {
  id: string
  stationId: string
  gatewayId: string
  name: string
  protocol: ProtocolType
  pollMs: number
  enabled: boolean
}

export interface CommChannel {
  id: string
  collectorId: string
  protocol: ProtocolType
  config: Record<string, unknown>
}

export type CanonicalField = 'passCount' | 'failCount' | 'cycleTimeMs' | 'equipmentStatus' | 'wipBuffer' | string
export type PointDataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'bool' | 'string'

export interface DataPoint {
  id: string
  collectorId: string
  name: string
  canonicalField: CanonicalField
  address: string
  dataType: PointDataType
  scale: number
  mode: 'value' | 'increment'
  funcCode?: number
}

export interface DefectCode { code: string; name: string }
export interface AlarmCode { code: string; name: string }
export interface Shift { id: string; workshopId: string; name: string; startMin: number; endMin: number; breakMin: number }
export interface Target { id: string; lineId: string; model?: string; plannedQty: number; stdUph?: number }
export interface Threshold { id: string; scope: 'global' | 'line'; lineId?: string; taktWarnRatio: number; downtimeSec: number; consecutiveFail: number }

export interface ConfigData {
  factories: Factory[]
  workshops: Workshop[]
  lines: Line[]
  stations: Station[]
  deviceProfiles: DeviceProfile[]
  gateways: EdgeGateway[]
  collectors: Collector[]
  channels: CommChannel[]
  dataPoints: DataPoint[]
  defectCodes: DefectCode[]
  alarmCodes: AlarmCode[]
  shifts: Shift[]
  targets: Target[]
  thresholds: Threshold[]
}

export type EntityKey = keyof ConfigData

/** 通用设备实时状态（来自 /api/devices，工业+IoT）。 */
export interface DeviceState {
  deviceId: string
  deviceType: string
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  status: string
  online: boolean
  lastTs: number
  metrics: Record<string, unknown>
}

export interface DeviceSummary {
  total: number
  online: number
  byType: Record<string, number>
}

export const PROTOCOL_LABELS: Record<ProtocolType, string> = {
  modbus_tcp: 'Modbus TCP',
  modbus_rtu: 'Modbus RTU',
  opcua: 'OPC-UA',
  mqtt: 'MQTT',
  siemens_s7: 'Siemens S7',
  tcp: 'TCP 通用',
  hilink: 'HiLink(华为)',
  http: 'HTTP/REST',
  coap: 'CoAP',
  simulator: '仿真'
}

export const CANONICAL_FIELDS = [
  'passCount', 'failCount', 'cycleTimeMs', 'equipmentStatus', 'wipBuffer'
]
export const POINT_DATA_TYPES: PointDataType[] = ['uint16', 'int16', 'uint32', 'int32', 'float32', 'bool', 'string']
