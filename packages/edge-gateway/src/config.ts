/**
 * 边缘网关配置 —— 每车间一台网关，知道自己负责的工厂/车间与站位拓扑。
 */

function str(key: string, def: string): string {
  return process.env[key] ?? def
}
function num(key: string, def: number): number {
  const v = process.env[key]
  return v === undefined ? def : Number(v)
}

export const config = {
  /** simulator = 内置仿真数据源（默认，免真实 PLC）；modbus = 真实 Modbus TCP 采集 */
  mode: str('GATEWAY_MODE', 'simulator') as 'simulator' | 'modbus',

  factoryId: str('FACTORY_ID', 'F01'),
  zoneId: str('ZONE_ID', 'Z01'),
  gatewayId: str('GATEWAY_ID', 'GW-Z01-01'),

  mqtt: {
    url: str('MQTT_URL', 'mqtt://localhost:1883'),
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  },

  /** 仿真节奏：节拍缩放（<1 加速演示）。1 = 真实节拍 */
  sim: {
    speed: num('SIM_SPEED', 0.05), // 默认加速 20 倍，便于观察
    failRate: num('SIM_FAIL_RATE', 0.01), // 不良率
    alarmChance: num('SIM_ALARM_CHANCE', 0.002) // 每次过机触发报警概率
  },

  /** 离线缓冲文件（断网时落盘，恢复后补传） */
  bufferFile: str('BUFFER_FILE', '/tmp/fk-gateway-buffer.jsonl'),

  /** Modbus 站点 Profile 目录（modbus 模式） */
  profileDir: str('PROFILE_DIR', './profiles')
}

export type GatewayConfig = typeof config
