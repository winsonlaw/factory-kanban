/**
 * 采集服务 —— 采集服务(Collector) 绑定到站，挂钩通讯块(CommChannel) 与数据块(DataPoint)。
 * 参考 ThingsBoard Gateway 连接器：一个采集服务 = 一台设备的采集任务。
 */

import { useMemo, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag
} from 'antd'
import { ApiOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { api } from '../api'
import { useConfig } from '../useConfig'
import { useAuth } from '../auth'
import {
  CANONICAL_FIELDS,
  POINT_DATA_TYPES,
  PROTOCOL_LABELS,
  type Collector,
  type CommChannel,
  type DataPoint,
  type ProtocolType
} from '../types'

const PROTOCOLS: ProtocolType[] = [
  'modbus_tcp', 'modbus_rtu', 'opcua', 'mqtt', 'siemens_s7',
  'tcp', 'hilink', 'http', 'coap', 'simulator'
]

/** 各协议的连接参数字段。 */
const CHANNEL_FIELDS: Record<ProtocolType, { name: string; label: string; type: 'text' | 'number' }[]> = {
  modbus_tcp: [
    { name: 'host', label: '主机IP', type: 'text' },
    { name: 'port', label: '端口', type: 'number' },
    { name: 'unitId', label: '从站号', type: 'number' }
  ],
  modbus_rtu: [
    { name: 'serialPort', label: '串口', type: 'text' },
    { name: 'baudRate', label: '波特率', type: 'number' },
    { name: 'unitId', label: '从站号', type: 'number' }
  ],
  opcua: [
    { name: 'endpoint', label: 'Endpoint', type: 'text' },
    { name: 'securityPolicy', label: '安全策略', type: 'text' }
  ],
  mqtt: [
    { name: 'brokerUrl', label: 'Broker URL', type: 'text' },
    { name: 'topic', label: '订阅主题', type: 'text' }
  ],
  siemens_s7: [
    { name: 'host', label: '主机IP', type: 'text' },
    { name: 'rack', label: 'Rack', type: 'number' },
    { name: 'slot', label: 'Slot', type: 'number' }
  ],
  tcp: [
    { name: 'host', label: '主机IP', type: 'text' },
    { name: 'port', label: '端口', type: 'number' },
    { name: 'delimiter', label: '帧分隔符', type: 'text' }
  ],
  hilink: [
    { name: 'productId', label: 'ProductId', type: 'text' },
    { name: 'deviceSn', label: '设备SN', type: 'text' },
    { name: 'region', label: '区域', type: 'text' }
  ],
  http: [
    { name: 'url', label: '接口URL', type: 'text' },
    { name: 'intervalMs', label: '轮询周期(ms)', type: 'number' }
  ],
  coap: [
    { name: 'uri', label: 'CoAP URI', type: 'text' }
  ],
  simulator: []
}

export function AcquisitionPage() {
  const { message } = App.useApp()
  const { data, reload } = useConfig()
  const { canWrite } = useAuth()
  const [colModal, setColModal] = useState<{ mode: 'create' | 'edit'; record?: Collector } | null>(null)
  const [drawer, setDrawer] = useState<Collector | null>(null)
  const [form] = Form.useForm()

  const stationName = (id: string) => data.stations.find((s) => s.id === id)?.name ?? id
  const gatewayName = (id: string) => data.gateways.find((g) => g.id === id)?.name ?? id
  const stationOpts = data.stations.map((s) => ({ label: `${s.name} (${s.id})`, value: s.id }))
  const gatewayOpts = data.gateways.map((g) => ({ label: g.name, value: g.id }))

  const openCol = (m: { mode: 'create' | 'edit'; record?: Collector }) => {
    setColModal(m)
    form.resetFields()
    if (m.record) form.setFieldsValue(m.record)
    else form.setFieldsValue({ protocol: 'modbus_tcp', pollMs: 1000, enabled: true })
  }

  const submitCol = async () => {
    const v = (await form.validateFields()) as Collector
    try {
      if (colModal?.mode === 'edit' && colModal.record) {
        await api.update('collectors', colModal.record.id, v)
      } else {
        await api.create('collectors', v)
        // 同步创建一个空通讯块
        await api.create('channels', { id: `CH-${v.id}`, collectorId: v.id, protocol: v.protocol, config: {} } as CommChannel)
      }
      message.success('已保存')
      setColModal(null)
      await reload()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const delCol = async (c: Collector) => {
    await api.remove('collectors', c.id)
    message.success('已删除（含通讯块/数据块）')
    await reload()
  }

  return (
    <Card
      title={<span><ApiOutlined /> 采集服务（绑定到站，运行于网关）</span>}
      extra={canWrite ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openCol({ mode: 'create' })}>新建采集服务</Button> : null}
    >
      <Table
        rowKey="id"
        dataSource={data.collectors}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '绑定站位', dataIndex: 'stationId', render: stationName },
          { title: '网关', dataIndex: 'gatewayId', render: gatewayName },
          { title: '协议', dataIndex: 'protocol', render: (p: ProtocolType) => <Tag color="blue">{PROTOCOL_LABELS[p]}</Tag> },
          { title: '轮询(ms)', dataIndex: 'pollMs', width: 90 },
          {
            title: '状态',
            dataIndex: 'enabled',
            width: 80,
            render: (e: boolean) => <Badge status={e ? 'success' : 'default'} text={e ? '启用' : '停用'} />
          },
          {
            title: '操作',
            width: 220,
            render: (_, c: Collector) => (
              <Space>
                <a onClick={() => setDrawer(c)}><SettingOutlined /> 通讯/数据块</a>
                {canWrite && <a onClick={() => openCol({ mode: 'edit', record: c })}>编辑</a>}
                {canWrite && (
                  <Popconfirm title="确认删除？" onConfirm={() => delCol(c)}>
                    <a style={{ color: '#ff4d4f' }}>删除</a>
                  </Popconfirm>
                )}
              </Space>
            )
          }
        ]}
      />

      {/* 采集服务表单 */}
      <Modal title={colModal?.mode === 'edit' ? '编辑采集服务' : '新建采集服务'} open={!!colModal} onOk={submitCol} onCancel={() => setColModal(null)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}><Input disabled={colModal?.mode === 'edit'} placeholder="COL-L01-S01" /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="stationId" label="绑定站位" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={stationOpts} /></Form.Item>
          <Form.Item name="gatewayId" label="运行网关" rules={[{ required: true }]}><Select options={gatewayOpts} /></Form.Item>
          <Form.Item name="protocol" label="通讯协议" rules={[{ required: true }]}><Select options={PROTOCOLS.map((p) => ({ label: PROTOCOL_LABELS[p], value: p }))} /></Form.Item>
          <Form.Item name="pollMs" label="轮询周期(ms)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      {/* 通讯块 + 数据块抽屉 */}
      <Drawer width={760} open={!!drawer} onClose={() => setDrawer(null)} title={drawer ? `${drawer.name} · 通讯块 / 数据块` : ''} destroyOnClose>
        {drawer && <ChannelEditor collector={drawer} channels={data.channels} canWrite={canWrite} onSaved={reload} />}
        {drawer && <DataPointEditor collector={drawer} points={data.dataPoints.filter((d) => d.collectorId === drawer.id)} canWrite={canWrite} onChanged={reload} />}
      </Drawer>
    </Card>
  )
}

// ───────────── 通讯块编辑 ─────────────

function ChannelEditor({ collector, channels, canWrite, onSaved }: { collector: Collector; channels: CommChannel[]; canWrite: boolean; onSaved: () => void }) {
  const { message } = App.useApp()
  const existing = useMemo(() => channels.find((c) => c.collectorId === collector.id), [channels, collector.id])
  const [form] = Form.useForm()
  const fields = CHANNEL_FIELDS[collector.protocol]

  const save = async () => {
    const cfg = await form.validateFields()
    try {
      if (existing) await api.update('channels', existing.id, { protocol: collector.protocol, config: cfg })
      else await api.create('channels', { id: `CH-${collector.id}`, collectorId: collector.id, protocol: collector.protocol, config: cfg } as CommChannel)
      message.success('通讯块已保存')
      onSaved()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <Card size="small" type="inner" title={<>通讯块 <Tag color="blue">{PROTOCOL_LABELS[collector.protocol]}</Tag></>} style={{ marginBottom: 16 }}>
      {fields.length === 0 ? (
        <span style={{ color: '#888' }}>该协议（仿真）无需连接参数。</span>
      ) : (
        <Form form={form} layout="inline" initialValues={existing?.config as object} disabled={!canWrite}>
          {fields.map((f) => (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
              {f.type === 'number' ? <InputNumber /> : <Input />}
            </Form.Item>
          ))}
          {canWrite && <Button type="primary" onClick={save}>保存通讯块</Button>}
        </Form>
      )}
    </Card>
  )
}

// ───────────── 数据块（点表）编辑 ─────────────

function DataPointEditor({ collector, points, canWrite, onChanged }: { collector: Collector; points: DataPoint[]; canWrite: boolean; onChanged: () => void }) {
  const { message } = App.useApp()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; record?: DataPoint } | null>(null)
  const [form] = Form.useForm()

  const open = (m: { mode: 'create' | 'edit'; record?: DataPoint }) => {
    setModal(m)
    form.resetFields()
    if (m.record) form.setFieldsValue(m.record)
    else form.setFieldsValue({ canonicalField: 'passCount', dataType: 'uint32', scale: 1, mode: 'value', funcCode: 3 })
  }

  const submit = async () => {
    const v = (await form.validateFields()) as DataPoint
    try {
      if (modal?.mode === 'edit' && modal.record) await api.update('dataPoints', modal.record.id, v)
      else await api.create('dataPoints', { ...v, collectorId: collector.id })
      message.success('已保存')
      setModal(null)
      onChanged()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const del = async (d: DataPoint) => {
    await api.remove('dataPoints', d.id)
    onChanged()
  }

  return (
    <Card
      size="small"
      type="inner"
      title="数据块（点表：寄存器/节点 → canonical 字段）"
      extra={canWrite ? <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => open({ mode: 'create' })}>添加点</Button> : null}
    >
      <Table
        rowKey="id"
        size="small"
        dataSource={points}
        pagination={false}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '目标字段', dataIndex: 'canonicalField', render: (v) => <Tag>{v}</Tag> },
          { title: '地址', dataIndex: 'address' },
          { title: '类型', dataIndex: 'dataType' },
          { title: '缩放', dataIndex: 'scale', width: 60 },
          { title: '模式', dataIndex: 'mode', render: (v) => (v === 'increment' ? '累计取增量' : '直接值') },
          ...(canWrite
            ? [{
                title: '操作',
                width: 110,
                render: (_: unknown, d: DataPoint) => (
                  <Space>
                    <a onClick={() => open({ mode: 'edit', record: d })}>编辑</a>
                    <Popconfirm title="删除该点？" onConfirm={() => del(d)}>
                      <a style={{ color: '#ff4d4f' }}>删</a>
                    </Popconfirm>
                  </Space>
                )
              }]
            : [])
        ]}
      />
      <Modal title="数据块" open={!!modal} onOk={submit} onCancel={() => setModal(null)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}><Input disabled={modal?.mode === 'edit'} placeholder={`DP-${collector.id}-0`} /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="良品累计" /></Form.Item>
          <Form.Item name="canonicalField" label="目标 canonical 字段" rules={[{ required: true }]}>
            <Select options={CANONICAL_FIELDS.map((f) => ({ label: f, value: f }))} />
          </Form.Item>
          <Form.Item name="address" label="地址(寄存器/NodeId/JSON path)" rules={[{ required: true }]}><Input placeholder="40001" /></Form.Item>
          <Space>
            <Form.Item name="dataType" label="数据类型" rules={[{ required: true }]}>
              <Select style={{ width: 120 }} options={POINT_DATA_TYPES.map((t) => ({ label: t, value: t }))} />
            </Form.Item>
            <Form.Item name="scale" label="缩放" rules={[{ required: true }]}><InputNumber /></Form.Item>
            <Form.Item name="mode" label="模式" rules={[{ required: true }]}>
              <Select style={{ width: 130 }} options={[{ label: '直接值', value: 'value' }, { label: '累计取增量', value: 'increment' }]} />
            </Form.Item>
            <Form.Item name="funcCode" label="Modbus功能码"><InputNumber /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  )
}
