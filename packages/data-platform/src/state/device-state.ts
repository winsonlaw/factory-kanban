/**
 * 通用设备状态库 —— IoT 平台核心。
 *
 * 不论工业站位还是家电/空调/传感器，所有 canonical 遥测都在此登记「最新状态」，
 * 与产线 OEE 聚合解耦：工业设备同时进 Aggregator(算 OEE)，而**全部**设备进这里(可查实时状态)。
 * 使平台不只服务工厂看板，也是通用设备接入/监控平台。
 */

import type { DeviceTelemetry } from '../contracts/index.js'
import { EQUIPMENT_STATUS_LABEL, type EquipmentStatusCode } from '../contracts/index.js'

export interface DeviceState {
  deviceId: string
  deviceType: string
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  status: string // 前端字符串 running/idle/stopped/alarm
  online: boolean // 最近 60s 内有数据
  lastTs: number
  metrics: Record<string, unknown>
}

export class DeviceStateStore {
  private devices = new Map<string, DeviceState>()

  /** 每条遥测登记最新状态。 */
  record(t: DeviceTelemetry): void {
    this.devices.set(t.deviceId, {
      deviceId: t.deviceId,
      deviceType: t.deviceType,
      factoryId: t.factoryId,
      zoneId: t.zoneId,
      lineId: t.lineId,
      stationId: t.stationId,
      status: EQUIPMENT_STATUS_LABEL[t.equipmentStatus as EquipmentStatusCode] ?? 'idle',
      online: true,
      lastTs: t.timestamp,
      metrics: (t.metrics ?? {}) as Record<string, unknown>
    })
  }

  /** 全部设备最新状态（可按 zone/deviceType 过滤）。 */
  list(filter?: { zoneId?: string; deviceType?: string }): DeviceState[] {
    const now = Date.now()
    let out = [...this.devices.values()].map((d) => ({ ...d, online: now - d.lastTs < 60_000 }))
    if (filter?.zoneId) out = out.filter((d) => d.zoneId === filter.zoneId)
    if (filter?.deviceType) out = out.filter((d) => d.deviceType === filter.deviceType)
    return out
  }

  get(deviceId: string): DeviceState | undefined {
    const d = this.devices.get(deviceId)
    if (!d) return undefined
    return { ...d, online: Date.now() - d.lastTs < 60_000 }
  }

  /** 设备总数 + 在线数（概览）。 */
  summary(): { total: number; online: number; byType: Record<string, number> } {
    const now = Date.now()
    const all = [...this.devices.values()]
    const byType: Record<string, number> = {}
    for (const d of all) byType[d.deviceType] = (byType[d.deviceType] ?? 0) + 1
    return { total: all.length, online: all.filter((d) => now - d.lastTs < 60_000).length, byType }
  }
}
