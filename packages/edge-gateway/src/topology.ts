/**
 * 本网关负责的站位拓扑 —— 与中心 masterdata 的车间结构对齐（同一 SMT 车间）。
 * 正式环境由网关配置文件下发；这里内置一份用于仿真。
 */

import type { DeviceType } from './wire.js'

export interface StationTopo {
  lineId: string
  stationId: string
  deviceId: string
  name: string
  deviceType: DeviceType
  stdCycleMs: number
}

const SMT: Array<[string, DeviceType, number]> = [
  ['锡膏印刷', 'solder_printer', 8000],
  ['贴片机A', 'smt_mounter', 12000],
  ['贴片机B', 'smt_mounter', 12000],
  ['回流焊', 'reflow_oven', 18000],
  ['AOI检测', 'aoi', 14000],
  ['包装', 'generic', 9000]
]

const DIP: Array<[string, DeviceType, number]> = [
  ['插件', 'dip_inserter', 22000],
  ['波峰焊', 'wave_solder', 28000],
  ['剪脚', 'generic', 8000],
  ['检验包装', 'ict_fct', 12000]
]

function line(lineId: string, defs: Array<[string, DeviceType, number]>): StationTopo[] {
  return defs.map(([name, deviceType, stdCycleMs], i) => {
    const stationId = `S0${i + 1}`
    return {
      lineId,
      stationId,
      deviceId: `DEV-${lineId}-${stationId}`,
      name,
      deviceType,
      stdCycleMs
    }
  })
}

export const topology: StationTopo[] = [
  ...line('L01', SMT),
  ...line('L02', SMT),
  ...line('L03', SMT),
  ...line('L04', DIP),
  ...line('L05', SMT),
  ...line('L06', SMT)
]
