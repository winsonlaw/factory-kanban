# Factory Kanban — 工厂生产看板系统

集团级多工厂生产可视化系统，覆盖从 PLC 数据采集到车间大屏展示的完整链路。支持 10+ 厂区并发接入，数据延迟 ≤ 3 秒。

---

## 系统架构

```
设备 / PLC 层 (Modbus · OPC-UA · MQTT · RS485)
        ↓
边缘网关  packages/edge-gateway      每车间一台工控机，本地缓冲30分钟
        ↓ MQTT over TLS
数据平台  packages/data-platform      EMQX + TDengine + PostgreSQL + Redis
        ↓ WebSocket 实时推送
大屏应用  packages/display-app        Electron (Windows/macOS) + Capacitor (Android)
管理后台  packages/admin-web          Web 端，配置/目标/报警/权限
```

---

## 目录结构

```
factory-kanban/
├── packages/
│   ├── display-app/        # 大屏展示应用（Electron + Capacitor）
│   ├── admin-web/          # 管理后台（React + Ant Design）
│   ├── data-platform/      # 中心数据平台（Node.js + Fastify）
│   └── edge-gateway/       # 边缘采集服务
├── docker/                 # Docker Compose 一键部署
├── docs/                   # 产品规划与信息架构设计文档
└── scripts/                # 部署脚本
```

---

## 大屏应用 (`display-app`)

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 31 + React 18 + TypeScript |
| 样式 | TailwindCSS 3 + CSS Variables |
| 图表 | Apache ECharts 5 |
| 动画 | Framer Motion |
| 状态 | Zustand + WebSocket 实时同步 |
| 移动端 | Capacitor 8（Android APK） |
| 构建 | Vite + electron-vite + electron-builder |

### 五个视图

| 视图 | 文件 | 使用者 | 核心指标 |
|------|------|--------|---------|
| 车间总览 | `WorkshopView.tsx` | 日常监控 | 各产线 OEE、产量 vs 目标、报警 |
| 产线详情 | `LineView.tsx` | 产线组长 | 站位节拍 vs Takt、瓶颈、缺陷 Pareto |
| 车间主任 | `DirectorView.tsx` | 车间主任 | 计划达成率、红黑榜、损失金额、7天趋势 |
| 调度中心 | `DispatchView.tsx` | 现场调度 | 实时报警计时器、缺料预警、换型倒计时 |
| 参观展示 | `ShowcaseView.tsx` | 对外参观 | 大字产量/OEE/良率、粒子流动画 |

### 通用组件

| 组件 | 说明 |
|------|------|
| `PacingCard` | 应产 / 实产 / 欠产 / 落后分钟，红黄绿判断 |
| `AndonLight` | 达成红黄绿大灯 |
| `AlarmTimer` | 报警条 + 已持续时长实时计时器 |
| `TaktBar` | 节拍 vs Takt 对比进度条 |
| `OeeGauge` | OEE 圆弧仪表（颜色随数值变化） |
| `ParetoChart` | 缺陷 / 停机原因帕累托图 |
| `CountdownChip` | 换型 / 缺料倒计时芯片 |
| `TrendChart` | 趋势折线 + 目标线 |

### 颜色语义

| 颜色 | 含义 | 触发条件 |
|------|------|---------|
| 🟢 绿 `#00ff9d` | 正常 / 达标 | OEE ≥ 85%、达成率 ≥ 100%、节拍 ≤ Takt |
| 🟡 黄 `#ffb340` | 预警 / 临界 | OEE 60–85%、落后 ≤ 10% |
| 🔴 红 `#ff4a4a` | 异常 / 未达 | OEE < 60%、停机、节拍超标 > 15% |
| ⚪ 灰 | 停机 / 无数据 | 设备离线、未排产 |

### 快速开始

```bash
cd packages/display-app
npm install

# Web 预览
npm run dev

# Electron 开发模式
npm run dev:electron

# 打包
npm run build:win      # Windows .exe
npm run build:mac      # macOS .dmg
npm run build:android  # Android APK
```

---

## 数据平台 (`data-platform`)

### 组件选型

| 组件 | 选型 | 说明 |
|------|------|------|
| MQTT Broker | EMQX | 集群高可用，支持 10 万+ 并发连接 |
| 时序数据库 | TDengine | 超高写入性能，按设备自动分片 |
| 业务数据库 | PostgreSQL | 工厂 / 产线 / 班次 / 目标等结构化数据 |
| 缓存 | Redis | 最新状态快照，WebSocket 扇出 |
| API 服务 | Node.js + Fastify | WebSocket 实时推送 + REST 历史查询 |

### 核心 API

```
WS  /ws/zone/:zoneId       车间实时数据流
WS  /ws/line/:lineId       产线实时数据流
GET /api/shift/summary     班次统计
GET /api/station/history   站位历史过机
GET /api/oee/:lineId       OEE 计算结果
```

---

## 边缘网关 (`edge-gateway`)

- 支持协议：Modbus TCP/RTU、OPC-UA、MQTT、RS485
- 离线缓冲：断网时本地存储 30 分钟数据，恢复后自动补传
- 采集频率：每次过机推送一条，包含节拍时间、良废品数、设备状态、缺陷代码
- 兼容设计：不同设备类型统一成一套 canonical 消息，协议差异由「设备 Profile」吸收
- 内置 `simulator` 驱动，无需真实 PLC 即可仿真整车间数据流

---

## 快速运行（仿真，零基础设施）

```bash
# 终端1：内置 MQTT broker
cd packages/data-platform && npm install && npm run broker
# 终端2：中心数据平台（http/ws :8080）
npm start
# 终端3：仿真边缘网关
cd packages/edge-gateway && npm install && SIM_SPEED=0.05 npm start
# 大屏接入实时后端
cd packages/display-app && VITE_WS_URL=ws://localhost:8080/ws/workshop/W01 npm run dev
# 管理后台（配置产线/站位/采集服务/通讯块/数据块）
cd packages/admin-web && npm install && npm run dev   # http://localhost:5174
```

详见 [docs/后端运行指南.md](docs/后端运行指南.md)、[docs/管理后台设计.md](docs/管理后台设计.md)。

---

## OEE 计算

```
OEE = 可用率(A) × 表现率(P) × 质量率(Q)

A = 实际运行时间 / 计划运行时间
P = (实产 × 理论节拍) / 实际运行时间
Q = 良品数 / 总产出数
```

目标：OEE ≥ 85%（世界级水平）

---

## Docker 部署（中心平台）

```bash
cd docker
docker compose up -d
# 启动 EMQX · TDengine · PostgreSQL · Redis · data-platform · 仿真 edge-gateway
```

---

## 设计文档

| 文档 | 内容 |
|------|------|
| [产品规划方案](docs/产品规划方案.md) | 完整系统规划、分层架构、里程碑 |
| [看板信息架构设计](docs/看板信息架构设计.md) | 四角色视图、指标词典、信息分层 |
| [数据采集清单与数据结构](docs/数据采集清单与数据结构.md) | 全系统数据来源、清单、结构、存储分布 |
| [对外接口与通道设计](docs/对外接口与通道设计.md) | 南向设备接入 + MES 对接（REST+Webhook）规范 |
| [管理后台设计](docs/管理后台设计.md) | 实体关系、领域划分、配置 API、admin-web 模块 |
| [后端运行指南](docs/后端运行指南.md) | 本地仿真 / Docker 部署 / 环境变量 / 接口 |

---

## 验收标准

- 数据延迟：设备产生 → 大屏刷新 **≤ 3 秒**
- 并发：支持 **100 台**大屏同时在线，单台 CPU < 20%
- 可靠性：边缘断网恢复后数据**零丢失**补传
- 视觉：1080p 大屏，**3 米外**可辨识核心数据
- OEE 精度：与人工统计误差 **< 0.5%**

---

## 开发路线图

| 阶段 | 内容 | 周期 |
|------|------|------|
| P0 | 边缘网关 Modbus 采集 demo + 数据模型 | 2 周 |
| P1 | 中心平台搭建（EMQX + TDengine + API） | 3 周 |
| P2 | 产线详情大屏 MVP（模拟数据） | 2 周 |
| P3 | 车间总览大屏 + 实时数据接入 | 2 周 |
| P4 | 管理后台（配置 / 目标 / 报警） | 3 周 |
| P5 | 多厂区压测 + 离线补传 + 生产上线 | 2 周 |

总计约 **14 周**（3.5 个月）MVP 上线。
