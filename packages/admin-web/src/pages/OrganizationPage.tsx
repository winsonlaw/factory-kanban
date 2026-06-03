/**
 * 组织架构 —— 车间 > 产线 > 站位 层级树（参考 ThingsBoard 资产树）。
 * 左树导航，右侧详情 + 新建下级 / 编辑 / 删除（级联）。
 */

import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Tree
} from 'antd'
import { ApartmentOutlined, PlusOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { api } from '../api'
import { useConfig } from '../useConfig'
import type { Line, Station, Workshop } from '../types'

type NodeKind = 'ws' | 'line' | 'st'
interface EditState {
  kind: NodeKind
  mode: 'create' | 'edit'
  parentId?: string
  record?: Workshop | Line | Station
}

export function OrganizationPage() {
  const { message } = App.useApp()
  const { data, reload } = useConfig()
  const [selected, setSelected] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [form] = Form.useForm()

  const treeData: DataNode[] = useMemo(
    () =>
      data.workshops.map((ws) => ({
        key: `ws:${ws.id}`,
        title: ws.name,
        children: data.lines
          .filter((l) => l.workshopId === ws.id)
          .sort((a, b) => a.seq - b.seq)
          .map((l) => ({
            key: `line:${l.id}`,
            title: l.name,
            children: data.stations
              .filter((s) => s.lineId === l.id)
              .sort((a, b) => a.seq - b.seq)
              .map((s) => ({ key: `st:${s.id}`, title: s.name, isLeaf: true }))
          }))
      })),
    [data]
  )

  const sel = useMemo(() => {
    if (!selected) return null
    const [kind, id] = selected.split(':') as [NodeKind, string]
    if (kind === 'ws') return { kind, item: data.workshops.find((w) => w.id === id) }
    if (kind === 'line') return { kind, item: data.lines.find((l) => l.id === id) }
    return { kind, item: data.stations.find((s) => s.id === id) }
  }, [selected, data])

  const profileOpts = data.deviceProfiles.map((p) => ({ label: `${p.name} (${p.key})`, value: p.key }))

  const openModal = (st: EditState) => {
    setEdit(st)
    form.resetFields()
    if (st.record) form.setFieldsValue(st.record)
    else if (st.kind === 'line') form.setFieldsValue({ taktSec: 18, targetCount: 1400, seq: 1 })
    else if (st.kind === 'st') form.setFieldsValue({ seq: 1, stdCycleMs: 12000, deviceType: 'smt_mounter', id: `${st.parentId}-S0` })
  }

  const entityOf = (k: NodeKind): 'workshops' | 'lines' | 'stations' =>
    k === 'ws' ? 'workshops' : k === 'line' ? 'lines' : 'stations'

  const submit = async () => {
    if (!edit) return
    const values = await form.validateFields()
    const entity = entityOf(edit.kind)
    try {
      if (edit.mode === 'edit' && edit.record) {
        await api.update(entity, edit.record.id, values as never)
      } else {
        // 注入父级 id
        const payload =
          edit.kind === 'line'
            ? { ...values, workshopId: edit.parentId }
            : edit.kind === 'st'
              ? { ...values, lineId: edit.parentId }
              : values
        await api.create(entity, payload as never)
      }
      message.success('已保存')
      setEdit(null)
      await reload()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const del = async (kind: NodeKind, id: string) => {
    await api.remove(entityOf(kind), id)
    message.success('已删除（含下级）')
    setSelected(null)
    await reload()
  }

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title={<span><ApartmentOutlined /> 资产层级</span>} size="small"
          extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openModal({ kind: 'ws', mode: 'create' })}>车间</Button>}>
          {treeData.length ? (
            <Tree
              treeData={treeData}
              defaultExpandAll
              selectedKeys={selected ? [selected] : []}
              onSelect={(keys) => setSelected((keys[0] as string) ?? null)}
            />
          ) : (
            <Empty description="暂无数据" />
          )}
        </Card>
      </Col>

      <Col span={16}>
        <Card title="详情" size="small">
          {!sel?.item ? (
            <Empty description="从左侧选择节点" />
          ) : sel.kind === 'ws' ? (
            <WsDetail
              ws={sel.item as Workshop}
              lineCount={data.lines.filter((l) => l.workshopId === (sel.item as Workshop).id).length}
              onAddLine={() => openModal({ kind: 'line', mode: 'create', parentId: (sel.item as Workshop).id })}
              onEdit={() => openModal({ kind: 'ws', mode: 'edit', record: sel.item })}
              onDel={() => del('ws', (sel.item as Workshop).id)}
            />
          ) : sel.kind === 'line' ? (
            <LineDetail
              line={sel.item as Line}
              stationCount={data.stations.filter((s) => s.lineId === (sel.item as Line).id).length}
              onAddStation={() => openModal({ kind: 'st', mode: 'create', parentId: (sel.item as Line).id })}
              onEdit={() => openModal({ kind: 'line', mode: 'edit', record: sel.item })}
              onDel={() => del('line', (sel.item as Line).id)}
            />
          ) : (
            <StationDetail
              st={sel.item as Station}
              profileName={data.deviceProfiles.find((p) => p.key === (sel.item as Station).deviceType)?.name}
              collectorCount={data.collectors.filter((c) => c.stationId === (sel.item as Station).id).length}
              onEdit={() => openModal({ kind: 'st', mode: 'edit', record: sel.item })}
              onDel={() => del('st', (sel.item as Station).id)}
            />
          )}
        </Card>
      </Col>

      <Modal
        title={`${edit?.mode === 'edit' ? '编辑' : '新建'}${edit?.kind === 'ws' ? '车间' : edit?.kind === 'line' ? '产线' : '站位'}`}
        open={!!edit}
        onOk={submit}
        onCancel={() => setEdit(null)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input disabled={edit?.mode === 'edit'} placeholder={edit?.kind === 'st' ? `${edit?.parentId}-S07` : '唯一ID'} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {edit?.kind === 'line' && (
            <>
              <Form.Item name="taktSec" label="Takt 产距时间(秒)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="targetCount" label="当班计划产量" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="seq" label="排序" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          {edit?.kind === 'st' && (
            <>
              <Form.Item name="seq" label="工序顺序" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="deviceType" label="设备类型" rules={[{ required: true }]}>
                <Select options={profileOpts} />
              </Form.Item>
              <Form.Item name="stdCycleMs" label="标准节拍(ms)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Row>
  )
}

function Actions({ onEdit, onDel, addLabel, onAdd }: { onEdit: () => void; onDel: () => void; addLabel?: string; onAdd?: () => void }) {
  return (
    <Space style={{ marginBottom: 16 }}>
      {onAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{addLabel}</Button>}
      <Button onClick={onEdit}>编辑</Button>
      <Popconfirm title="确认删除？将级联清理下级" onConfirm={onDel}>
        <Button danger>删除</Button>
      </Popconfirm>
    </Space>
  )
}

function WsDetail({ ws, lineCount, onAddLine, onEdit, onDel }: { ws: Workshop; lineCount: number; onAddLine: () => void; onEdit: () => void; onDel: () => void }) {
  return (
    <>
      <Actions onEdit={onEdit} onDel={onDel} addLabel="新建产线" onAdd={onAddLine} />
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="车间ID">{ws.id}</Descriptions.Item>
        <Descriptions.Item label="名称">{ws.name}</Descriptions.Item>
        <Descriptions.Item label="所属工厂">{ws.factoryId}</Descriptions.Item>
        <Descriptions.Item label="产线数">{lineCount}</Descriptions.Item>
      </Descriptions>
    </>
  )
}

function LineDetail({ line, stationCount, onAddStation, onEdit, onDel }: { line: Line; stationCount: number; onAddStation: () => void; onEdit: () => void; onDel: () => void }) {
  return (
    <>
      <Actions onEdit={onEdit} onDel={onDel} addLabel="新建站位" onAdd={onAddStation} />
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="产线ID">{line.id}</Descriptions.Item>
        <Descriptions.Item label="名称">{line.name}</Descriptions.Item>
        <Descriptions.Item label="Takt(秒)">{line.taktSec}</Descriptions.Item>
        <Descriptions.Item label="计划产量">{line.targetCount}</Descriptions.Item>
        <Descriptions.Item label="站位数">{stationCount}</Descriptions.Item>
      </Descriptions>
    </>
  )
}

function StationDetail({ st, profileName, collectorCount, onEdit, onDel }: { st: Station; profileName?: string; collectorCount: number; onEdit: () => void; onDel: () => void }) {
  return (
    <>
      <Actions onEdit={onEdit} onDel={onDel} />
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="站位ID">{st.id}</Descriptions.Item>
        <Descriptions.Item label="名称">{st.name}</Descriptions.Item>
        <Descriptions.Item label="设备类型"><Tag>{profileName ?? st.deviceType}</Tag></Descriptions.Item>
        <Descriptions.Item label="标准节拍">{st.stdCycleMs} ms</Descriptions.Item>
        <Descriptions.Item label="采集服务数">{collectorCount}</Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 12, color: '#888' }}>提示：在「采集服务」模块为本站配置通讯块与数据块。</div>
    </>
  )
}
