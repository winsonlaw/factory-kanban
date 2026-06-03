/**
 * 配置库种子 —— 与 masterdata（SMT 车间）一致，并补齐采集域示例
 * （网关 / 采集服务 / 通讯块 / 数据块），使管理后台一打开就有完整层级可演示。
 */

import { workshopDef, defectDict, alarmDict } from '../masterdata.js'
import type {
  AlarmCode,
  ChannelConfigMap,
  CommChannel,
  Collector,
  ConfigData,
  DataPoint,
  DefectCode,
  DeviceProfile,
  EdgeGateway,
  Line,
  Shift,
  Station,
  Target,
  Threshold,
  Workshop
} from './types.js'

const deviceProfiles: DeviceProfile[] = [
  { key: 'solder_printer', name: '锡膏印刷机', category: 'SMT', metrics: [
    { key: 'squeegeePressureN', label: '刮刀压力', unit: 'N', type: 'number' },
    { key: 'printGapUm', label: '印刷间隙', unit: 'μm', type: 'number' }
  ] },
  { key: 'smt_mounter', name: '贴片机', category: 'SMT', metrics: [
    { key: 'cph', label: '贴装速率', unit: 'chips/h', type: 'number' },
    { key: 'pickupErrorRate', label: '抛料率', type: 'number' }
  ] },
  { key: 'reflow_oven', name: '回流焊', category: 'SMT', metrics: [
    { key: 'zoneTempsC', label: '各温区温度', unit: '℃', type: 'number[]' },
    { key: 'peakTempC', label: '峰值温度', unit: '℃', type: 'number' },
    { key: 'conveyorSpeedMmMin', label: '链速', unit: 'mm/min', type: 'number' }
  ] },
  { key: 'aoi', name: 'AOI检测', category: 'SMT', metrics: [
    { key: 'falseCallRate', label: '误判率', type: 'number' }
  ] },
  { key: 'dip_inserter', name: 'DIP插件', category: 'DIP', metrics: [
    { key: 'missInsertRate', label: '漏插率', type: 'number' }
  ] },
  { key: 'wave_solder', name: '波峰焊', category: 'DIP', metrics: [
    { key: 'solderPotTempC', label: '锡炉温度', unit: '℃', type: 'number' },
    { key: 'waveHeightMm', label: '波峰高度', unit: 'mm', type: 'number' }
  ] },
  { key: 'ict_fct', name: 'ICT/FCT测试', category: '测试', metrics: [] },
  { key: 'generic', name: '通用设备', category: '通用', metrics: [] }
]

export function buildSeed(): ConfigData {
  const factories = [{ id: workshopDef.factoryId, name: workshopDef.factoryName }]
  const workshops: Workshop[] = [
    { id: workshopDef.id, factoryId: workshopDef.factoryId, name: workshopDef.name }
  ]
  const gateways: EdgeGateway[] = [
    { id: 'GW-Z01-01', factoryId: workshopDef.factoryId, workshopId: workshopDef.id, name: 'SMT车间网关', online: true }
  ]

  const lines: Line[] = []
  const stations: Station[] = []
  const collectors: Collector[] = []
  const channels: CommChannel[] = []
  const dataPoints: DataPoint[] = []

  workshopDef.lines.forEach((l, li) => {
    lines.push({ id: l.id, workshopId: workshopDef.id, name: l.name, taktSec: l.taktSec, targetCount: l.targetCount, seq: li + 1 })
    l.stations.forEach((s, si) => {
      stations.push({ id: `${l.id}-${s.id}`, lineId: l.id, name: s.name, seq: si + 1, deviceType: s.deviceType, stdCycleMs: s.stdCycleMs })

      // 每站一个采集服务（默认 simulator，可在后台改为 modbus 等）
      const collectorId = `COL-${l.id}-${s.id}`
      collectors.push({ id: collectorId, stationId: `${l.id}-${s.id}`, gatewayId: 'GW-Z01-01', name: `${l.name}/${s.name}采集`, protocol: 'simulator', pollMs: 1000, enabled: true })

      // 通讯块（simulator 无连接参数；示例同时给出 Modbus 形态注释）
      const cfg: ChannelConfigMap['simulator'] = {}
      channels.push({ id: `CH-${l.id}-${s.id}`, collectorId, protocol: 'simulator', config: cfg })

      // 数据块（点表）：4 个公共 canonical 字段示例映射
      const base = 40001 + si * 16
      const pts: Array<[string, DataPoint['canonicalField'], DataPoint['dataType'], DataPoint['mode'], number]> = [
        ['良品累计', 'passCount', 'uint32', 'increment', base],
        ['不良累计', 'failCount', 'uint32', 'increment', base + 2],
        ['本次节拍', 'cycleTimeMs', 'uint32', 'value', base + 4],
        ['设备状态', 'equipmentStatus', 'uint16', 'value', base + 6]
      ]
      pts.forEach(([name, field, dtype, mode, addr], pi) => {
        dataPoints.push({ id: `DP-${l.id}-${s.id}-${pi}`, collectorId, name, canonicalField: field, address: String(addr), dataType: dtype, scale: 1, mode, funcCode: 3 })
      })
    })
  })

  const defectCodes: DefectCode[] = Object.entries(defectDict).map(([code, name]) => ({ code, name }))
  const alarmCodes: AlarmCode[] = Object.entries(alarmDict).map(([code, name]) => ({ code, name }))

  const shifts: Shift[] = [
    { id: 'SH-MORNING', workshopId: workshopDef.id, name: '早班', startMin: 480, endMin: 1020, breakMin: 60 },
    { id: 'SH-NIGHT', workshopId: workshopDef.id, name: '晚班', startMin: 1020, endMin: 1560, breakMin: 60 }
  ]
  const targets: Target[] = workshopDef.lines.map((l) => ({ id: `TG-${l.id}`, lineId: l.id, plannedQty: l.targetCount, stdUph: Math.round(3600 / l.taktSec) }))
  const thresholds: Threshold[] = [
    { id: 'TH-GLOBAL', scope: 'global', taktWarnRatio: 1.15, downtimeSec: 300, consecutiveFail: 3 }
  ]

  return {
    factories, workshops, lines, stations, deviceProfiles,
    gateways, collectors, channels, dataPoints,
    defectCodes, alarmCodes, shifts, targets, thresholds
  }
}
