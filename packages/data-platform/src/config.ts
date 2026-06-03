/**
 * 运行时配置 —— 全部来自环境变量，带合理默认值。
 * 默认 `STORAGE=memory` + `MES_MODE=mock`，使系统**无需任何外部基础设施即可启动**（仿真/开发）。
 * 生产环境通过 env 切到真实 EMQX / Redis / PostgreSQL / TDengine / MES。
 */

function str(key: string, def: string): string {
  return process.env[key] ?? def
}
function num(key: string, def: number): number {
  const v = process.env[key]
  return v === undefined ? def : Number(v)
}
function bool(key: string, def: boolean): boolean {
  const v = process.env[key]
  return v === undefined ? def : v === '1' || v.toLowerCase() === 'true'
}

export const config = {
  /** memory = 纯内存（默认，免基础设施）；real = 使用 Redis/PostgreSQL/TDengine */
  storage: str('STORAGE', 'memory') as 'memory' | 'real',

  http: {
    host: str('HTTP_HOST', '0.0.0.0'),
    port: num('HTTP_PORT', 8080)
  },

  mqtt: {
    /** 为空则跳过 MQTT 接入（纯 mock/HTTP 模式）。docker 环境填 mqtt://emqx:1883 */
    url: str('MQTT_URL', 'mqtt://localhost:1883'),
    enabled: bool('MQTT_ENABLED', true),
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  },

  redis: {
    url: str('REDIS_URL', 'redis://localhost:6379')
  },

  postgres: {
    url: str('PG_URL', 'postgres://kanban:kanban@localhost:5432/kanban')
  },

  tdengine: {
    /** TDengine REST 接口 */
    url: str('TDENGINE_URL', 'http://localhost:6041'),
    user: str('TDENGINE_USER', 'root'),
    password: str('TDENGINE_PASSWORD', 'taosdata')
  },

  mes: {
    /** mock = 内置假 MES（默认）；rest = 真实 MES REST 接口 */
    mode: str('MES_MODE', 'mock') as 'mock' | 'rest',
    baseUrl: str('MES_BASE_URL', 'http://localhost:9100'),
    apiKey: process.env.MES_API_KEY,
    /** 出站事件回调地址（看板 → MES） */
    callbackUrl: str('MES_CALLBACK_URL', 'http://localhost:9100/production/events'),
    /** Webhook 验签密钥（MES → 看板） */
    webhookSecret: str('MES_WEBHOOK_SECRET', 'dev-secret'),
    /** 工单增量轮询间隔（秒） */
    pollIntervalSec: num('MES_POLL_INTERVAL_SEC', 60),
    /** 生产进度上报间隔（秒） */
    reportIntervalSec: num('MES_REPORT_INTERVAL_SEC', 60)
  },

  /** 快照计算/推送节流间隔（毫秒）。遥测到达即标脏，按此节流构建并广播。 */
  snapshotIntervalMs: num('SNAPSHOT_INTERVAL_MS', 1000),

  /** 报警阈值 */
  thresholds: {
    /** 节拍超标比例报警（实际/标准 > 此值触发 warn） */
    taktWarnRatio: num('TAKT_WARN_RATIO', 1.15),
    /** 连续不良触发工艺异常的件数 */
    consecutiveFailAlarm: num('CONSECUTIVE_FAIL_ALARM', 3)
  }
}

export type AppConfig = typeof config
