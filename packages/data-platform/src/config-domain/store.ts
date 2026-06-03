/**
 * 配置库存储 —— 通用 CRUD，文件持久化（JSON），免数据库即可保存。
 *   · 默认从种子初始化，加载已有文件则覆盖
 *   · 每次写操作落盘，admin-web 的修改重启后仍在
 *   · 生产环境可替换为 PostgreSQL 实现（表结构见 docker/postgres/init.sql）
 *
 * 每个实体集合用 `id`（字典域用 `code`）作主键。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildSeed } from './seed.js'
import type { ConfigData, EntityKey } from './types.js'

/** 各实体的主键字段。 */
const PRIMARY_KEY: Partial<Record<EntityKey, string>> = {
  defectCodes: 'code',
  alarmCodes: 'code',
  deviceProfiles: 'key'
}
function pk(entity: EntityKey): string {
  return PRIMARY_KEY[entity] ?? 'id'
}

export class ConfigStore {
  private data: ConfigData
  private ready = false
  private listeners: Array<() => void> = []

  constructor(private file?: string) {
    if (file && existsSync(file)) {
      try {
        this.data = JSON.parse(readFileSync(file, 'utf8')) as ConfigData
        console.log(`[config] loaded from ${file}`)
      } catch {
        this.data = buildSeed()
      }
    } else {
      this.data = buildSeed()
      this.persist()
    }
    this.ready = true
  }

  /** 订阅配置变更（任何写操作后触发），用于运行时热重载。 */
  onChange(cb: () => void): void {
    this.listeners.push(cb)
  }

  private persist(): void {
    if (this.file) {
      try {
        mkdirSync(dirname(this.file), { recursive: true })
        writeFileSync(this.file, JSON.stringify(this.data, null, 2))
      } catch (err) {
        console.error('[config] persist failed:', (err as Error).message)
      }
    }
    if (this.ready) for (const cb of this.listeners) cb()
  }

  // ───────────── 通用 CRUD ─────────────

  list<K extends EntityKey>(entity: K): ConfigData[K] {
    return this.data[entity]
  }

  get<K extends EntityKey>(entity: K, id: string): ConfigData[K][number] | undefined {
    const key = pk(entity)
    return (this.data[entity] as unknown as Array<Record<string, unknown>>).find(
      (x) => x[key] === id
    ) as ConfigData[K][number] | undefined
  }

  create<K extends EntityKey>(entity: K, item: ConfigData[K][number]): ConfigData[K][number] {
    ;(this.data[entity] as Array<unknown>).push(item)
    this.persist()
    return item
  }

  update<K extends EntityKey>(
    entity: K,
    id: string,
    patch: Partial<ConfigData[K][number]>
  ): ConfigData[K][number] | undefined {
    const key = pk(entity)
    const arr = this.data[entity] as unknown as Array<Record<string, unknown>>
    const idx = arr.findIndex((x) => x[key] === id)
    if (idx < 0) return undefined
    arr[idx] = { ...arr[idx], ...patch }
    this.persist()
    return arr[idx] as unknown as ConfigData[K][number]
  }

  remove<K extends EntityKey>(entity: K, id: string): boolean {
    const key = pk(entity)
    const arr = this.data[entity] as unknown as Array<Record<string, unknown>>
    const idx = arr.findIndex((x) => x[key] === id)
    if (idx < 0) return false
    arr.splice(idx, 1)
    this.persist()
    this.cascadeDelete(entity, id)
    return true
  }

  /** 级联删除：删上级时清理下级引用，保持配置一致。 */
  private cascadeDelete(entity: EntityKey, id: string): void {
    if (entity === 'lines') {
      for (const s of this.data.stations.filter((s) => s.lineId === id)) this.remove('stations', s.id)
    } else if (entity === 'stations') {
      for (const c of this.data.collectors.filter((c) => c.stationId === id)) this.remove('collectors', c.id)
    } else if (entity === 'collectors') {
      this.data.channels = this.data.channels.filter((c) => c.collectorId !== id)
      this.data.dataPoints = this.data.dataPoints.filter((d) => d.collectorId !== id)
      this.persist()
    } else if (entity === 'workshops') {
      for (const l of this.data.lines.filter((l) => l.workshopId === id)) this.remove('lines', l.id)
    }
  }

  /** 整库快照（admin-web 首屏一次拉全）。 */
  snapshot(): ConfigData {
    return this.data
  }

  /** 某网关下的采集配置（edge-gateway 拉取生效用）。 */
  collectorsForGateway(gatewayId: string): {
    collector: ConfigData['collectors'][number]
    channel?: ConfigData['channels'][number]
    points: ConfigData['dataPoints']
  }[] {
    return this.data.collectors
      .filter((c) => c.gatewayId === gatewayId && c.enabled)
      .map((collector) => ({
        collector,
        channel: this.data.channels.find((ch) => ch.collectorId === collector.id),
        points: this.data.dataPoints.filter((d) => d.collectorId === collector.id)
      }))
  }
}
