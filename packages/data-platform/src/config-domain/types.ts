/**
 * 配置域模型 —— admin-web 管理后台的实体定义。
 *
 * 实体关系链（参考 ThingsBoard Gateway）：
 *   工厂 Factory → 车间 Workshop → 产线 Line → 站位 Station
 *                                                  └─ 采集服务 Collector（绑定到站，运行于某网关）
 *                                                       ├─ 通讯块 CommChannel（协议+连接）
 *                                                       └─ 数据块 DataPoint[]（点表→canonical 字段）
 *
 * 各域只通过 ID 互相引用，保持独立（解耦）。
 */

// ════════════════════ 组织域 ════════════════════

export interface Factory {
  id: string
  name: string
}

export interface Workshop {
  id: string
  factoryId: string
  name: string
}

export interface Line {
  id: string
  workshopId: string
  name: string
  taktSec: number // 产距时间
  targetCount: number // 当班计划产量
  seq: number // 排序
}

export interface Station {
  id: string
  lineId: string
  name: string
  seq: number // 工序顺序（决定产线流方向）
  deviceType: string // → DeviceProfile.key
  stdCycleMs: number // 标准节拍
}

// ════════════════════ 设备域 ════════════════════

export type MetricFieldType = 'number' | 'string' | 'bool' | 'number[]'

export interface MetricField {
  key: string // metrics.<key>
  label: string
  unit?: string
  type: MetricFieldType
}

/** 设备类型档案：声明该类设备的专属遥测字段（对应 canonical metrics）。 */
export interface DeviceProfile {
  key: string // solder_printer / smt_mounter / reflow_oven ...
  name: string // 中文名
  category: string // SMT / DIP / 测试 / 通用
  metrics: MetricField[]
}

// ════════════════════ 采集域 ════════════════════

/** 边缘网关注册表（每车间一台/多台）。 */
export interface EdgeGateway {
  id: string
  factoryId: string
  workshopId: string
  name: string
  host?: string
  online?: boolean
}

export type ProtocolType =
  | 'modbus_tcp'
  | 'modbus_rtu'
  | 'opcua'
  | 'mqtt'
  | 'siemens_s7'
  | 'simulator'

export interface ModbusTcpConfig {
  host: string
  port: number
  unitId: number
}
export interface ModbusRtuConfig {
  serialPort: string
  baudRate: number
  unitId: number
}
export interface OpcuaConfig {
  endpoint: string
  securityPolicy?: string
  username?: string
  password?: string
}
export interface MqttConfig {
  brokerUrl: string
  topic: string
  username?: string
  password?: string
}
export interface SiemensS7Config {
  host: string
  rack: number
  slot: number
}
export type SimulatorConfig = Record<string, never>

export interface ChannelConfigMap {
  modbus_tcp: ModbusTcpConfig
  modbus_rtu: ModbusRtuConfig
  opcua: OpcuaConfig
  mqtt: MqttConfig
  siemens_s7: SiemensS7Config
  simulator: SimulatorConfig
}

/**
 * 采集服务 —— 绑定到一个站位，运行于某边缘网关。
 * 一个 Collector 对应一台物理设备的采集任务。
 */
export interface Collector {
  id: string
  stationId: string // 绑定到站
  gatewayId: string // 运行于哪台网关
  name: string
  protocol: ProtocolType
  pollMs: number // 轮询周期
  enabled: boolean
}

/** 通讯块 —— 挂钩采集服务的协议连接配置（与 protocol 对应）。 */
export interface CommChannel {
  id: string
  collectorId: string
  protocol: ProtocolType
  config: ChannelConfigMap[ProtocolType]
}

/** canonical 目标字段：数据块映射到的标准遥测字段。 */
export type CanonicalField =
  | 'passCount'
  | 'failCount'
  | 'cycleTimeMs'
  | 'equipmentStatus'
  | 'wipBuffer'
  | `metrics.${string}`

export type PointDataType =
  | 'uint16'
  | 'int16'
  | 'uint32'
  | 'int32'
  | 'float32'
  | 'bool'
  | 'string'

/** 数据块（点表项）—— 一个寄存器/节点 → canonical 字段的映射。 */
export interface DataPoint {
  id: string
  collectorId: string
  name: string
  canonicalField: CanonicalField
  address: string // Modbus 寄存器地址 / OPC-UA NodeId / MQTT JSON path
  dataType: PointDataType
  scale: number // 缩放系数（原值 × scale）
  mode: 'value' | 'increment' // 直接值 / 累计计数取增量
  funcCode?: number // Modbus 功能码（3/4 等）
}

// ════════════════════ 字典域 ════════════════════

export interface DefectCode {
  code: string
  name: string
}
export interface AlarmCode {
  code: string
  name: string
}

// ════════════════════ 生产域 ════════════════════

export interface Shift {
  id: string
  workshopId: string
  name: string
  startMin: number // 自 00:00 起分钟
  endMin: number
  breakMin: number
}

export interface Target {
  id: string
  lineId: string
  model?: string
  plannedQty: number
  stdUph?: number
}

export interface Threshold {
  id: string
  scope: 'global' | 'line'
  lineId?: string
  taktWarnRatio: number
  downtimeSec: number
  consecutiveFail: number
}

// ════════════════════ 聚合：整库快照 ════════════════════

/** 配置库全量数据（内存/文件存储的载体；PostgreSQL 落库见 init.sql）。 */
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

/** 配置库实体名（API 路由与通用 CRUD 用）。 */
export type EntityKey = keyof ConfigData
