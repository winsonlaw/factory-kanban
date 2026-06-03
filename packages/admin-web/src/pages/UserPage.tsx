import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { authApi } from '../api'
import { ROLE_LABELS, type AuthUser, type Role } from '../auth'

const ROLE_COLOR: Record<Role, string> = { admin: 'red', ops: 'blue', viewer: 'default' }

export function UserPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<AuthUser[]>([])
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; record?: AuthUser } | null>(null)
  const [form] = Form.useForm()

  const load = async () => setRows(await authApi.listUsers())
  useEffect(() => {
    void load()
  }, [])

  const open = (m: { mode: 'create' | 'edit'; record?: AuthUser }) => {
    setModal(m)
    form.resetFields()
    if (m.record) form.setFieldsValue(m.record)
    else form.setFieldsValue({ role: 'viewer' })
  }

  const submit = async () => {
    const v = await form.validateFields()
    try {
      if (modal?.mode === 'edit' && modal.record) await authApi.updateUser(modal.record.id!, v)
      else await authApi.createUser({ ...v, id: v.username })
      message.success('已保存')
      setModal(null)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const del = async (u: AuthUser) => {
    try {
      await authApi.removeUser(u.id!)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <Card
      title="用户与权限"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open({ mode: 'create' })}>新建用户</Button>}
    >
      <Table
        rowKey="username"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'name' },
          { title: '角色', dataIndex: 'role', render: (r: Role) => <Tag color={ROLE_COLOR[r]}>{ROLE_LABELS[r]}</Tag> },
          {
            title: '操作',
            width: 140,
            render: (_, u: AuthUser) => (
              <Space>
                <a onClick={() => open({ mode: 'edit', record: u })}>编辑</a>
                <Popconfirm title="确认删除该用户？" onConfirm={() => del(u)} disabled={u.username === 'admin'}>
                  <a style={{ color: u.username === 'admin' ? '#ccc' : '#ff4d4f' }}>删除</a>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
      <Modal title={modal?.mode === 'edit' ? '编辑用户' : '新建用户'} open={!!modal} onOk={submit} onCancel={() => setModal(null)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={modal?.mode === 'edit'} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={(['admin', 'ops', 'viewer'] as Role[]).map((r) => ({ label: ROLE_LABELS[r], value: r }))} />
          </Form.Item>
          <Form.Item name="password" label={modal?.mode === 'edit' ? '重置密码（留空不改）' : '密码'} rules={modal?.mode === 'edit' ? [] : [{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
