/**
 * 数据平台对外契约 barrel —— 边缘网关、MES 适配器、WebSocket 推送层统一从这里引入类型。
 *
 * 分三组：
 *   common      公共标识/状态/信封
 *   device      南向设备遥测与事件（设备 → 边缘 → 中心）
 *   mes         MES 对接 DTO（中心 ↔ MES，REST + Webhook）
 *   mqtt-topics 边缘 ↔ 中心 的 MQTT 主题约定
 */

export * from './common.js'
export * from './device.js'
export * from './mes.js'
export * from './mqtt-topics.js'
