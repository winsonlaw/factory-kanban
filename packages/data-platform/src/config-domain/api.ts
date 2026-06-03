/**
 * 配置域 REST API —— admin-web 调用的 CRUD 接口。
 *   GET    /api/config/snapshot                整库快照（首屏）
 *   GET    /api/config/:entity                 列表
 *   GET    /api/config/:entity/:id             单条
 *   POST   /api/config/:entity                 新建
 *   PUT    /api/config/:entity/:id             更新
 *   DELETE /api/config/:entity/:id             删除（级联清理下级）
 *   GET    /api/config/gateway/:id/collectors  某网关采集配置（edge-gateway 拉取）
 */

import type { FastifyInstance } from 'fastify'
import type { ConfigStore } from './store.js'
import type { ConfigData, EntityKey } from './types.js'

const ENTITIES: EntityKey[] = [
  'factories', 'workshops', 'lines', 'stations', 'deviceProfiles',
  'gateways', 'collectors', 'channels', 'dataPoints',
  'defectCodes', 'alarmCodes', 'shifts', 'targets', 'thresholds'
]

function isEntity(x: string): x is EntityKey {
  return (ENTITIES as string[]).includes(x)
}

export function registerConfigApi(app: FastifyInstance, store: ConfigStore): void {
  app.get('/api/config/snapshot', async () => store.snapshot())

  app.get('/api/config/gateway/:id/collectors', async (req) => {
    const { id } = req.params as { id: string }
    return store.collectorsForGateway(id)
  })

  app.get('/api/config/:entity', async (req, reply) => {
    const { entity } = req.params as { entity: string }
    if (!isEntity(entity)) return reply.code(404).send({ error: { code: 'UNKNOWN_ENTITY', message: entity } })
    return store.list(entity)
  })

  app.get('/api/config/:entity/:id', async (req, reply) => {
    const { entity, id } = req.params as { entity: string; id: string }
    if (!isEntity(entity)) return reply.code(404).send({ error: { code: 'UNKNOWN_ENTITY', message: entity } })
    const item = store.get(entity, id)
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: id } })
    return item
  })

  app.post('/api/config/:entity', async (req, reply) => {
    const { entity } = req.params as { entity: string }
    if (!isEntity(entity)) return reply.code(404).send({ error: { code: 'UNKNOWN_ENTITY', message: entity } })
    const body = req.body as ConfigData[EntityKey][number]
    return store.create(entity, body)
  })

  app.put('/api/config/:entity/:id', async (req, reply) => {
    const { entity, id } = req.params as { entity: string; id: string }
    if (!isEntity(entity)) return reply.code(404).send({ error: { code: 'UNKNOWN_ENTITY', message: entity } })
    const updated = store.update(entity, id, req.body as Partial<ConfigData[EntityKey][number]>)
    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: id } })
    return updated
  })

  app.delete('/api/config/:entity/:id', async (req, reply) => {
    const { entity, id } = req.params as { entity: string; id: string }
    if (!isEntity(entity)) return reply.code(404).send({ error: { code: 'UNKNOWN_ENTITY', message: entity } })
    const ok = store.remove(entity, id)
    if (!ok) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: id } })
    return { deleted: true }
  })
}
