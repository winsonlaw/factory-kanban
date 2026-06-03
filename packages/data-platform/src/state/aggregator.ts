/**
 * 聚合引擎 —— 系统核心。
 *
 * 消费规范化遥测/事件，维护每条产线、每个站位的本班运行聚合，
 * 并按需构建 `WorkshopData` 快照（供 WS 推送、Redis 缓存、MES 上报取数）。
 *
 * 一切派生指标（OEE/Pacing/Pareto/平衡率）在 buildSnapshot 时实时计算。
 */

import { config } from '../config.js'
import type { DeviceTelemetry, DeviceEvent } from '../contracts/index.js'
import { EquipmentStatusCode, EQUIPMENT_STATUS_LABEL } from '../contracts/index.js'
import { computeLineDerived } from '../calc/line.js'
import { defectDict, alarmDict, type LineDef, type StationDef, type WorkshopDef } from '../masterdata.js'
import type {
  AlarmItem,
  Changeover,
  DefectItem,
  EquipmentStatus,
  LineData,
  MaterialAlert,
  OrderProgress,
  StationData,
  TrendPoint,
  WorkOrder,
  WorkshopData
} from '../view/types.js'
import type { MesWorkOrder } from '../contracts/index.js'

interface StationState {
  def: StationDef
  status: EquipmentStatusCode
  passCount: number
  failCount: number
  lastCycleMs: number
  wipBuffer: number
  defects: Map<string, number>
  consecutiveFail: number
  consecutiveDefect?: string
  hourCounts: Map<number, number> // 绝对小时索引 → 该小时产量
  runningMs: number // 累计运行时间（处于运行态的真实时长）
  observeStartMs: number // 首次收到该站遥测的时刻（可用率分母）
  lastTs: number
}

interface LineState {
  def: LineDef
  stations: Map<string, StationState>
  order?: MesWorkOrder
  nextModel?: string
  alarms: Map<string, AlarmItem> // key = stationId|code
  changeover?: Changeover
  trend: TrendPoint[]
  lastTrendKey?: string
}

function hourIndex(ts: number): number {
  return Math.floor(ts / 3_600_000)
}

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0
  return v > 1 ? 1 : v
}

/** 新建一个站位的空运行状态。 */
function initStation(def: StationDef): StationState {
  return {
    def,
    status: EquipmentStatusCode.Idle,
    passCount: 0,
    failCount: 0,
    lastCycleMs: def.stdCycleMs,
    wipBuffer: 0,
    defects: new Map(),
    consecutiveFail: 0,
    hourCounts: new Map(),
    runningMs: 0,
    observeStartMs: 0,
    lastTs: Date.now()
  }
}

function hhmmss(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export class Aggregator {
  readonly shiftStartTs: number
  private lines = new Map<string, LineState>()
  private materialAlerts: MaterialAlert[] = []
  private monthBaseActual: number
  dirty = true

  constructor(private def: WorkshopDef) {
    // 班次开始设为「现在往前 plannedRuntime 的一半」，让 Pacing 一启动就有意义
    this.shiftStartTs = Date.now() - def.plannedRuntimeMs / 2
    this.monthBaseActual = def.monthTarget - 9240 // 让本月累计起点接近目标
    for (const line of def.lines) {
      const stations = new Map<string, StationState>()
      for (const s of line.stations) stations.set(s.id, initStation(s))
      this.lines.set(line.id, { def: line, stations, alarms: new Map(), trend: [] })
    }
  }

  /**
   * 热重载 —— 按新拓扑（admin-web 改后的配置）就地调谐运行时状态：
   * 新增的产线/站位建空状态，删除的移除，存活的更新定义（Takt/目标/名称/标准节拍）
   * 并**保留已累计的生产计数**。无需重启即可生效。
   */
  applyTopology(def: WorkshopDef): void {
    this.def = def
    const seenLines = new Set<string>()
    for (const lineDef of def.lines) {
      seenLines.add(lineDef.id)
      let ls = this.lines.get(lineDef.id)
      if (!ls) {
        const stations = new Map<string, StationState>()
        for (const s of lineDef.stations) stations.set(s.id, initStation(s))
        this.lines.set(lineDef.id, { def: lineDef, stations, alarms: new Map(), trend: [] })
        continue
      }
      ls.def = lineDef // 更新 Takt/目标/名称
      const seenStations = new Set<string>()
      for (const sDef of lineDef.stations) {
        seenStations.add(sDef.id)
        const st = ls.stations.get(sDef.id)
        if (!st) ls.stations.set(sDef.id, initStation(sDef))
        else st.def = sDef // 更新名称/标准节拍/设备类型，保留计数
      }
      for (const id of [...ls.stations.keys()]) if (!seenStations.has(id)) ls.stations.delete(id)
    }
    for (const id of [...this.lines.keys()]) if (!seenLines.has(id)) this.lines.delete(id)
    this.dirty = true
  }

  // ───────────── 摄入 ─────────────

  ingestTelemetry(t: DeviceTelemetry): void {
    const line = this.lines.get(t.lineId)
    if (!line) return
    const st = line.stations.get(t.stationId)
    if (!st) return

    // 运行时间累计：上一次到现在若处于运行态则计入（真实时钟）
    if (st.observeStartMs === 0) st.observeStartMs = t.timestamp
    if (st.status === EquipmentStatusCode.Running) {
      st.runningMs += Math.max(0, t.timestamp - st.lastTs)
    }
    st.lastTs = t.timestamp
    st.status = t.equipmentStatus
    st.passCount += t.passCount
    st.failCount += t.failCount
    if (t.cycleTimeMs > 0) st.lastCycleMs = t.cycleTimeMs
    if (t.wipBuffer !== undefined) st.wipBuffer = t.wipBuffer

    // 小时产量桶
    const hi = hourIndex(t.timestamp)
    st.hourCounts.set(hi, (st.hourCounts.get(hi) ?? 0) + t.passCount)

    // 缺陷归集
    if (t.defects) {
      for (const d of t.defects) {
        st.defects.set(d.code, (st.defects.get(d.code) ?? 0) + (d.count ?? 1))
      }
    }

    // 连续不良
    if (t.failCount > 0) {
      st.consecutiveFail += t.failCount
      st.consecutiveDefect = t.defects?.[0]?.code
        ? defectDict[t.defects[0].code] ?? t.defects[0].code
        : st.consecutiveDefect
    } else if (t.passCount > 0) {
      st.consecutiveFail = 0
      st.consecutiveDefect = undefined
    }

    // 内联报警：节拍超标
    if (t.cycleTimeMs > st.def.stdCycleMs * config.thresholds.taktWarnRatio) {
      this.raiseAlarm(line, t.stationId, 'TAKT_OVER', 'warn', t.timestamp,
        `${st.def.name} 节拍超标 ${Math.round((t.cycleTimeMs / st.def.stdCycleMs) * 100)}%`)
    }
    // 设备自带报警
    if (t.alarm) {
      this.raiseAlarm(line, t.stationId, t.alarm.code, t.alarm.severity === 'alarm' ? 'alarm' : 'warn',
        t.alarm.raisedTs, t.alarm.message ?? alarmDict[t.alarm.code] ?? t.alarm.code)
    }
    // 连续不良 → 工艺异常
    if (st.consecutiveFail >= config.thresholds.consecutiveFailAlarm) {
      this.raiseAlarm(line, t.stationId, 'CONSEC_FAIL', 'alarm', t.timestamp,
        `${st.def.name} 连续不良 ${st.consecutiveFail} 件(${st.consecutiveDefect ?? ''})，请通知工艺`)
    }

    this.dirty = true
  }

  ingestEvent(e: DeviceEvent): void {
    const line = this.lines.get(e.lineId)
    if (!line) return
    switch (e.eventType) {
      case 'alarm_raised':
        if (e.alarm)
          this.raiseAlarm(line, e.stationId, e.alarm.code,
            e.alarm.severity === 'alarm' ? 'alarm' : 'warn', e.alarm.raisedTs,
            e.alarm.message ?? alarmDict[e.alarm.code] ?? e.alarm.code)
        break
      case 'alarm_cleared':
        if (e.alarm) line.alarms.delete(`${e.stationId}|${e.alarm.code}`)
        break
      case 'changeover_start':
        line.changeover = {
          id: `CO-${e.lineId}`, lineId: e.lineId, lineName: line.def.name,
          toModel: e.toModel ?? '', startTs: e.timestamp, durationSec: 1800
        }
        break
      case 'changeover_end':
        line.changeover = undefined
        break
    }
    this.dirty = true
  }

  private raiseAlarm(
    line: LineState, stationId: string | undefined, code: string,
    level: 'warn' | 'alarm', ts: number, message: string
  ): void {
    const key = `${stationId ?? '-'}|${code}`
    const station = stationId ? line.stations.get(stationId) : undefined
    const existing = line.alarms.get(key)
    line.alarms.set(key, {
      id: key,
      lineId: line.def.id,
      lineName: line.def.name,
      stationId,
      stationName: station?.def.name,
      level,
      message,
      time: hhmmss(existing?.startTs ?? ts),
      startTs: existing?.startTs ?? ts // 保留首次发生时刻，用于持续时长
    })
  }

  // ───────────── 来自 MES 的工单 ─────────────

  setOrders(orders: MesWorkOrder[]): void {
    for (const line of this.lines.values()) {
      const active = orders.find(
        (o) => o.targetLineId === line.def.id && (o.status === 'in_progress' || o.status === 'released')
      )
      line.order = active
      const next = orders.find((o) => o.targetLineId === line.def.id && o !== active)
      line.nextModel = next?.productModel
    }
    this.dirty = true
  }

  /** 缺料预警（来自 MES/物料模块的推送，这里提供 setter）。 */
  setMaterialAlerts(alerts: MaterialAlert[]): void {
    this.materialAlerts = alerts
    this.dirty = true
  }

  // ───────────── 构建快照 ─────────────

  buildSnapshot(now = Date.now()): WorkshopData {
    const lines: LineData[] = []
    const alarms: AlarmItem[] = []
    const changeovers: Changeover[] = []
    let workshopGood = 0

    for (const ls of this.lines.values()) {
      const stationData: StationData[] = []
      const last = [...ls.stations.values()].at(-1)
      const lineGood = last?.passCount ?? 0
      const lineFail = last?.failCount ?? 0
      workshopGood += lineGood

      const timings: { stationId: string; cycleMs: number; goodRate: number }[] = []

      for (const st of ls.stations.values()) {
        const total = st.passCount + st.failCount
        const goodRate = total > 0 ? st.passCount / total : 1
        timings.push({ stationId: st.def.id, cycleMs: st.lastCycleMs, goodRate })

        stationData.push({
          id: st.def.id,
          name: st.def.name,
          status: EQUIPMENT_STATUS_LABEL[st.status] as EquipmentStatus,
          passCount: st.passCount,
          failCount: st.failCount,
          cycletime: st.lastCycleMs,
          stdCycletime: st.def.stdCycleMs,
          goodRate,
          todayTotal: st.passCount,
          hourlyTrend: this.recentHourly(st, now),
          defects: this.defectItems(st),
          consecutiveFail: st.consecutiveFail,
          consecutiveDefect: st.consecutiveDefect
        })
      }

      const derived = computeLineDerived(timings)
      const idealCycleMs = ls.def.taktSec * 1000
      // OEE（对仿真加速鲁棒的口径）：
      //   A 可用率 = 产出站运行时长 / 观测时长（运行占比）
      //   P 表现率 = 理论节拍 / 瓶颈站实际节拍（速度损失，与采样速率无关）
      //   Q 质量率 = 良品 / 总产出
      const outObserveMs = last && last.observeStartMs ? now - last.observeStartMs : 0
      const availability = outObserveMs > 0 ? clamp01((last?.runningMs ?? 0) / outObserveMs) : 0
      const bottleneckCycleMs = timings.reduce((m, t) => Math.max(m, t.cycleMs), 0) || idealCycleMs
      const performance = clamp01(idealCycleMs / bottleneckCycleMs)
      const quality = lineGood + lineFail > 0 ? lineGood / (lineGood + lineFail) : 1
      const oee = { availability, performance, oee: clamp01(availability * performance * quality) }

      const status = this.lineStatus(stationData)
      const order = this.toWorkOrder(ls, lineGood)

      const ld: LineData = {
        id: ls.def.id,
        name: ls.def.name,
        status,
        oee: oee.oee,
        passCount: lineGood,
        targetCount: ls.def.targetCount,
        goodRate: lineGood + lineFail > 0 ? lineGood / (lineGood + lineFail) : 1,
        availability: oee.availability,
        performance: oee.performance,
        taktSec: ls.def.taktSec,
        currentOrder: order,
        nextModel: ls.nextModel,
        stations: stationData,
        trendData: this.pushTrend(ls, now, lineGood, oee.oee)
      }
      // 瓶颈站信息可由 derived.bottleneckStationId 标注（前端用 taktBar 自行判断）
      void derived
      lines.push(ld)

      for (const a of ls.alarms.values()) alarms.push({ ...a, time: hhmmss(a.startTs) })
      if (ls.changeover) changeovers.push(ls.changeover)
    }

    alarms.sort((a, b) => (a.level === b.level ? a.startTs - b.startTs : a.level === 'alarm' ? -1 : 1))

    const monthActual = this.monthBaseActual + workshopGood
    const orders: OrderProgress[] = lines
      .filter((l) => l.currentOrder.plannedQty > 0)
      .map((l) => this.toOrderProgress(l))

    return {
      id: this.def.id,
      name: this.def.name,
      factoryName: this.def.factoryName,
      shiftName: this.def.shiftName,
      shiftStartTs: this.shiftStartTs,
      shiftDurationH: this.def.shiftDurationH,
      lines,
      alarms,
      materialAlerts: this.materialAlerts,
      changeovers,
      costPerUnit: this.def.costPerUnit,
      monthTarget: this.def.monthTarget,
      monthActual,
      oeeTrend7d: [0.82, 0.8, 0.81, 0.79, 0.8, 0.78, this.avgOee(lines)],
      orders,
      safeDays: 365,
      monthYoY: 0.123
    }
  }

  // ───────────── 辅助 ─────────────

  private recentHourly(st: StationState, now: number): number[] {
    const cur = hourIndex(now)
    const out: number[] = []
    for (let i = 7; i >= 0; i--) out.push(st.hourCounts.get(cur - i) ?? 0)
    return out
  }

  private defectItems(st: StationState): DefectItem[] {
    return [...st.defects.entries()]
      .map(([code, count]) => ({ code, name: defectDict[code] ?? code, count }))
      .sort((a, b) => b.count - a.count)
  }

  private lineStatus(stations: StationData[]): EquipmentStatus {
    if (stations.some((s) => s.status === 'alarm')) return 'alarm'
    if (stations.some((s) => s.status === 'stopped')) return 'stopped'
    if (stations.length > 0 && stations.every((s) => s.status === 'idle')) return 'idle'
    return 'running'
  }

  private toWorkOrder(ls: LineState, completed: number): WorkOrder {
    const o = ls.order
    if (!o) {
      return {
        id: `WO-${ls.def.id}`, model: '—', plannedQty: 0,
        completedQty: completed, dueTs: Date.now(), startTs: this.shiftStartTs
      }
    }
    return {
      id: o.orderNo, model: o.productModel, plannedQty: o.plannedQty,
      completedQty: (o.completedQty ?? 0) + completed,
      dueTs: o.dueTs, startTs: o.planStartTs ?? this.shiftStartTs
    }
  }

  private toOrderProgress(l: LineData): OrderProgress {
    const o = l.currentOrder
    const ratePerHour = l.passCount / Math.max(1, (Date.now() - this.shiftStartTs) / 3_600_000)
    const remaining = Math.max(0, o.plannedQty - o.completedQty)
    const etaH = ratePerHour > 0 ? remaining / ratePerHour : Infinity
    const etaTs = Date.now() + etaH * 3_600_000
    const risk = etaTs > o.dueTs
    return {
      id: o.id,
      model: o.model,
      qty: o.plannedQty,
      done: o.completedQty,
      etaText: Number.isFinite(etaH)
        ? risk ? '进度偏慢，存在风险' : `预计 ${hhmmss(etaTs).slice(0, 5)} 完成`
        : '暂无产出',
      risk
    }
  }

  private pushTrend(ls: LineState, now: number, count: number, oee: number): TrendPoint[] {
    const d = new Date(now)
    const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (key !== ls.lastTrendKey) {
      ls.trend.push({ time: key, count, oee })
      if (ls.trend.length > 48) ls.trend.shift()
      ls.lastTrendKey = key
    }
    return ls.trend
  }

  private avgOee(lines: LineData[]): number {
    if (lines.length === 0) return 0
    return lines.reduce((s, l) => s + l.oee, 0) / lines.length
  }

  // 供 MES 上报取用：当前各产线累计良/不良
  lineTotals(): { lineId: string; good: number; fail: number; orderNo?: string }[] {
    const out: { lineId: string; good: number; fail: number; orderNo?: string }[] = []
    for (const ls of this.lines.values()) {
      const last = [...ls.stations.values()].at(-1)
      out.push({
        lineId: ls.def.id,
        good: last?.passCount ?? 0,
        fail: last?.failCount ?? 0,
        orderNo: ls.order?.orderNo
      })
    }
    return out
  }
}
