/**
 * 通用 TCP 驱动 —— 真实 socket 接入。
 *
 * 连接设备/网关的 TCP 端口，按配置的报文边界（换行分隔 / 定长 / JSON 行）切帧，
 * 每帧解析为 JSON 后映射到 canonical 遥测。覆盖大量自定义 TCP 上报设备。
 *
 * 帧 JSON 约定（最小集）：
 *   { "deviceId": "...", "status": 1, "pass": 1, "fail": 0, "cycleMs": 1000, "metrics": {...} }
 */

import { Socket } from 'node:net'
import {
  EquipmentStatusCode,
  SCHEMA_VERSION,
  nextMessageId,
  type DeviceTelemetry,
  type DeviceType
} from '../wire.js'
import type { Driver, DriverCallbacks } from './types.js'

export interface TcpProfile {
  host: string
  port: number
  delimiter: string // 帧分隔符，默认 '\n'
  factoryId: string
  zoneId: string
  lineId: string
  stationId: string
  deviceId: string
  deviceType: DeviceType
}

interface TcpFrame {
  deviceId?: string
  status?: number
  pass?: number
  fail?: number
  cycleMs?: number
  metrics?: Record<string, unknown>
}

export class TcpDriver implements Driver {
  private sockets: Socket[] = []

  constructor(private profiles: TcpProfile[]) {}

  async start(cb: DriverCallbacks): Promise<void> {
    for (const p of this.profiles) this.connect(p, cb)
    console.log(`[tcp] started, ${this.profiles.length} endpoints`)
  }

  private connect(p: TcpProfile, cb: DriverCallbacks): void {
    const socket = new Socket()
    this.sockets.push(socket)
    let buffer = ''
    const delim = p.delimiter || '\n'

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let idx: number
      while ((idx = buffer.indexOf(delim)) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + delim.length)
        if (line) this.handleFrame(line, p, cb)
      }
    })
    socket.on('error', (e) => console.error(`[tcp] ${p.host}:${p.port} error:`, e.message))
    socket.on('close', () => {
      // 断线重连
      setTimeout(() => this.connect(p, cb), 3000)
    })
    socket.connect(p.port, p.host, () => console.log(`[tcp] connected ${p.host}:${p.port}`))
  }

  private handleFrame(line: string, p: TcpProfile, cb: DriverCallbacks): void {
    let frame: TcpFrame
    try {
      frame = JSON.parse(line) as TcpFrame
    } catch {
      return // 非 JSON 帧，按需扩展自定义解析
    }
    const t: DeviceTelemetry = {
      schemaVersion: SCHEMA_VERSION,
      messageId: nextMessageId(),
      timestamp: Date.now(),
      factoryId: p.factoryId,
      zoneId: p.zoneId,
      lineId: p.lineId,
      stationId: p.stationId,
      deviceId: frame.deviceId ?? p.deviceId,
      deviceType: p.deviceType,
      passCount: frame.pass ?? 0,
      failCount: frame.fail ?? 0,
      cycleTimeMs: frame.cycleMs ?? 0,
      equipmentStatus: (frame.status as EquipmentStatusCode) ?? EquipmentStatusCode.Running,
      metrics: frame.metrics
    }
    cb.onTelemetry(t)
  }

  async stop(): Promise<void> {
    for (const s of this.sockets) s.destroy()
    this.sockets = []
  }
}
