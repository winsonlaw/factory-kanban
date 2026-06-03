/**
 * 从 data-platform 拉取本网关的采集配置（admin-web 所配），构建 Modbus Profile。
 * 实现「后台配置 → 网关采集」的闭环：改配置不改代码。
 */

import { config } from './config.js'
import type { ModbusProfile } from './drivers/modbus.js'
import type { DeviceType } from './wire.js'

interface RemoteCollector {
  collector: { id: string; stationId: string; protocol: string; pollMs: number }
  channel?: { config: Record<string, unknown> }
  points: Array<{ canonicalField: string; address: string }>
}
interface RemoteStation {
  id: string
  deviceType: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.dataPlatformUrl}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()) as T
}

/** 拉取并映射为 ModbusProfile[]（仅 modbus_tcp 协议的采集服务）。 */
export async function fetchModbusProfiles(): Promise<ModbusProfile[]> {
  const [collectors, stations] = await Promise.all([
    getJson<RemoteCollector[]>(`/api/config/gateway/${config.gatewayId}/collectors`),
    getJson<RemoteStation[]>(`/api/config/stations`)
  ])
  const deviceTypeOf = (stationId: string): DeviceType =>
    (stations.find((s) => s.id === stationId)?.deviceType as DeviceType) ?? 'generic'

  const profiles: ModbusProfile[] = []
  for (const rc of collectors) {
    if (rc.collector.protocol !== 'modbus_tcp') continue
    const cfg = rc.channel?.config ?? {}
    const reg = (field: string): number => {
      const p = rc.points.find((x) => x.canonicalField === field)
      return p ? parseInt(p.address, 10) : 0
    }
    // 站位组合键 line-station，如 L01-S01
    const [lineId, ...rest] = rc.collector.stationId.split('-')
    const stationCode = rest.join('-')
    profiles.push({
      host: String(cfg.host ?? '127.0.0.1'),
      port: Number(cfg.port ?? 502),
      unitId: Number(cfg.unitId ?? 1),
      pollMs: rc.collector.pollMs,
      factoryId: config.factoryId,
      zoneId: config.zoneId,
      lineId: lineId ?? '',
      stationId: stationCode,
      deviceId: `DEV-${rc.collector.stationId}`,
      deviceType: deviceTypeOf(rc.collector.stationId),
      registers: {
        passCount: reg('passCount'),
        failCount: reg('failCount'),
        cycleTimeMs: reg('cycleTimeMs'),
        status: reg('equipmentStatus')
      }
    })
  }
  return profiles
}
