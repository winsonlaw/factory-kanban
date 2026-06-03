/**
 * 设备总览 —— IoT 监控页。消费 /api/devices，实时展示工业+IoT 全部设备状态。
 * 只读监控，所有角色可见；4 秒自动刷新。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Card, Col, Descriptions, Drawer, Empty, Row, Select, Statistic, Switch, Table, Tag } from 'antd'
import { ApiOutlined, CheckCircleOutlined, DisconnectOutlined } from '@ant-design/icons'
import { deviceApi } from '../api'
import { useConfig } from '../useConfig'
import type { DeviceState, DeviceSummary } from '../types'

const STATUS_BADGE: Record<string, { status: 'success' | 'warning' | 'error' | 'default'; text: string }> = {
  running: { status: 'success', text: '运行' },
  idle: { status: 'warning', text: '待机' },
  stopped: { status: 'default', text: '停机' },
  alarm: { status: 'error', text: '报警' }
}

function timeAgo(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}秒前`
  if (sec < 3600) return `${Math.round(sec / 60)}分前`
  return `${Math.round(sec / 3600)}时前`
}

function fmtVal(v: unknown): string {
  if (typeof v === 'boolean') return v ? '开' : '关'
  if (typeof v === 'number') return String(Math.round(v * 100) / 100)
  return String(v)
}

export function DeviceOverviewPage() {
  const { data: cfg } = useConfig()
  const [devices, setDevices] = useState<DeviceState[]>([])
  const [summary, setSummary] = useState<DeviceSummary>({ total: 0, online: 0, byType: {} })
  const [zone, setZone] = useState<string>()
  const [dtype, setDtype] = useState<string>()
  const [auto, setAuto] = useState(true)
  const [detail, setDetail] = useState<DeviceState | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()

  // deviceType → 中文名 / 字段标签（取自设备档案）
  const profileName = (k: string) => cfg.deviceProfiles.find((p) => p.key === k)?.name ?? k
  const metricLabel = useMemo(() => {
    const m = new Map<string, { label: string; unit?: string }>()
    for (const p of cfg.deviceProfiles) for (const f of p.metrics) m.set(`${p.key}.${f.key}`, { label: f.label, unit: f.unit })
    return m
  }, [cfg.deviceProfiles])

  const load = async () => {
    const [d, s] = await Promise.all([deviceApi.list(), deviceApi.summary()])
    setDevices(d)
    setSummary(s)
  }

  useEffect(() => {
    void load()
    if (auto) timer.current = setInterval(() => void load(), 4000)
    return () => clearInterval(timer.current)
  }, [auto])

  const zones = [...new Set(devices.map((d) => d.zoneId))]
  const types = [...new Set(devices.map((d) => d.deviceType))]
  const shown = devices.filter((d) => (!zone || d.zoneId === zone) && (!dtype || d.deviceType === dtype))

  const renderMetrics = (d: DeviceState, max = 3) => {
    const entries = Object.entries(d.metrics).slice(0, max)
    if (!entries.length) return <span style={{ color: '#bbb' }}>—</span>
    return entries.map(([k, v]) => {
      const lbl = metricLabel.get(`${d.deviceType}.${k}`)
      return <Tag key={k}>{(lbl?.label ?? k)}: {fmtVal(v)}{lbl?.unit ?? ''}</Tag>
    })
  }

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="设备总数" value={summary.total} prefix={<ApiOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="在线" value={summary.online} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="离线" value={summary.total - summary.online} valueStyle={{ color: summary.total - summary.online ? '#cf1322' : undefined }} prefix={<DisconnectOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="设备类型数" value={Object.keys(summary.byType).length} /></Card></Col>
      </Row>

      <Card
        title="设备实时状态（工业 + IoT）"
        extra={
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select allowClear placeholder="按区域" style={{ width: 130 }} value={zone} onChange={setZone}
              options={zones.map((z) => ({ label: z, value: z }))} />
            <Select allowClear placeholder="按类型" style={{ width: 150 }} value={dtype} onChange={setDtype}
              options={types.map((t) => ({ label: profileName(t), value: t }))} />
            <span>自动刷新 <Switch size="small" checked={auto} onChange={setAuto} /></span>
          </span>
        }
      >
        {shown.length === 0 ? (
          <Empty description="暂无设备数据（启动 edge-gateway 后出现）" />
        ) : (
          <Table
            rowKey="deviceId"
            size="middle"
            dataSource={shown}
            pagination={{ pageSize: 12 }}
            onRow={(d) => ({ onClick: () => setDetail(d), style: { cursor: 'pointer' } })}
            columns={[
              { title: '设备ID', dataIndex: 'deviceId', width: 130 },
              { title: '类型', dataIndex: 'deviceType', width: 130, render: (t) => <Tag color="geekblue">{profileName(t)}</Tag> },
              { title: '位置', width: 150, render: (_, d: DeviceState) => `${d.zoneId}/${d.lineId}/${d.stationId}` },
              {
                title: '在线', width: 90, dataIndex: 'online',
                render: (on: boolean) => <Badge status={on ? 'success' : 'error'} text={on ? '在线' : '离线'} />
              },
              {
                title: '状态', width: 90, dataIndex: 'status',
                render: (s: string) => { const b = STATUS_BADGE[s] ?? STATUS_BADGE.idle!; return <Badge status={b.status} text={b.text} /> }
              },
              { title: '关键指标', render: (_, d: DeviceState) => renderMetrics(d) },
              { title: '更新', width: 90, dataIndex: 'lastTs', render: (ts: number) => <span style={{ color: '#999' }}>{timeAgo(ts)}</span> }
            ]}
          />
        )}
      </Card>

      <Drawer width={460} open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.deviceId} · ${profileName(detail.deviceType)}` : ''}>
        {detail && (
          <>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="设备ID">{detail.deviceId}</Descriptions.Item>
              <Descriptions.Item label="类型">{profileName(detail.deviceType)}（{detail.deviceType}）</Descriptions.Item>
              <Descriptions.Item label="位置">{detail.factoryId}/{detail.zoneId}/{detail.lineId}/{detail.stationId}</Descriptions.Item>
              <Descriptions.Item label="在线"><Badge status={detail.online ? 'success' : 'error'} text={detail.online ? '在线' : '离线'} /></Descriptions.Item>
              <Descriptions.Item label="最后更新">{timeAgo(detail.lastTs)}</Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>全部遥测</div>
            <Descriptions bordered column={1} size="small">
              {Object.entries(detail.metrics).map(([k, v]) => {
                const lbl = metricLabel.get(`${detail.deviceType}.${k}`)
                return <Descriptions.Item key={k} label={lbl?.label ?? k}>{fmtVal(v)}{lbl?.unit ?? ''}</Descriptions.Item>
              })}
            </Descriptions>
          </>
        )}
      </Drawer>
    </>
  )
}
