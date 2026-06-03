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

/**
 * IoT 设备拓扑（家电/空调/传感/智控）—— 独立 zone「智能楼宇」，不参与产线 OEE，
 * 仅进通用设备状态库。体现工业+IoT 并存。zoneId 区别于工业 zone。
 */
export interface IotDeviceTopo {
  zoneId: string
  lineId: string // 区域/楼层
  stationId: string
  deviceId: string
  name: string
  deviceType: DeviceType
  protocol: string // 仅标注（仿真统一产生 canonical）：tcp/hilink/http/coap
}

export const iotDevices: IotDeviceTopo[] = [
  { zoneId: 'Z-IOT', lineId: 'BLD-1F', stationId: 'AC-01', deviceId: 'DEV-AC-01', name: '1F办公区空调', deviceType: 'air_conditioner', protocol: 'hilink' },
  { zoneId: 'Z-IOT', lineId: 'BLD-1F', stationId: 'AC-02', deviceId: 'DEV-AC-02', name: '1F会议室空调', deviceType: 'air_conditioner', protocol: 'hilink' },
  { zoneId: 'Z-IOT', lineId: 'BLD-1F', stationId: 'TH-01', deviceId: 'DEV-TH-01', name: '1F温湿度', deviceType: 'th_sensor', protocol: 'coap' },
  { zoneId: 'Z-IOT', lineId: 'BLD-2F', stationId: 'PLUG-01', deviceId: 'DEV-PLUG-01', name: '2F设备插座', deviceType: 'smart_plug', protocol: 'tcp' },
  { zoneId: 'Z-IOT', lineId: 'BLD-2F', stationId: 'FA-01', deviceId: 'DEV-FA-01', name: '2F新风', deviceType: 'fresh_air', protocol: 'http' },
  { zoneId: 'Z-IOT', lineId: 'BLD-2F', stationId: 'LT-01', deviceId: 'DEV-LT-01', name: '2F照明', deviceType: 'lighting', protocol: 'hilink' }
]
