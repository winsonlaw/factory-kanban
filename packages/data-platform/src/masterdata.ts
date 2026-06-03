/**
 * 基础数据（📋）—— 正式环境由 admin-web 写入 PostgreSQL，这里内置一份种子，
 * 使系统脱离数据库也能启动并定义车间拓扑。结构刻意贴合 SMT 车间示例。
 */

export interface StationDef {
  id: string
  name: string
  deviceType: string
  stdCycleMs: number // 标准节拍
  stdHourly: number // 标准每小时产量（用于趋势基线）
}

export interface LineDef {
  id: string
  name: string
  taktSec: number // 产距时间
  targetCount: number // 当班计划产量
  stations: StationDef[]
}

export interface WorkshopDef {
  id: string
  name: string
  factoryId: string
  factoryName: string
  zoneId: string
  shiftName: string
  shiftDurationH: number // 班次有效时长（扣休息）
  plannedRuntimeMs: number // 计划运行时间
  costPerUnit: number
  monthTarget: number
  lines: LineDef[]
}

const SMT_6: Omit<StationDef, 'id'>[] = [
  { name: '锡膏印刷', deviceType: 'solder_printer', stdCycleMs: 8000, stdHourly: 160 },
  { name: '贴片机A', deviceType: 'smt_mounter', stdCycleMs: 12000, stdHourly: 155 },
  { name: '贴片机B', deviceType: 'smt_mounter', stdCycleMs: 12000, stdHourly: 152 },
  { name: '回流焊', deviceType: 'reflow_oven', stdCycleMs: 18000, stdHourly: 150 },
  { name: 'AOI检测', deviceType: 'aoi', stdCycleMs: 14000, stdHourly: 148 },
  { name: '包装', deviceType: 'generic', stdCycleMs: 9000, stdHourly: 150 }
]

function smtLine(id: string, name: string, taktSec: number, target: number): LineDef {
  return {
    id,
    name,
    taktSec,
    targetCount: target,
    stations: SMT_6.map((s, i) => ({ ...s, id: `S0${i + 1}` }))
  }
}

const DIP_LINE: LineDef = {
  id: 'L04',
  name: 'DIP插件线',
  taktSec: 21,
  targetCount: 1200,
  stations: [
    { id: 'S01', name: '插件', deviceType: 'dip_inserter', stdCycleMs: 22000, stdHourly: 95 },
    { id: 'S02', name: '波峰焊', deviceType: 'wave_solder', stdCycleMs: 28000, stdHourly: 90 },
    { id: 'S03', name: '剪脚', deviceType: 'generic', stdCycleMs: 8000, stdHourly: 88 },
    { id: 'S04', name: '检验包装', deviceType: 'ict_fct', stdCycleMs: 12000, stdHourly: 88 }
  ]
}

export const workshopDef: WorkshopDef = {
  id: 'W01',
  name: 'SMT车间',
  factoryId: 'F01',
  factoryName: '深圳总部工厂',
  zoneId: 'Z01',
  shiftName: '早班',
  shiftDurationH: 8,
  plannedRuntimeMs: 7 * 3600 * 1000, // 8 小时班、有效 7 小时
  costPerUnit: 28,
  monthTarget: 120000,
  lines: [
    smtLine('L01', 'SMT产线A', 18, 1400),
    smtLine('L02', 'SMT产线B', 18, 1400),
    smtLine('L03', 'SMT产线C', 18, 1400),
    DIP_LINE,
    smtLine('L05', 'SMT产线D', 18, 1400),
    smtLine('L06', 'SMT产线E', 18, 1400)
  ]
}

/** 缺陷字典：code → 中文名（支撑 Pareto 显示）。 */
export const defectDict: Record<string, string> = {
  SHORT: '开短路',
  OFFSET: '偏移',
  MISSING: '缺件',
  TOMB: '立碑',
  COLD: '虚焊'
}

/** 停机原因字典。 */
export const alarmDict: Record<string, string> = {
  TEMP_OVER: '炉温超限',
  FEEDER_ERR: '飞达异常',
  NO_MATERIAL: '缺料停机',
  E_STOP: '急停',
  JAM: '卡板'
}
