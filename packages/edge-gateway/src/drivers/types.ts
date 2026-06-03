/**
 * 数据源驱动统一接口 —— simulator / modbus / opcua 等都实现它。
 * 驱动负责把「原始数据」转成 canonical 消息，通过回调交给发布器。
 */

import type { DeviceEvent, DeviceTelemetry } from '../wire.js'

export interface DriverCallbacks {
  onTelemetry: (t: DeviceTelemetry) => void
  onEvent: (e: DeviceEvent) => void
}

export interface Driver {
  start(cb: DriverCallbacks): Promise<void>
  stop(): Promise<void>
}
