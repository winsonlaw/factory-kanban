/**
 * 快照存储 —— 最新 WorkshopData 的实时缓存。
 *   memory：纯内存（默认，免基础设施）
 *   real：  Redis（多实例共享、WebSocket 扇出）
 * 时序留存（TDengine）与业务库（PostgreSQL）属另一层，骨架见 storage/README。
 */

import { createRequire } from 'node:module'
import { config } from '../config.js'
import type { WorkshopData } from '../view/types.js'

export interface SnapshotStore {
  set(id: string, data: WorkshopData): Promise<void>
  get(id: string): Promise<WorkshopData | null>
}

class MemorySnapshotStore implements SnapshotStore {
  private map = new Map<string, WorkshopData>()
  async set(id: string, data: WorkshopData): Promise<void> {
    this.map.set(id, data)
  }
  async get(id: string): Promise<WorkshopData | null> {
    return this.map.get(id) ?? null
  }
}

class RedisSnapshotStore implements SnapshotStore {
  private redis: import('ioredis').Redis
  constructor() {
    // 动态加载，仅 real 模式需要 ioredis 依赖
    const require = createRequire(import.meta.url)
    const Redis = require('ioredis') as typeof import('ioredis').default
    this.redis = new Redis(config.redis.url)
  }
  async set(id: string, data: WorkshopData): Promise<void> {
    await this.redis.set(`workshop:${id}`, JSON.stringify(data), 'EX', 30)
  }
  async get(id: string): Promise<WorkshopData | null> {
    const v = await this.redis.get(`workshop:${id}`)
    return v ? (JSON.parse(v) as WorkshopData) : null
  }
}

export function createSnapshotStore(): SnapshotStore {
  return config.storage === 'real' ? new RedisSnapshotStore() : new MemorySnapshotStore()
}
