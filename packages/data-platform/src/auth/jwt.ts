/**
 * 极简 JWT（HS256）—— 无第三方依赖，用 node crypto 签发/校验。
 * 仅用于本系统内部鉴权；payload 含 sub(用户名)、role、exp。
 */

import crypto from 'node:crypto'

export interface JwtPayload {
  sub: string // 用户名
  role: string
  name: string
  exp: number // 过期 epoch 秒
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

export function signToken(payload: Omit<JwtPayload, 'exp'>, secret: string, ttlSec = 8 * 3600): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const body = b64url(JSON.stringify({ ...payload, exp }))
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts as [string, string, string]
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload
    if (payload.exp * 1000 < Date.now()) return null // 已过期
    return payload
  } catch {
    return null
  }
}
