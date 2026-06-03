/**
 * 配置库 → 运行时拓扑 —— 把 admin-web 配置的车间/产线/站位转成 Aggregator 用的 WorkshopDef。
 * 这样「后台配置」即在 data-platform 启动时生效（经济参数仍取 masterdata 默认）。
 */

import { workshopDef as base, type LineDef, type StationDef, type WorkshopDef } from '../masterdata.js'
import type { ConfigStore } from './store.js'

export function buildWorkshopDef(store: ConfigStore, workshopId: string): WorkshopDef {
  const cfg = store.snapshot()
  const ws = cfg.workshops.find((w) => w.id === workshopId) ?? cfg.workshops[0]
  if (!ws) return base
  const factory = cfg.factories.find((f) => f.id === ws.factoryId)

  const lines: LineDef[] = cfg.lines
    .filter((l) => l.workshopId === ws.id)
    .sort((a, b) => a.seq - b.seq)
    .map((l) => {
      const stations: StationDef[] = cfg.stations
        .filter((s) => s.lineId === l.id)
        .sort((a, b) => a.seq - b.seq)
        .map((s) => {
          // 站位 canonical code（剥去配置库的 lineId 前缀，对齐网关上报的 stationId）
          const code = s.id.startsWith(`${l.id}-`) ? s.id.slice(l.id.length + 1) : s.id
          return {
            id: code,
            name: s.name,
            deviceType: s.deviceType,
            stdCycleMs: s.stdCycleMs,
            stdHourly: Math.round(3_600_000 / Math.max(1, s.stdCycleMs))
          }
        })
      return { id: l.id, name: l.name, taktSec: l.taktSec, targetCount: l.targetCount, stations }
    })

  return {
    ...base,
    id: ws.id,
    name: ws.name,
    factoryId: ws.factoryId,
    factoryName: factory?.name ?? base.factoryName,
    lines
  }
}
