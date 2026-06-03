/**
 * HTTP + WebSocket 服务（Fastify）。
 *   GET  /health                     健康检查
 *   GET  /api/workshop/:id           取最新快照（REST 兜底）
 *   WS   /ws/workshop/:id            实时快照推送（大屏订阅）
 *   POST /mes/webhook/orders         MES 工单变更入站（HMAC 验签）
 *   POST /mes/webhook/material       缺料预警入站
 */

import crypto from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import { config } from './config.js'
import { mesOrderChangeNoticeSchema } from './contracts/schemas.js'
import { registerConfigApi } from './config-domain/api.js'
import { registerAuth } from './auth/api.js'
import { UserStore } from './auth/store.js'
import type { ConfigStore } from './config-domain/store.js'
import type { Aggregator } from './state/aggregator.js'
import type { SnapshotStore } from './storage/snapshot-store.js'
import type { WorkshopData } from './view/types.js'

/** 每个车间维护一组 WS 订阅者。 */
type Socket = { send: (data: string) => void }

export class ServerApp {
  private fastify: FastifyInstance
  private subscribers = new Map<string, Set<Socket>>()

  constructor(
    private agg: Aggregator,
    private store: SnapshotStore,
    private configStore: ConfigStore
  ) {
    this.fastify = Fastify({ logger: false })
  }

  /** 广播最新快照给该车间所有订阅者，并写入快照存储。 */
  async broadcast(data: WorkshopData): Promise<void> {
    await this.store.set(data.id, data)
    const subs = this.subscribers.get(data.id)
    if (!subs || subs.size === 0) return
    const msg = JSON.stringify({ type: 'workshop', data })
    for (const s of subs) {
      try {
        s.send(msg)
      } catch {
        subs.delete(s)
      }
    }
  }

  private verifySignature(raw: string, signature: string | undefined): boolean {
    if (!signature) return false
    const expected = crypto
      .createHmac('sha256', config.mes.webhookSecret)
      .update(raw)
      .digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  async listen(): Promise<void> {
    await this.fastify.register(cors, { origin: true }) // admin-web 跨域访问
    await this.fastify.register(websocket)

    this.fastify.get('/health', async () => ({ ok: true, ts: Date.now() }))

    // 鉴权：路由守卫 + 登录/用户管理（须在受保护路由之前注册）
    registerAuth(this.fastify, new UserStore(config.auth.file))

    // 配置域 CRUD API（admin-web 管理后台）
    registerConfigApi(this.fastify, this.configStore)

    this.fastify.get('/api/workshop/:id', async (req, reply) => {
      const { id } = req.params as { id: string }
      const data = await this.store.get(id)
      if (!data) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: id } })
      return data
    })

    // MES 工单变更 Webhook（入站，验签）
    this.fastify.post('/mes/webhook/orders', async (req, reply) => {
      const raw = JSON.stringify(req.body)
      const sig = req.headers['x-signature'] as string | undefined
      if (config.mes.mode === 'rest' && !this.verifySignature(raw, sig)) {
        return reply.code(401).send({ error: { code: 'SIGNATURE_INVALID', message: 'bad signature' } })
      }
      const parsed = mesOrderChangeNoticeSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'SCHEMA_MISMATCH', message: parsed.error.message } })
      }
      // 单工单变更：合并进现有工单集（简化为重新 setOrders 单条）
      this.agg.setOrders([parsed.data.order])
      return { accepted: true, noticeId: parsed.data.noticeId }
    })

    // WebSocket：大屏订阅某车间
    this.fastify.get('/ws/workshop/:id', { websocket: true }, (socket, req) => {
      const { id } = req.params as { id: string }
      const set = this.subscribers.get(id) ?? new Set<Socket>()
      const sock: Socket = { send: (d) => socket.send(d) }
      set.add(sock)
      this.subscribers.set(id, set)

      // 连接即推一帧当前快照
      void this.store.get(id).then((snap) => {
        if (snap) socket.send(JSON.stringify({ type: 'workshop', data: snap }))
      })

      socket.on('close', () => set.delete(sock))
      socket.on('error', () => set.delete(sock))
    })

    await this.fastify.listen({ host: config.http.host, port: config.http.port })
    console.log(`[http] listening on http://${config.http.host}:${config.http.port}`)
    console.log(`[ws]   workshop stream at ws://${config.http.host}:${config.http.port}/ws/workshop/W01`)
  }

  async close(): Promise<void> {
    await this.fastify.close()
  }
}
