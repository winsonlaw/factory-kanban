/** 经营派生指标 —— 由 workshop 数据算 Pacing、红黑榜。 */

import type { WorkshopData } from './types'

export interface Pacing {
  shouldQty: number // 应产
  actualQty: number // 实产
  behindQty: number // 欠产（>0 表示欠）
  behindMin: number // 落后分钟
  ratio: number // 实产/应产
  level: 'green' | 'yellow' | 'red'
}

export function computePacing(w: WorkshopData, now = Date.now()): Pacing {
  const elapsedSec = Math.max(0, (now - w.shiftStartTs) / 1000)
  let should = 0
  let actual = 0
  let behindMin = 0
  for (const l of w.lines) {
    const lineShould = l.taktSec > 0 ? Math.floor(elapsedSec / l.taktSec) : 0
    should += lineShould
    actual += l.passCount
    const behind = lineShould - l.passCount
    if (behind > 0) behindMin += (behind * l.taktSec) / 60
  }
  const ratio = should > 0 ? actual / should : 1
  const level: Pacing['level'] = ratio >= 1 ? 'green' : ratio >= 0.9 ? 'yellow' : 'red'
  return {
    shouldQty: should,
    actualQty: actual,
    behindQty: Math.max(0, should - actual),
    behindMin: Math.round(behindMin),
    ratio,
    level
  }
}

export interface RankRow {
  id: string
  name: string
  attainPct: number // 实产/目标
  delta: number // 实产-应产（超/欠）
  status: WorkshopData['lines'][number]['status']
}

export function ranking(w: WorkshopData, now = Date.now()): RankRow[] {
  const elapsedSec = Math.max(0, (now - w.shiftStartTs) / 1000)
  return w.lines
    .map((l) => {
      const lineShould = l.taktSec > 0 ? Math.floor(elapsedSec / l.taktSec) : 0
      return {
        id: l.id,
        name: l.name,
        attainPct: l.targetCount > 0 ? l.passCount / l.targetCount : 0,
        delta: l.passCount - lineShould,
        status: l.status
      }
    })
    .sort((a, b) => b.attainPct - a.attainPct)
}

// ───────────── 格式化 ─────────────

export function yuan(n: number): string {
  if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${Math.round(n)}`
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export const LEVEL_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#00b96b',
  yellow: '#faad14',
  red: '#ff4d4f'
}

export function statusColor(s: string): string {
  return s === 'running' ? '#00b96b' : s === 'alarm' ? '#ff4d4f' : s === 'stopped' ? '#999' : '#faad14'
}

export function statusText(s: string): string {
  return s === 'running' ? '运行' : s === 'alarm' ? '报警' : s === 'stopped' ? '停机' : '待机'
}
