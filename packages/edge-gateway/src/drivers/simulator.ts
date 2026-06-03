/**
 * 仿真驱动 —— 无需真实 PLC，按站位节拍生成贴近现场的 canonical 遥测/事件。
 * 用于开发、演示、压测。节拍按 SIM_SPEED 缩放加速。
 */

import { config } from '../config.js'
import { topology, type StationTopo } from '../topology.js'
import {
  EquipmentStatusCode,
  SCHEMA_VERSION,
  nextMessageId,
  type AlarmRecord,
  type DefectRecord,
  type DeviceEvent,
  type DeviceTelemetry
} from '../wire.js'
import type { Driver, DriverCallbacks } from './types.js'

const DEFECTS: Array<[string, string]> = [
  ['SHORT', '开短路'],
  ['OFFSET', '偏移'],
  ['MISSING', '缺件'],
  ['TOMB', '立碑'],
  ['COLD', '虚焊']
]
const ALARMS: Array<[string, string]> = [
  ['TEMP_OVER', '炉温超限'],
  ['FEEDER_ERR', '飞达异常'],
  ['JAM', '卡板']
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** 各设备类型的专属 metrics 仿真。 */
function genMetrics(s: StationTopo, cycleMs: number): Record<string, unknown> {
  switch (s.deviceType) {
    case 'reflow_oven':
      return {
        zoneTempsC: [150, 180, 210, 245, 250, 230].map((t) => t + Math.round((Math.random() - 0.5) * 6)),
        peakTempC: 248 + Math.round(Math.random() * 6),
        conveyorSpeedMmMin: 900
      }
    case 'smt_mounter':
      return { cph: Math.round(3600000 / cycleMs) * 8, pickupErrorRate: +(Math.random() * 0.02).toFixed(4) }
    case 'solder_printer':
      return { squeegeePressureN: 60 + Math.round(Math.random() * 10), printGapUm: 0 }
    case 'aoi':
    case 'spi':
      return { inspected: 1, passed: 1, falseCallRate: +(Math.random() * 0.03).toFixed(4) }
    case 'wave_solder':
      return { solderPotTempC: 255 + Math.round(Math.random() * 5), waveHeightMm: 8 }
    default:
      return {}
  }
}

export class SimulatorDriver implements Driver {
  private timers: NodeJS.Timeout[] = []

  async start(cb: DriverCallbacks): Promise<void> {
    for (const s of topology) {
      // 每站一个独立节拍循环；用 jitter 避免完全同步
      const baseInterval = Math.max(50, s.stdCycleMs * config.sim.speed)
      const loop = (): void => {
        this.emit(s, cb)
        const jitter = baseInterval * (0.85 + Math.random() * 0.3)
        const timer = setTimeout(loop, jitter)
        this.timers.push(timer)
      }
      const startDelay = Math.random() * baseInterval
      this.timers.push(setTimeout(loop, startDelay))
    }

    // 换型事件流：周期挑一条产线模拟换型（start → 8s 后 end）
    this.startChangeoverLoop(cb)

    console.log(`[sim] started, ${topology.length} stations, speed=${config.sim.speed}`)
  }

  private startChangeoverLoop(cb: DriverCallbacks): void {
    const lines = [...new Set(topology.map((s) => s.lineId))]
    const models = ['A203-主板', 'B107-控制板', 'C055-电源板', 'E330-传感板', 'D211-接口板']
    const loop = (): void => {
      const lineId = pick(lines)
      const head = topology.find((s) => s.lineId === lineId)!
      const toModel = pick(models)
      cb.onEvent(this.mkEvent(head, 'changeover_start', { toModel }))
      this.timers.push(setTimeout(() => cb.onEvent(this.mkEvent(head, 'changeover_end', { toModel })), 8000))
      this.timers.push(setTimeout(loop, 20000 + Math.random() * 20000))
    }
    this.timers.push(setTimeout(loop, 10000))
  }

  private mkEvent(s: StationTopo, eventType: DeviceEvent['eventType'], extra: Partial<DeviceEvent>): DeviceEvent {
    return {
      schemaVersion: SCHEMA_VERSION,
      messageId: nextMessageId(),
      timestamp: Date.now(),
      factoryId: config.factoryId,
      zoneId: config.zoneId,
      lineId: s.lineId,
      stationId: s.stationId,
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      eventType,
      ...extra
    }
  }

  private emit(s: StationTopo, cb: DriverCallbacks): void {
    const now = Date.now()
    const isFail = Math.random() < config.sim.failRate
    const cycleMs = Math.round(s.stdCycleMs * (0.95 + Math.random() * 0.18)) // 偶发轻微超标

    const defects: DefectRecord[] = []
    if (isFail) {
      const [code, name] = pick(DEFECTS)
      defects.push({ code, name, count: 1 })
    }

    let alarm: AlarmRecord | null = null
    if (Math.random() < config.sim.alarmChance) {
      const [code, name] = pick(ALARMS)
      alarm = { code, name, severity: 'alarm', raisedTs: now, message: `${s.name} ${name}` }
    }

    const t: DeviceTelemetry = {
      schemaVersion: SCHEMA_VERSION,
      messageId: nextMessageId(),
      timestamp: now,
      factoryId: config.factoryId,
      zoneId: config.zoneId,
      lineId: s.lineId,
      stationId: s.stationId,
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      passCount: isFail ? 0 : 1,
      failCount: isFail ? 1 : 0,
      cycleTimeMs: cycleMs,
      equipmentStatus: alarm ? EquipmentStatusCode.Alarm : EquipmentStatusCode.Running,
      defects: defects.length ? defects : undefined,
      alarm,
      wipBuffer: Math.floor(Math.random() * 6),
      metrics: genMetrics(s, cycleMs)
    }
    cb.onTelemetry(t)
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
  }
}
