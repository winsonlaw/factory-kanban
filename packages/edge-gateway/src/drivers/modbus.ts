/**
 * Modbus TCP 驱动 —— 真实 PLC 采集路径。
 *
 * 用「设备 Profile」声明寄存器 → canonical 字段的映射，轮询读取后规范化上报。
 * modbus-serial 为可选依赖（动态 import），仅 modbus 模式需要 `npm i modbus-serial`。
 *
 * 这是可运行骨架：每个 Profile 描述一台设备的连接与寄存器地址，driver 按 poll 周期读取。
 */

import {
  EquipmentStatusCode,
  SCHEMA_VERSION,
  nextMessageId,
  type DeviceTelemetry,
  type DeviceType
} from '../wire.js'
import type { Driver, DriverCallbacks } from './types.js'

/** 寄存器映射：把保持寄存器某地址映射到 canonical 字段。 */
export interface RegisterMap {
  passCount: number // 良品累计寄存器地址
  failCount: number // 不良累计寄存器地址
  cycleTimeMs: number // 本次节拍寄存器地址
  status: number // 状态码寄存器地址
}

/** 单台 Modbus 设备的 Profile。 */
export interface ModbusProfile {
  host: string
  port: number
  unitId: number
  pollMs: number
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  deviceId: string
  deviceType: DeviceType
  registers: RegisterMap
}

export class ModbusDriver implements Driver {
  private timers: NodeJS.Timeout[] = []
  private clients: Array<{ close: (cb?: () => void) => void }> = []
  private lastPass = new Map<string, number>()
  private lastFail = new Map<string, number>()

  constructor(private profiles: ModbusProfile[]) {}

  async start(cb: DriverCallbacks): Promise<void> {
    const { default: ModbusRTU } = await import('modbus-serial')
    for (const p of this.profiles) {
      const client = new ModbusRTU()
      await client.connectTCP(p.host, { port: p.port })
      client.setID(p.unitId)
      this.clients.push(client)

      const poll = async (): Promise<void> => {
        try {
          // 读取覆盖映射的寄存器区间（简化：逐字段读，真实可合并区间）
          const span = Math.max(p.registers.passCount, p.registers.failCount,
            p.registers.cycleTimeMs, p.registers.status) -
            Math.min(p.registers.passCount, p.registers.failCount,
              p.registers.cycleTimeMs, p.registers.status) + 1
          const base = Math.min(p.registers.passCount, p.registers.failCount,
            p.registers.cycleTimeMs, p.registers.status)
          const { data } = await client.readHoldingRegisters(base, span)
          const at = (addr: number): number => data[addr - base] ?? 0

          const passTotal = at(p.registers.passCount)
          const failTotal = at(p.registers.failCount)
          const key = p.deviceId
          const dPass = Math.max(0, passTotal - (this.lastPass.get(key) ?? passTotal))
          const dFail = Math.max(0, failTotal - (this.lastFail.get(key) ?? failTotal))
          this.lastPass.set(key, passTotal)
          this.lastFail.set(key, failTotal)
          if (dPass === 0 && dFail === 0) return // 无新增，不上报

          const t: DeviceTelemetry = {
            schemaVersion: SCHEMA_VERSION,
            messageId: nextMessageId(),
            timestamp: Date.now(),
            factoryId: p.factoryId,
            zoneId: p.zoneId,
            lineId: p.lineId,
            stationId: p.stationId,
            deviceId: p.deviceId,
            deviceType: p.deviceType,
            passCount: dPass,
            failCount: dFail,
            cycleTimeMs: at(p.registers.cycleTimeMs),
            equipmentStatus: (at(p.registers.status) as EquipmentStatusCode) ?? EquipmentStatusCode.Running
          }
          cb.onTelemetry(t)
        } catch (err) {
          console.error(`[modbus] poll ${p.deviceId} failed:`, (err as Error).message)
        }
      }
      this.timers.push(setInterval(() => void poll(), p.pollMs))
    }
    console.log(`[modbus] started, ${this.profiles.length} devices`)
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t)
    for (const c of this.clients) c.close()
  }
}
