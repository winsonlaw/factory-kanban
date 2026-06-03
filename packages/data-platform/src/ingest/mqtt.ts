/**
 * MQTT 接入 —— 订阅边缘网关上报的遥测/事件，zod 校验后灌入聚合引擎。
 * EMQX 不可用时静默降级（仿真可只跑内置 simulator，不强依赖 broker）。
 */

import mqtt from 'mqtt'
import { config } from '../config.js'
import { SUBSCRIPTION } from '../contracts/index.js'
import type { DeviceEvent, DeviceTelemetry } from '../contracts/index.js'
import { deviceEventSchema, deviceTelemetrySchema } from '../contracts/schemas.js'
import type { Aggregator } from '../state/aggregator.js'
import type { DeviceStateStore } from '../state/device-state.js'

export class MqttIngest {
  private client?: mqtt.MqttClient
  private rejected = 0

  constructor(private agg: Aggregator, private deviceState: DeviceStateStore) {}

  start(): void {
    if (!config.mqtt.enabled) {
      console.log('[mqtt] disabled (MQTT_ENABLED=false)')
      return
    }
    const client = mqtt.connect(config.mqtt.url, {
      username: config.mqtt.username,
      password: config.mqtt.password,
      reconnectPeriod: 3000,
      connectTimeout: 5000
    })
    this.client = client

    client.on('connect', () => {
      console.log(`[mqtt] connected ${config.mqtt.url}`)
      client.subscribe([SUBSCRIPTION.allTelemetry, SUBSCRIPTION.allEvents], { qos: 1 })
    })
    client.on('error', (e) => console.error('[mqtt] error:', e.message))
    client.on('message', (topic, payload) => this.onMessage(topic, payload))
  }

  private onMessage(topic: string, payload: Buffer): void {
    let json: unknown
    try {
      json = JSON.parse(payload.toString())
    } catch {
      this.rejected++
      return
    }
    if (topic.includes('/telemetry/')) {
      const r = deviceTelemetrySchema.safeParse(json)
      if (r.success) {
        const t = r.data as DeviceTelemetry
        this.agg.ingestTelemetry(t) // 工业聚合（OEE）——非产线设备会被忽略
        this.deviceState.record(t) // 通用设备状态库——所有设备
      } else this.rejected++
    } else if (topic.includes('/event/')) {
      const r = deviceEventSchema.safeParse(json)
      if (r.success) this.agg.ingestEvent(r.data as DeviceEvent)
      else this.rejected++
    }
  }

  stop(): void {
    this.client?.end(true)
  }
}
