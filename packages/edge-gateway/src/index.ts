/**
 * 边缘网关入口 —— 选择驱动（simulator/modbus）→ 规范化 → MQTT 发布（带离线补传）。
 */

import { config } from './config.js'
import { Publisher } from './publisher.js'
import { SimulatorDriver } from './drivers/simulator.js'
import { ModbusDriver } from './drivers/modbus.js'
import { fetchModbusProfiles } from './config-fetch.js'
import type { Driver } from './drivers/types.js'

async function main(): Promise<void> {
  console.log('[boot] factory-kanban edge-gateway starting…')
  console.log(`[boot] mode=${config.mode} factory=${config.factoryId} zone=${config.zoneId}`)

  const publisher = new Publisher()
  publisher.start()

  let driver: Driver
  if (config.mode === 'modbus') {
    // 从 data-platform 拉取本网关的采集配置（admin-web 所配），构建 Modbus Profile
    let profiles: Awaited<ReturnType<typeof fetchModbusProfiles>> = []
    try {
      profiles = await fetchModbusProfiles()
      console.log(`[boot] loaded ${profiles.length} modbus profiles from config`)
    } catch (err) {
      console.warn('[boot] 拉取采集配置失败，modbus profiles 为空:', (err as Error).message)
    }
    driver = new ModbusDriver(profiles)
  } else {
    driver = new SimulatorDriver()
  }

  await driver.start({
    onTelemetry: (t) => publisher.publishTelemetry(t),
    onEvent: (e) => publisher.publishEvent(e)
  })

  const shutdown = async (): Promise<void> => {
    console.log('\n[boot] shutting down…')
    await driver.stop()
    publisher.stop()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((err) => {
  console.error('[boot] fatal:', err)
  process.exit(1)
})
