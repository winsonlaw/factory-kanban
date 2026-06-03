-- 工厂生产看板 —— 业务库（PostgreSQL）初始化。
-- 对应《数据采集清单与数据结构》中 📋 基础数据 + 🔗 工单 + 🧮 班次聚合/事件。
-- 时序遥测（⚙️）存 TDengine，不在此库。

-- ───────────── 📋 组织档案 ─────────────
CREATE TABLE IF NOT EXISTS factory (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zone (
  id          TEXT PRIMARY KEY,
  factory_id  TEXT NOT NULL REFERENCES factory(id),
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS line (
  id           TEXT PRIMARY KEY,
  zone_id      TEXT NOT NULL REFERENCES zone(id),
  name         TEXT NOT NULL,
  takt_sec     INT  NOT NULL DEFAULT 18,
  target_count INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station (
  id            TEXT NOT NULL,
  line_id       TEXT NOT NULL REFERENCES line(id),
  name          TEXT NOT NULL,
  device_type   TEXT NOT NULL,
  std_cycle_ms  INT  NOT NULL,
  PRIMARY KEY (line_id, id)
);

-- ───────────── 📋 班次 / 目标 / 字典 / 成本 ─────────────
CREATE TABLE IF NOT EXISTS shift (
  id           TEXT PRIMARY KEY,
  zone_id      TEXT NOT NULL REFERENCES zone(id),
  name         TEXT NOT NULL,
  start_min    INT  NOT NULL,   -- 自 00:00 起的分钟
  end_min      INT  NOT NULL,
  break_min    INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS defect_dict (
  code  TEXT PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alarm_dict (
  code  TEXT PRIMARY KEY,
  name  TEXT NOT NULL
);

-- ───────────── 🔗 工单（来自 MES） ─────────────
CREATE TABLE IF NOT EXISTS work_order (
  order_no       TEXT PRIMARY KEY,
  mes_order_id   TEXT,
  status         TEXT NOT NULL,
  product_model  TEXT NOT NULL,
  product_code   TEXT,
  planned_qty    INT  NOT NULL,
  completed_qty  INT  NOT NULL DEFAULT 0,
  due_ts         BIGINT NOT NULL,
  priority       INT,
  target_line_id TEXT REFERENCES line(id),
  std_cycle_sec  INT,
  unit_cost      NUMERIC(12,2),
  updated_ts     BIGINT NOT NULL DEFAULT (extract(epoch from now())*1000)
);
CREATE INDEX IF NOT EXISTS idx_wo_line ON work_order(target_line_id);
CREATE INDEX IF NOT EXISTS idx_wo_updated ON work_order(updated_ts);

-- ───────────── 🧮 生产事件（回传 MES 的留底 / 对账） ─────────────
CREATE TABLE IF NOT EXISTS production_event (
  event_id    TEXT PRIMARY KEY,        -- 幂等键
  event_type  TEXT NOT NULL,
  occurred_ts BIGINT NOT NULL,
  line_id     TEXT,
  order_no    TEXT,
  payload     JSONB NOT NULL,
  mes_acked   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_evt_order ON production_event(order_no);
CREATE INDEX IF NOT EXISTS idx_evt_acked ON production_event(mes_acked);

-- ───────────── 🧮 班次聚合（每班每线一行，供趋势/达成） ─────────────
CREATE TABLE IF NOT EXISTS shift_summary (
  shift_date  DATE NOT NULL,
  shift_id    TEXT NOT NULL,
  line_id     TEXT NOT NULL,
  good_qty    INT  NOT NULL DEFAULT 0,
  fail_qty    INT  NOT NULL DEFAULT 0,
  oee         NUMERIC(5,4),
  PRIMARY KEY (shift_date, shift_id, line_id)
);

-- ───────────── 种子数据 ─────────────
INSERT INTO factory(id,name) VALUES ('F01','深圳总部工厂') ON CONFLICT DO NOTHING;
INSERT INTO zone(id,factory_id,name) VALUES ('Z01','F01','SMT车间') ON CONFLICT DO NOTHING;
INSERT INTO shift(id,zone_id,name,start_min,end_min,break_min)
  VALUES ('SH-MORNING','Z01','早班',480,1020,60) ON CONFLICT DO NOTHING;

INSERT INTO defect_dict(code,name) VALUES
  ('SHORT','开短路'),('OFFSET','偏移'),('MISSING','缺件'),('TOMB','立碑'),('COLD','虚焊')
  ON CONFLICT DO NOTHING;
INSERT INTO alarm_dict(code,name) VALUES
  ('TEMP_OVER','炉温超限'),('FEEDER_ERR','飞达异常'),('NO_MATERIAL','缺料停机'),
  ('E_STOP','急停'),('JAM','卡板')
  ON CONFLICT DO NOTHING;
