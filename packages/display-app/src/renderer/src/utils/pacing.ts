import type { PacingResult } from '../types'

/**
 * 计算 Pacing —— 看板的灵魂指标，回答"我们落后了吗"
 * @param shiftStartTs 班次开始时间戳
 * @param shiftDurationH 班次时长(小时)
 * @param taktSec 产距时间 Takt(秒)
 * @param actual 实产数
 * @param targetCount 当班计划产量
 * @param nowTs 当前时间戳（传入便于统一刷新）
 */
export function calcPacing(
  shiftStartTs: number,
  shiftDurationH: number,
  taktSec: number,
  actual: number,
  targetCount: number,
  nowTs: number
): PacingResult {
  const elapsedSec = Math.max(0, (nowTs - shiftStartTs) / 1000)
  // 应产 = 已过时间/Takt，但不超过当班计划
  const shouldProduce = Math.min(targetCount, Math.floor(elapsedSec / taktSec))
  const delta = actual - shouldProduce
  const behindMin = delta < 0 ? Math.round((-delta * taktSec) / 60) : 0
  const aheadMin = delta > 0 ? Math.round((delta * taktSec) / 60) : 0

  const remainingQty = Math.max(0, targetCount - actual)
  const shiftEndTs = shiftStartTs + shiftDurationH * 3600 * 1000
  const remainingMin = Math.max(0, (shiftEndTs - nowTs) / 60000)
  const requiredRate = remainingMin > 0
    ? Math.round(remainingQty / (remainingMin / 60))
    : remainingQty

  return {
    shouldProduce,
    actual,
    delta,
    behindMin,
    aheadMin,
    remainingQty,
    requiredRate,
    onTrack: delta >= 0
  }
}

/** 毫秒时长 → "MM:SS" 或 "H:MM:SS" */
export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
