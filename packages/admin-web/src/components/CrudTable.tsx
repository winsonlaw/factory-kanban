/**
 * 通用 CRUD 表格 —— 配置 + 表单驱动，复用于设备类型/字典/生产等表型模块。
 * 传入实体名、列、表单字段，即得「列表 + 新建/编辑弹窗 + 删除」。
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  App
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api } from '../api'
import type { EntityKey } from '../types'

export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'switch'
  options?: { label: string; value: string | number }[]
  required?: boolean
  disabledOnEdit?: boolean // 主键类字段编辑时锁定
  initial?: unknown
}

type Row = Record<string, unknown>

interface Props {
  entity: EntityKey
  rowKey: string
  columns: ColumnsType<Row>
  fields: FormField[]
  /** 仅展示满足条件的行（用于按上级过滤） */
  filter?: (row: Row) => boolean
  /** 新建时注入的默认值（如所属上级 id） */
  createDefaults?: Row
  title?: string
  reloadKey?: unknown // 外部变化触发重载
  onChanged?: () => void
}

export function CrudTable({
  entity,
  rowKey,
  columns,
  fields,
  filter,
  createDefaults,
  title,
  reloadKey,
  onChanged
}: Props) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const data = (await api.list(entity)) as unknown as Row[]
      setRows(data)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, reloadKey])

  const shown = useMemo(() => (filter ? rows.filter(filter) : rows), [rows, filter])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    const init: Row = { ...createDefaults }
    for (const f of fields) if (f.initial !== undefined && init[f.name] === undefined) init[f.name] = f.initial
    form.setFieldsValue(init)
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditing(row)
    form.setFieldsValue(row)
    setOpen(true)
  }

  const submit = async () => {
    const values = (await form.validateFields()) as Row
    try {
      if (editing) {
        await api.update(entity, String(editing[rowKey]), values as never)
        message.success('已更新')
      } else {
        await api.create(entity, { ...createDefaults, ...values } as never)
        message.success('已创建')
      }
      setOpen(false)
      await load()
      onChanged?.()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const del = async (row: Row) => {
    try {
      await api.remove(entity, String(row[rowKey]))
      message.success('已删除')
      await load()
      onChanged?.()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const actionCol: ColumnsType<Row>[number] = {
    title: '操作',
    key: '__act',
    width: 140,
    render: (_, row) => (
      <Space>
        <a onClick={() => openEdit(row)}>编辑</a>
        <Popconfirm title="确认删除？将级联清理下级配置" onConfirm={() => del(row)}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>
      </Space>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建
        </Button>
      </div>
      <Table
        size="middle"
        rowKey={rowKey}
        loading={loading}
        dataSource={shown}
        columns={[...columns, actionCol]}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
      />
      <Modal
        title={editing ? '编辑' : '新建'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              valuePropName={f.type === 'switch' ? 'checked' : 'value'}
              rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : undefined}
            >
              {f.type === 'text' ? (
                <Input disabled={!!editing && f.disabledOnEdit} />
              ) : f.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} />
              ) : f.type === 'switch' ? (
                <Switch />
              ) : (
                <Select options={f.options} disabled={!!editing && f.disabledOnEdit} />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  )
}
