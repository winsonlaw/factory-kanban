/**
 * Pacing 计算 —— 回答「我们落后了吗」。看板最该放 C 位的概念。
 * 应产 = (now - 班次开始) / Takt；欠产 = 实产 - 应产；落后分钟 = |欠产| × Takt。
 */

export interface PacingInput {
  shiftStartTs: number // 班次开始 epoch ms
  now: number // 当前 epoch ms
  taktSec: number // 产距时间（秒）= 可用时间 / 计划量
  actual: number // 实产（良品）
  targetCount: number // 当班计划产量
}

export interface PacingResult {
  shouldProduce: number // 应产数
  actual: number
  delta: number // 正=超产 负=欠产
  behindMin: number // 落后分钟（delta<0）
  aheadMin: number // 领先分钟（delta>0）
  remainingQty: number // 距目标剩余件数
  requiredRate: number // 需提速到 件/小时（剩余时间内打平目标）
  onTrack: boolean
}

export function computePacing(i: PacingInput): PacingResult {
  const elapsedSec = Math.max(0, (i.now - i.shiftStartTs) / 1000)
  const shouldProduce = i.taktSec > 0 ? Math.floor(elapsedSec / i.taktSec) : 0
  const delta = i.actual - shouldProduce
  const behindMin = delta < 0 ? Math.round((-delta * i.taktSec) / 60) : 0
  const aheadMin = delta > 0 ? Math.round((delta * i.taktSec) / 60) : 0

  const remainingQty = Math.max(0, i.targetCount - i.actual)
  // 剩余时间 = 班次总时长 - 已用；班次总时长 = 目标 × Takt
  const shiftTotalSec = i.targetCount * i.taktSec
  const remainingSec = Math.max(1, shiftTotalSec - elapsedSec)
  const requiredRate = Math.round((remainingQty / remainingSec) * 3600)

  return {
    shouldProduce,
    actual: i.actual,
    delta,
    behindMin,
    aheadMin,
    remainingQty,
    requiredRate,
    onTrack: delta >= 0
  }
}
