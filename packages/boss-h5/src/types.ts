/** 老板 H5 所需的后端数据子集。 */

export interface LineData {
  id: string
  name: string
  status: 'running' | 'idle' | 'stopped' | 'alarm'
  oee: number
  passCount: number
  targetCount: number
  goodRate: number
  taktSec: number
}

export interface OrderProgress {
  id: string
  model: string
  qty: number
  done: number
  etaText: string
  risk: boolean
}

export interface AlarmItem {
  id: string
  lineName: string
  stationName?: string
  level: 'warn' | 'alarm'
  message: string
  startTs: number
}

export interface MaterialAlert {
  id: string
  lineName: string
  material: string
  remainMin: number
}

export interface WorkshopData {
  name: string
  factoryName: string
  shiftName: string
  shiftStartTs: number
  lines: LineData[]
  alarms: AlarmItem[]
  materialAlerts: MaterialAlert[]
  costPerUnit: number
  monthTarget: number
  monthActual: number
  oeeTrend7d: number[]
  orders: OrderProgress[]
  safeDays: number
  monthYoY: number
}

export interface ExecSummary {
  todayOutputValue: number
  targetValue: number
  attainment: number
  downtimeLossAmount: number
  qualityLossAmount: number
  downtimeTopReasons: { reason: string; hours: number; amount: number }[]
  currentKw: number
  energyKwhToday: number
}

export interface DailyRow {
  date: string
  outputQty: number
  targetQty: number
  attainment: number
  oee: number
  goodRate: number
  downtimeLossAmount: number
  qualityLossAmount: number
  partial?: boolean
}

export interface WorkshopSample {
  ts: number
  outputQty: number
  oee: number
}
