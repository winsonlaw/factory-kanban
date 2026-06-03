/**
 * 用户存储 —— 文件持久化（JSON），免数据库。种子内置三个默认账号。
 * 密码用 scrypt 加盐哈希存储，绝不明文落盘。
 */

import crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Role, User } from './types.js'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const calc = crypto.scryptSync(password, salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

function seed(): User[] {
  const mk = (username: string, name: string, role: Role, pw: string): User => ({
    id: username,
    username,
    name,
    role,
    passHash: hashPassword(pw)
  })
  return [
    mk('admin', '系统管理员', 'admin', 'admin123'),
    mk('ops', '运维员', 'ops', 'ops123'),
    mk('viewer', '只读用户', 'viewer', 'viewer123')
  ]
}

export class UserStore {
  private users: User[]

  constructor(private file?: string) {
    if (file && existsSync(file)) {
      try {
        this.users = JSON.parse(readFileSync(file, 'utf8')) as User[]
      } catch {
        this.users = seed()
      }
    } else {
      this.users = seed()
      this.persist()
    }
  }

  private persist(): void {
    if (!this.file) return
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.users, null, 2))
    } catch (err) {
      console.error('[auth] persist failed:', (err as Error).message)
    }
  }

  findByUsername(username: string): User | undefined {
    return this.users.find((u) => u.username === username)
  }

  list(): User[] {
    return this.users
  }

  create(u: Omit<User, 'passHash'> & { password: string }): User {
    const user: User = { id: u.id, username: u.username, name: u.name, role: u.role, passHash: hashPassword(u.password) }
    this.users.push(user)
    this.persist()
    return user
  }

  update(id: string, patch: Partial<Omit<User, 'passHash'>> & { password?: string }): User | undefined {
    const u = this.users.find((x) => x.id === id)
    if (!u) return undefined
    if (patch.name !== undefined) u.name = patch.name
    if (patch.role !== undefined) u.role = patch.role
    if (patch.password) u.passHash = hashPassword(patch.password)
    this.persist()
    return u
  }

  remove(id: string): boolean {
    const idx = this.users.findIndex((x) => x.id === id)
    if (idx < 0) return false
    this.users.splice(idx, 1)
    this.persist()
    return true
  }
}
