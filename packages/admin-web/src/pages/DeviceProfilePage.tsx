import { useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag
} from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../api'
import type { DeviceProfile } from '../types'

export function DeviceProfilePage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<DeviceProfile[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceProfile | null>(null)
  const [form] = Form.useForm()

  const load = async () => setRows(await api.list('deviceProfiles'))
  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ metrics: [] })
    setOpen(true)
  }
  const openEdit = (row: DeviceProfile) => {
    setEditing(row)
    form.setFieldsValue(row)
    setOpen(true)
  }

  const submit = async () => {
    const values = (await form.validateFields()) as DeviceProfile
    try {
      if (editing) await api.update('deviceProfiles', editing.key, values)
      else await api.create('deviceProfiles', values)
      message.success('已保存')
      setOpen(false)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const del = async (row: DeviceProfile) => {
    await api.remove('deviceProfiles', row.key)
    await load()
  }

  return (
    <Card>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>设备类型档案（定义专属遥测 metrics）</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建
        </Button>
      </div>
      <Table
        rowKey="key"
        dataSource={rows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        columns={[
          { title: 'Key', dataIndex: 'key', width: 160 },
          { title: '名称', dataIndex: 'name', width: 140 },
          { title: '分类', dataIndex: 'category', width: 100, render: (v) => <Tag>{v}</Tag> },
          {
            title: '专属遥测字段',
            dataIndex: 'metrics',
            render: (m: DeviceProfile['metrics']) =>
              m.length ? m.map((f) => <Tag key={f.key}>{f.label}{f.unit ? `(${f.unit})` : ''}</Tag>) : <span style={{ color: '#aaa' }}>无</span>
          },
          {
            title: '操作',
            width: 130,
            render: (_, row: DeviceProfile) => (
              <Space>
                <a onClick={() => openEdit(row)}>编辑</a>
                <Popconfirm title="确认删除？" onConfirm={() => del(row)}>
                  <a style={{ color: '#ff4d4f' }}>删除</a>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal title={editing ? '编辑设备类型' : '新建设备类型'} open={open} onOk={submit} onCancel={() => setOpen(false)} width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space>
            <Form.Item name="key" label="Key" rules={[{ required: true }]}>
              <Input disabled={!!editing} placeholder="reflow_oven" />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="回流焊" />
            </Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select style={{ width: 120 }} options={['SMT', 'DIP', '测试', '通用'].map((v) => ({ label: v, value: v }))} />
            </Form.Item>
          </Space>

          <div style={{ fontWeight: 600, margin: '4px 0 12px' }}>专属遥测字段（metrics）</div>
          <Form.List name="metrics">
            {(items, { add, remove }) => (
              <>
                {items.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'key']} rules={[{ required: true }]}>
                      <Input placeholder="字段key peakTempC" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'label']} rules={[{ required: true }]}>
                      <Input placeholder="标签 峰值温度" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'unit']}>
                      <Input placeholder="单位 ℃" style={{ width: 90 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'type']} initialValue="number">
                      <Select style={{ width: 110 }} options={['number', 'string', 'bool', 'number[]'].map((v) => ({ label: v, value: v }))} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ type: 'number' })} icon={<PlusOutlined />} block>
                  添加字段
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  )
}
