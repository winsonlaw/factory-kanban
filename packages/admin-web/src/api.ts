/**
 * 配置 API 客户端 —— 调用 data-platform 的 /api/config/*。
 * 基址由 VITE_API_BASE 配置，默认 http://localhost:8080。
 */

import type { ConfigData, EntityKey } from './types'

const BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ??
  'http://localhost:8080'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
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
