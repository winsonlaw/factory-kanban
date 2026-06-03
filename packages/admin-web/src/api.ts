/**
 * 配置 API 客户端 —— 调用 data-platform 的 /api/config/*。
 * 基址由 VITE_API_BASE 配置，默认 http://localhost:8080。
 */

import type { ConfigData, EntityKey } from './types'
import { getToken, type AuthUser } from './auth'

const BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ??
  'http://localhost:8080'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  })
  if (res.status === 401 && path !== '/api/auth/login') {
    window.dispatchEvent(new Event('auth:expired')) // 登录过期 → 统一登出
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const authApi = {
  login: (username: string, password: string) =>
    req<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  listUsers: () => req<AuthUser[]>('/api/auth/users'),
  createUser: (u: AuthUser & { password: string }) =>
    req<AuthUser>('/api/auth/users', { method: 'POST', body: JSON.stringify(u) }),
  updateUser: (id: string, patch: Partial<AuthUser> & { password?: string }) =>
    req<AuthUser>(`/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  removeUser: (id: string) => req<{ deleted: boolean }>(`/api/auth/users/${id}`, { method: 'DELETE' })
}

export const api = {
  snapshot: () => req<ConfigData>('/api/config/snapshot'),

  list: <K extends EntityKey>(entity: K) => req<ConfigData[K]>(`/api/config/${entity}`),

  create: <K extends EntityKey>(entity: K, item: ConfigData[K][number]) =>
    req<ConfigData[K][number]>(`/api/config/${entity}`, {
      method: 'POST',
      body: JSON.stringify(item)
    }),

  update: <K extends EntityKey>(entity: K, id: string, patch: Partial<ConfigData[K][number]>) =>
    req<ConfigData[K][number]>(`/api/config/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch)
    }),

  remove: (entity: EntityKey, id: string) =>
    req<{ deleted: boolean }>(`/api/config/${entity}/${id}`, { method: 'DELETE' })
}
