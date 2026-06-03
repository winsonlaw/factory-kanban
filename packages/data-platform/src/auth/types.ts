/**
 * 鉴权域模型 —— 用户 / 角色 / 权限。
 * 角色：admin 厂区管理员（全权，含用户管理）· ops 运维（读写配置）· viewer 只读。
 */

export type Role = 'admin' | 'ops' | 'viewer'

export const ROLE_LABELS: Record<Role, string> = {
  admin: '厂区管理员',
  ops: '运维',
  viewer: '只读'
}

export interface User {
  id: string
  username: string
  name: string
  role: Role
  passHash: string // 形如 salt:hash（scrypt）
}

/** 对外用户视图（不含密码）。 */
export type SafeUser = Omit<User, 'passHash'>

export function toSafe(u: User): SafeUser {
  const { passHash: _omit, ...safe } = u
  return safe
}

/** 可写配置（新建/编辑/删除）：管理员与运维。 */
export function canWrite(role: Role): boolean {
  return role === 'admin' || role === 'ops'
}

/** 可管理用户：仅管理员。 */
export function canManageUsers(role: Role): boolean {
  return role === 'admin'
}
