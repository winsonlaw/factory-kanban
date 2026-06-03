import type { WorkshopData, TrendPoint, DefectItem, StationData, EquipmentStatus, WorkOrder } from '../types'

// 班次：早班 8 小时，有效 7 小时（扣休息）。设为已开始 7 小时前，便于演示 Pacing
const NOW = Date.now()
const SHIFT_START = NOW - 7 * 3600 * 1000

function generateHourly(base: number, variance = 0.15): number[] {
  return Array.from({ length: 8 }, () => Math.round(base * (1 - variance + Math.random() * variance * 2)))
}

function generateTrend(base: number, points = 24): TrendPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(NOW - (points - 1 - i) * 30 * 60 * 1000)
    const count = Math.round(base * (0.85 + Math.random() * 0.3))
    return {
      time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`,
      count,
      oee: 0.75 + Math.random() * 0.2
    }
  })
}

// 缺陷分布：按总不良数拆成几类缺陷
function defects(total: number, weights: [string, string, number][]): DefectItem[] {
  const sum = weights.reduce((s, w) => s + w[2], 0)
  return weights.map(([code, name, w]) => ({
    code, name, count: Math.round(total * w / sum)
  })).filter(d => d.count > 0)
}

const DEFECT_TYPES: [string, string, number][] = [
  ['SHORT', '开短路', 4],
  ['OFFSET', '偏移', 3],
  ['MISSING', '缺件', 2],
  ['TOMB', '立碑', 1.5],
  ['COLD', '虚焊', 1]
]

// SMT 6站工厂：批量生成新增产线的站位
function genSmt(passBase: number, status: EquipmentStatus = 'running'): StationData[] {
  const tpl: [string, number, number][] = [
    ['锡膏印刷', 8000, 160],
    ['贴片机A', 12000, 155],
    ['贴片机B', 12000, 152],
    ['回流焊', 18000, 150],
    ['AOI检测', 14000, 148],
    ['包装', 9000, 150]
  ]
  return tpl.map(([name, std, h], i) => {
    const pass = passBase - i * 3
    const fail = i === 5 ? 0 : 2 + i
    const ct = Math.round(std * (0.95 + (i % 3) * 0.05))
    return {
      id: `S0${i + 1}`, name, status,
      passCount: pass, failCount: fail,
      cycletime: ct, stdCycletime: std,
      goodRate: 1 - fail / pass,
      todayTotal: pass * 7,
      hourlyTrend: generateHourly(h),
      defects: defects(fail, DEFECT_TYPES),
      consecutiveFail: 0
    }
  })
}

// 工单工厂（dueOffsetH = 交期距现在的小时数）
function wo(id: string, model: string, planned: number, completed: number, dueOffsetH: number): WorkOrder {
  return {
    id, model, plannedQty: planned, completedQty: completed,
    dueTs: NOW + dueOffsetH * 3600 * 1000,
    startTs: NOW - 7 * 3600 * 1000
  }
}

export const mockWorkshop: WorkshopData = {
  id: 'W01',
  name: 'SMT车间',
  factoryName: '深圳总部工厂',
  shiftName: '早班',
  shiftStartTs: SHIFT_START,
  shiftDurationH: 8,
  alarms: [
    {
      id: 'A1',
      lineId: 'L02',
      lineName: 'SMT产线B',
      stationId: 'S04',
      stationName: '回流焊',
      level: 'alarm',
      message: '回流焊炉温超限，请立即检查',
      time: '14:18:05',
      startTs: NOW - 23 * 60 * 1000  // 23分钟前
    },
    {
      id: 'A2',
      lineId: 'L01',
      lineName: 'SMT产线A',
      stationId: 'S02',
      stationName: '贴片机A',
      level: 'warn',
      message: '节拍超标 115%，建议检查飞达',
      time: '14:15:32',
      startTs: NOW - 5.5 * 60 * 1000  // 5.5分钟前
    },
    {
      id: 'A3',
      lineId: 'L03',
      lineName: 'SMT产线C',
      level: 'warn',
      message: '产量落后目标 8.2%',
      time: '14:10:00',
      startTs: NOW - 13 * 60 * 1000
    }
  ],
  lines: [
    {
      id: 'L01',
      name: 'SMT产线A',
      currentOrder: wo('WO-0602-001', 'A203-主板', 12000, 9360, 6),
      nextModel: 'B107-控制板',
      orderHistory: [
        { model: 'X001-旧主板', qty: 3200, goodRate: 0.991 },
        { model: 'A203-主板', qty: 5000, goodRate: 0.986 }
      ],
      status: 'running',
      oee: 0.873,
      passCount: 1247,
      targetCount: 1400,
      taktSec: 18,          // 7h有效/1400 ≈ 18s → 应产≈1400
      goodRate: 0.982,
      availability: 0.94,
      performance: 0.91,
      trendData: generateTrend(50),
      stations: [
        { id: 'S01', name: '锡膏印刷', status: 'running', passCount: 1260, failCount: 3, cycletime: 8200, stdCycletime: 8000, goodRate: 0.998, todayTotal: 8950, hourlyTrend: generateHourly(160), defects: defects(3, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S02', name: '贴片机A', status: 'running', passCount: 1255, failCount: 2, cycletime: 13800, stdCycletime: 12000, goodRate: 0.998, todayTotal: 8940, hourlyTrend: generateHourly(155), defects: defects(2, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S03', name: '贴片机B', status: 'running', passCount: 1248, failCount: 5, cycletime: 12100, stdCycletime: 12000, goodRate: 0.996, todayTotal: 8930, hourlyTrend: generateHourly(152), defects: defects(5, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S04', name: '回流焊', status: 'running', passCount: 1247, failCount: 1, cycletime: 18000, stdCycletime: 18000, goodRate: 0.999, todayTotal: 8925, hourlyTrend: generateHourly(150), defects: defects(1, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S05', name: 'AOI检测', status: 'running', passCount: 1245, failCount: 8, cycletime: 15200, stdCycletime: 14000, goodRate: 0.994, todayTotal: 8910, hourlyTrend: generateHourly(148, 0.2), defects: defects(8, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S06', name: '包装', status: 'running', passCount: 1247, failCount: 0, cycletime: 9000, stdCycletime: 9000, goodRate: 1.0, todayTotal: 8920, hourlyTrend: generateHourly(150), defects: [], consecutiveFail: 0 }
      ]
    },
    {
      id: 'L02',
      name: 'SMT产线B',
      currentOrder: wo('WO-0602-002', 'B107-控制板', 8000, 4160, 8),
      nextModel: 'A203-主板',
      orderHistory: [{ model: 'B107-控制板', qty: 4200, goodRate: 0.972 }],
      status: 'alarm',
      oee: 0.721,
      passCount: 998,
      targetCount: 1400,
      taktSec: 18,
      goodRate: 0.961,
      availability: 0.82,
      performance: 0.88,
      trendData: generateTrend(40),
      stations: [
        { id: 'S01', name: '锡膏印刷', status: 'running', passCount: 1010, failCount: 4, cycletime: 8100, stdCycletime: 8000, goodRate: 0.996, todayTotal: 7100, hourlyTrend: generateHourly(130), defects: defects(4, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S02', name: '贴片机A', status: 'running', passCount: 1005, failCount: 6, cycletime: 12300, stdCycletime: 12000, goodRate: 0.994, todayTotal: 7090, hourlyTrend: generateHourly(128), defects: defects(6, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S03', name: '贴片机B', status: 'idle', passCount: 1002, failCount: 3, cycletime: 12000, stdCycletime: 12000, goodRate: 0.997, todayTotal: 7080, hourlyTrend: generateHourly(125, 0.25), defects: defects(3, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S04', name: '回流焊', status: 'alarm', passCount: 998, failCount: 28, cycletime: 21000, stdCycletime: 18000, goodRate: 0.972, todayTotal: 7050, hourlyTrend: generateHourly(100, 0.4), defects: defects(28, [['SHORT', '开短路', 6], ['COLD', '虚焊', 5], ['OFFSET', '偏移', 2], ['TOMB', '立碑', 1]]), consecutiveFail: 4, consecutiveDefect: '开短路' },
        { id: 'S05', name: 'AOI检测', status: 'stopped', passCount: 965, failCount: 12, cycletime: 14100, stdCycletime: 14000, goodRate: 0.988, todayTotal: 6900, hourlyTrend: generateHourly(90, 0.4), defects: defects(12, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S06', name: '包装', status: 'stopped', passCount: 998, failCount: 0, cycletime: 9000, stdCycletime: 9000, goodRate: 1.0, todayTotal: 7050, hourlyTrend: generateHourly(95, 0.35), defects: [], consecutiveFail: 0 }
      ]
    },
    {
      id: 'L03',
      name: 'SMT产线C',
      currentOrder: wo('WO-0602-003', 'C055-电源板', 6000, 5820, 4),
      nextModel: 'E330-传感板',
      orderHistory: [
        { model: 'C055-电源板', qty: 6000, goodRate: 0.995 },
        { model: 'C040-电源板', qty: 3500, goodRate: 0.993 }
      ],
      status: 'running',
      oee: 0.915,
      passCount: 1401,
      targetCount: 1400,
      taktSec: 18,
      goodRate: 0.995,
      availability: 0.97,
      performance: 0.945,
      trendData: generateTrend(58),
      stations: [
        { id: 'S01', name: '锡膏印刷', status: 'running', passCount: 1415, failCount: 2, cycletime: 7900, stdCycletime: 8000, goodRate: 0.999, todayTotal: 9800, hourlyTrend: generateHourly(175), defects: defects(2, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S02', name: '贴片机A', status: 'running', passCount: 1412, failCount: 1, cycletime: 11900, stdCycletime: 12000, goodRate: 0.999, todayTotal: 9790, hourlyTrend: generateHourly(174), defects: defects(1, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S03', name: '贴片机B', status: 'running', passCount: 1408, failCount: 4, cycletime: 12100, stdCycletime: 12000, goodRate: 0.997, todayTotal: 9780, hourlyTrend: generateHourly(172), defects: defects(4, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S04', name: '回流焊', status: 'running', passCount: 1405, failCount: 1, cycletime: 18100, stdCycletime: 18000, goodRate: 0.999, todayTotal: 9770, hourlyTrend: generateHourly(170), defects: defects(1, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S05', name: 'AOI检测', status: 'running', passCount: 1402, failCount: 5, cycletime: 13800, stdCycletime: 14000, goodRate: 0.996, todayTotal: 9760, hourlyTrend: generateHourly(168), defects: defects(5, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S06', name: '包装', status: 'running', passCount: 1401, failCount: 0, cycletime: 9000, stdCycletime: 9000, goodRate: 1.0, todayTotal: 9755, hourlyTrend: generateHourly(170), defects: [], consecutiveFail: 0 }
      ]
    },
    {
      id: 'L04',
      name: 'DIP插件线',
      currentOrder: wo('WO-0602-004', 'D211-接口板', 5000, 3100, 10),
      nextModel: 'D117-接口板B',
      status: 'idle',
      oee: 0.652,
      passCount: 780,
      targetCount: 1200,
      taktSec: 21,          // 7h/1200 ≈ 21s → 应产≈1200
      goodRate: 0.978,
      availability: 0.72,
      performance: 0.89,
      trendData: generateTrend(32),
      stations: [
        { id: 'S01', name: '插件', status: 'idle', passCount: 800, failCount: 8, cycletime: 25000, stdCycletime: 22000, goodRate: 0.990, todayTotal: 5200, hourlyTrend: generateHourly(95, 0.3), defects: defects(8, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S02', name: '波峰焊', status: 'idle', passCount: 792, failCount: 12, cycletime: 30000, stdCycletime: 28000, goodRate: 0.985, todayTotal: 5180, hourlyTrend: generateHourly(90, 0.3), defects: defects(12, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S03', name: '剪脚', status: 'idle', passCount: 782, failCount: 2, cycletime: 8000, stdCycletime: 8000, goodRate: 0.997, todayTotal: 5160, hourlyTrend: generateHourly(88), defects: defects(2, DEFECT_TYPES), consecutiveFail: 0 },
        { id: 'S04', name: '检验包装', status: 'idle', passCount: 780, failCount: 0, cycletime: 12000, stdCycletime: 12000, goodRate: 1.0, todayTotal: 5155, hourlyTrend: generateHourly(88), defects: [], consecutiveFail: 0 }
      ]
    },
    {
      id: 'L05', name: 'SMT产线D', status: 'running', oee: 0.812, passCount: 1180, targetCount: 1400, taktSec: 18,
      goodRate: 0.985, availability: 0.90, performance: 0.92, trendData: generateTrend(46), stations: genSmt(1190),
      currentOrder: wo('WO-0602-005', 'A203-主板', 10000, 7200, 12), nextModel: 'F120-功率板', orderHistory: [{ model: 'A203-主板', qty: 4800, goodRate: 0.984 }]
    },
    {
      id: 'L06', name: 'SMT产线E', status: 'running', oee: 0.894, passCount: 1322, targetCount: 1400, taktSec: 18,
      goodRate: 0.991, availability: 0.95, performance: 0.94, trendData: generateTrend(54), stations: genSmt(1332),
      currentOrder: wo('WO-0602-006', 'E330-传感板', 9000, 8100, 6), nextModel: 'C055-电源板'
    },
    {
      id: 'L07', name: '后焊线', status: 'running', oee: 0.763, passCount: 920, targetCount: 1100, taktSec: 23,
      goodRate: 0.975, availability: 0.85, performance: 0.90, trendData: generateTrend(38), stations: genSmt(930),
      currentOrder: wo('WO-0602-007', 'F120-功率板', 7000, 4900, 14), nextModel: 'M002-整机'
    },
    {
      id: 'L08', name: '总装线', status: 'idle', oee: 0.681, passCount: 850, targetCount: 1300, taktSec: 19,
      goodRate: 0.980, availability: 0.74, performance: 0.91, trendData: generateTrend(34), stations: genSmt(860, 'idle'),
      currentOrder: wo('WO-0602-008', 'M002-整机', 6000, 3600, 10), nextModel: 'A203-主板'
    }
  ],
  materialAlerts: [
    { id: 'M1', lineId: 'L02', lineName: 'SMT产线B', station: '贴片机A', material: '锡膏 SAC305', remainMin: 18 },
    { id: 'M2', lineId: 'L05', lineName: 'SMT产线D', station: '锡膏印刷', material: '钢网 0.12mm', remainMin: 35 },
    { id: 'M3', lineId: 'L07', lineName: '后焊线', material: '焊锡丝 Φ0.8', remainMin: 52 }
  ],
  changeovers: [
    { id: 'C1', lineId: 'L08', lineName: '总装线', toModel: 'M-002B', startTs: NOW - 17.5 * 60 * 1000, durationSec: 1800 },
    { id: 'C2', lineId: 'L04', lineName: 'DIP插件线', toModel: 'D-117A', startTs: NOW - 6 * 60 * 1000, durationSec: 1200 }
  ],
  costPerUnit: 28,
  monthTarget: 120000,
  monthActual: 110760,
  oeeTrend7d: [0.82, 0.80, 0.81, 0.79, 0.80, 0.78, 0.79],
  orders: [
    { id: 'O1', model: 'A203-主板', qty: 12000, done: 9360, etaText: '预计今日 18:30 完成', risk: false },
    { id: 'O2', model: 'B107-控制板', qty: 8000, done: 4160, etaText: '进度偏慢，存在风险', risk: true },
    { id: 'O3', model: 'C055-电源板', qty: 6000, done: 5820, etaText: '预计今日 16:10 完成', risk: false }
  ],
  safeDays: 365,
  monthYoY: 0.123
}
