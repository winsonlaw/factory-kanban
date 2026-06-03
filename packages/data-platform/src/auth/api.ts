/**
 * 鉴权 API + 路由守卫中间件。
 *
 * 守卫规则（onRequest 钩子）：
 *   公开：/health, /api/workshop/*, /ws/*, /mes/webhook/*, /api/config/gateway/*（机器端）, POST /api/auth/login
 *   需登录：GET /api/config/*（viewer+）、GET /api/auth/me
 *   需运维+：写 /api/config/*（POST/PUT/DELETE）
 *   需管理员：/api/auth/users*
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
import { signToken, verifyToken, type JwtPayload } from './jwt.js'
import { UserStore, verifyPassword } from './store.js'
import { toSafe, type Role } from './types.js'

function getAuth(req: FastifyRequest): JwtPayload | null {
  const h = req.headers['authorization']
  if (!h || !h.startsWith('Bearer ')) return null
  return verifyToken(h.slice(7), config.auth.secret)
}

/** 判断某请求需要的最低权限：null=公开，'viewer'/'ops'/'admin'=对应角色门槛。 */
function requiredRole(method: string, url: string): Role | null {
  const path = url.split('?')[0] ?? url
  if (path.startsWith('/api/config/gateway/')) return null // 机器端（边缘网关拉配置）
  if (path === '/api/auth/login') return null
  if (path.startsWith('/api/auth/users')) return 'admin'
  if (path.startsWith('/api/auth')) return 'viewer' // /me
  if (path.startsWith('/api/config')) return method === 'GET' ? 'viewer' : 'ops'
  return null // 其余公开（health/workshop/ws/mes webhook）
}

const ROLE_RANK: Record<Role, number> = { viewer: 1, ops: 2, admin: 3 }

export function registerAuth(app: FastifyInstance, users: UserStore): void {
  // 路由守卫
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const need = requiredRole(req.method, req.url)
    if (!need) return
    const auth = getAuth(req)
    if (!auth) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: '请先登录' } })
    if (ROLE_RANK[auth.role as Role] < ROLE_RANK[need]) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: '权限不足' } })
    }
    ;(req as FastifyRequest & { auth?: JwtPayload }).auth = auth
  })

  // 登录
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string }
    const u = username ? users.findByUsername(username) : undefined
    if (!u || !password || !verifyPassword(password, u.passHash)) {
      return reply.code(401).send({ error: { code: 'BAD_CREDENTIALS', message: '用户名或密码错误' } })
    }
    const token = signToken({ sub: u.username, role: u.role, name: u.name }, config.auth.secret)
    return { token, user: toSafe(u) }
  })

  // 当前用户
  app.get('/api/auth/me', async (req) => {
    const auth = (req as FastifyRequest & { auth?: JwtPayload }).auth!
    return { username: auth.sub, role: auth.role, name: auth.name }
  })

  // 用户管理（管理员）
  app.get('/api/auth/users', async () => users.list().map(toSafe))

  app.post('/api/auth/users', async (req, reply) => {
    const b = req.body as { id: string; username: string; name: string; role: Role; password: string }
    if (!b.id || !b.username || !b.password) {
      return reply.code(400).send({ error: { code: 'SCHEMA_MISMATCH', message: '缺少必填字段' } })
    }
    return toSafe(users.create(b))
  })

  app.put('/api/auth/users/:id', async (req) => {
    const { id } = req.params as { id: string }
    const updated = users.update(id, req.body as Record<string, never>)
    return updated ? toSafe(updated) : { error: { code: 'NOT_FOUND' } }
  })

  app.delete('/api/auth/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    if (id === 'admin') return reply.code(400).send({ error: { code: 'PROTECTED', message: '不可删除内置管理员' } })
    return { deleted: users.remove(id) }
  })
}
