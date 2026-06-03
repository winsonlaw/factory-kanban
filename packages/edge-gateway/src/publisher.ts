/**
 * MQTT 发布器 —— store-and-forward：
 *   在线时直接发；离线时入 OfflineBuffer 落盘；重连后顺序补传缓冲。
 */

import mqtt from 'mqtt'
import { config } from './config.js'
import { OfflineBuffer } from './buffer.js'
import {
  SCHEMA_VERSION,
  nextMessageId,
  telemetryTopic,
  eventTopic,
  type DeviceEvent,
  type DeviceTelemetry
} from './wire.js'

export class Publisher {
  private client?: mqtt.MqttClient
  private connected = false
  private buffer: OfflineBuffer
  private heartbeatTimer?: NodeJS.Timeout

  constructor() {
    this.buffer = new OfflineBuffer(config.bufferFile)
  }

  start(): void {
    const client = mqtt.connect(config.mqtt.url, {
      username: config.mqtt.username,
      password: config.mqtt.password,
      reconnectPeriod: 3000,
      connectTimeout: 5000
    })
    this.client = client
    client.on('connect', () => {
      this.connected = true
      console.log(`[mqtt] connected ${config.mqtt.url}`)
      this.flush()
    })
    client.on('close', () => {
      this.connected = false
    })
    client.on('error', (e) => console.error('[mqtt] error:', e.message))

    // 网关心跳
    this.heartbeatTimer = setInterval(() => this.heartbeat(), 15000)
  }

  publishTelemetry(t: DeviceTelemetry): void {
    this.send(telemetryTopic(t), JSON.stringify(t))
  }

  publishEvent(e: DeviceEvent): void {
    this.send(eventTopic(e), JSON.stringify(e))
  }

  private send(topic: string, payload: string): void {
    if (this.connected && this.client) {
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) this.buffer.push({ topic, payload }) // 发送失败转缓冲
      })
    } else {
      this.buffer.push({ topic, payload }) // 离线缓冲
    }
  }

  /** 重连后顺序补传缓冲。 */
  private flush(): void {
    if (!this.connected || !this.client || this.buffer.size === 0) return
    const msgs = this.buffer.drain()
    console.log(`[mqtt] flushing ${msgs.length} buffered msgs`)
    let failed = false
    for (const m of msgs) {
      this.client.publish(m.topic, m.payload, { qos: 1 }, (err) => {
        if (err) {
          this.buffer.push(m)
          failed = true
        }
      })
    }
    if (!failed) this.buffer.commit()
  }

  private heartbeat(): void {
    if (!this.connected || !this.client) return
    const hb = {
      schemaVersion: SCHEMA_VERSION,
      messageId: nextMessageId(),
      timestamp: Date.now(),
      factoryId: config.factoryId,
      zoneId: config.zoneId,
      gatewayId: config.gatewayId,
      online: true,
      bufferedCount: this.buffer.size,
      connectedDevices: 0
    }
    const topic = `fk/v1/status/${config.factoryId}/${config.zoneId}/${config.gatewayId}`
    this.client.publish(topic, JSON.stringify(hb), { qos: 0 })
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.client?.end(true)
  }
}
