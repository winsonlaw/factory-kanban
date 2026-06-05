/**
 * data-platform 入口 —— 装配所有模块并启动。
 *
 * 数据流：
 *   边缘网关 ──MQTT──▶ MqttIngest ──▶ Aggregator ──snapshot──▶ WS 广播 ▶ 大屏
 *   MES ──REST 拉单──▶ MesReporter ──▶ Aggregator ；Aggregator ──进度──▶ MES
 *
 * 默认 STORAGE=memory + MES_MODE=mock + MQTT 可选，**无需外部基础设施即可启动**。
 */

import { config } from './config.js'
import { Aggregator } from './state/aggregator.js'
import { MqttIngest } from './ingest/mqtt.js'
import { createMesAdapter } from './mes/adapter.js'
import { MesReporter } from './mes/reporter.js'
import { createSnapshotStore } from './storage/snapshot-store.js'
import { ConfigStore } from './config-domain/store.js'
import { buildWorkshopDef } from './config-domain/to-workshop-def.js'
import { HistoryStore } from './state/history.js'
import { DeviceStateStore } from './state/device-state.js'
import { ServerApp } from './server-app.js'

async function main(): Promise<void> {
  console.log('[boot] factory-kanban data-platform starting…')
  console.log(`[boot] storage=${config.storage} mes=${config.mes.mode} mqtt=${config.mqtt.enabled}`)

  // 配置库（admin-web 管理）→ 构建运行时车间拓扑，使后台配置启动即生效
  const configStore = new ConfigStore(config.configFile)
  const agg = new Aggregator(buildWorkshopDef(configStore, 'W01'))
  const store = createSnapshotStore()
  const history = new HistoryStore()
  const deviceState = new DeviceStateStore()
  const app = new ServerApp(agg, store, configStore, history, deviceState)

  const mqtt = new MqttIngest(agg, deviceState)
  mqtt.start()

  const mes = new MesReporter(createMesAdapter(), agg)
  mes.start()

  await app.listen()

  // 配置热重载：admin-web 改配置后标脏，下一个 tick 就地调谐运行时拓扑（免重启）
  let topoDirty = false
  configStore.onChange(() => {
    topoDirty = true
  })

  // 快照计算 + 广播节流循环
  const tick = setInterval(() => {
    if (agg.maybeRollover()) console.log('[shift] 班次滚动，产量清零重开')
    if (topoDirty) {
      topoDirty = false
      agg.applyTopology(buildWorkshopDef(configStore, 'W01'))
      console.log('[config] topology hot-reloaded')
    }
    if (!agg.dirty) return
    agg.dirty = false
    const snap = agg.buildSnapshot()
    history.record(snap)
    void app.broadcast(snap)
  }, config.snapshotIntervalMs)

  const shutdown = async (): Promise<void> => {
    console.log('\n[boot] shutting down…')
    clearInterval(tick)
    mqtt.stop()
    mes.stop()
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((err) => {
  console.error('[boot] fatal:', err)
  process.exit(1)
})
