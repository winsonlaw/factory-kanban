/**
 * OEE 计算 —— 可用率 A × 表现率 P × 质量率 Q。
 * 纯函数，输入聚合量，输出 0-1 比率。口径见《数据采集清单与数据结构》。
 */

export interface OeeInput {
  plannedRuntimeMs: number // 计划运行时间（班次有效时长 - 计划停机）
  actualRuntimeMs: number // 实际运行时间（运行状态累计）
  totalCount: number // 总产出（良 + 不良）
  goodCount: number // 良品数
  idealCycleMs: number // 理论/标准节拍
}

export interface OeeResult {
  oee: number
  availability: number
  performance: number
  quality: number
}

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0
  return v > 1 ? 1 : v
}

export function computeOee(i: OeeInput): OeeResult {
  const availability = i.plannedRuntimeMs > 0 ? clamp01(i.actualRuntimeMs / i.plannedRuntimeMs) : 0
  const performance =
    i.actualRuntimeMs > 0 ? clamp01((i.totalCount * i.idealCycleMs) / i.actualRuntimeMs) : 0
  const quality = i.totalCount > 0 ? clamp01(i.goodCount / i.totalCount) : 0
  return {
    availability,
    performance,
    quality,
    oee: clamp01(availability * performance * quality)
  }
}
