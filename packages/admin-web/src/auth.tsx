/**
 * 前端鉴权上下文 —— 登录态、当前用户、角色权限；token 存 localStorage。
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Role = 'admin' | 'ops' | 'viewer'

export const ROLE_LABELS: Record<Role, string> = {
  admin: '厂区管理员',
  ops: '运维',
  viewer: '只读'
}

export interface AuthUser {
  id?: string
  username: string
  name: string
  role: Role
}

const TOKEN_KEY = 'fk_token'
const USER_KEY = 'fk_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

interface AuthCtx {
  user: AuthUser | null
  canWrite: boolean
  isAdmin: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })

  useEffect(() => {
    // token 过期/失效时由 api 层派发，统一登出
    const onExpired = () => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setUser(null)
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      canWrite: user?.role === 'admin' || user?.role === 'ops',
      isAdmin: user?.role === 'admin',
      login: (token, u) => {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(USER_KEY, JSON.stringify(u))
        setUser(u)
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setUser(null)
      }
    }),
    [user]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  return useContext(Ctx)
}
