/**
 * 日级历史 —— 过渡实现：确定性生成近 N 天日报（按日索引种子，贴合产能）。
 * 今日取实时数据，历史日为确定性派生。接 TDengine 后由其日聚合替换（接口不变）。
 */

export interface DailyRow {
  date: string // YYYY-MM-DD
  outputQty: number
  targetQty: number
  attainment: number // 0-1
  oee: number // 0-1
  goodRate: number // 0-1
  downtimeLossAmount: number
  qualityLossAmount: number
  partial?: boolean // 今日（进行中）
}

/** 确定性伪随机：同一日索引恒定，重启/多次请求一致。 */
function sfrac(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function generateDailyHistory(
  days: number,
  dailyTargetQty: number,
  costPerUnit: number,
  today: { outputQty: number; oee: number; goodRate: number; downtimeLossAmount: number; qualityLossAmount: number },
  now = Date.now()
): DailyRow[] {
  const dayMs = 86_400_000
  const todayIdx = Math.floor(now / dayMs)
  const rows: DailyRow[] = []
  for (let i = days - 1; i >= 0; i--) {
    const idx = todayIdx - i
    const date = new Date(idx * dayMs).toISOString().slice(0, 10)
    if (i === 0) {
      const attainment = dailyTargetQty > 0 ? today.outputQty / dailyTargetQty : 0
      rows.push({
        date,
        outputQty: today.outputQty,
        targetQty: dailyTargetQty,
        attainment,
        oee: today.oee,
        goodRate: today.goodRate,
        downtimeLossAmount: today.downtimeLossAmount, // 今日取实时累计，而非缺口估算
        qualityLossAmount: today.qualityLossAmount,
        partial: true
      })
      continue
    }
    const a = 0.8 + sfrac(idx) * 0.18 // 达成率 80%~98%
    const outputQty = Math.round(dailyTargetQty * a)
    const oee = 0.74 + sfrac(idx + 7) * 0.17 // 74%~91%
    const goodRate = 0.965 + sfrac(idx + 13) * 0.03 // 96.5%~99.5%
    rows.push({
      date,
      outputQty,
      targetQty: dailyTargetQty,
      attainment: a,
      oee,
      goodRate,
      downtimeLossAmount: Math.round((dailyTargetQty - outputQty) * 0.4 * costPerUnit),
      qualityLossAmount: Math.round(outputQty * (1 - goodRate) * costPerUnit)
    })
  }
  return rows
}
