/**
 * 边缘网关入口 —— 选择驱动（simulator/modbus）→ 规范化 → MQTT 发布（带离线补传）。
 */

import { config } from './config.js'
import { Publisher } from './publisher.js'
import { SimulatorDriver } from './drivers/simulator.js'
import { ModbusDriver } from './drivers/modbus.js'
import type { Driver } from './drivers/types.js'

async function main(): Promise<void> {
  console.log('[boot] factory-kanban edge-gateway starting…')
  console.log(`[boot] mode=${config.mode} factory=${config.factoryId} zone=${config.zoneId}`)

  const publisher = new Publisher()
  publisher.start()

  let driver: Driver
  if (config.mode === 'modbus') {
    // 真实环境：从 profileDir 加载各设备 Profile。此处留空示例，按现场补充。
    console.warn('[boot] modbus 模式需配置设备 Profile（见 src/drivers/modbus.ts）')
    driver = new ModbusDriver([])
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
