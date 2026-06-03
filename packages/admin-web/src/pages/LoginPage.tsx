import { useState } from 'react'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { authApi } from '../api'
import { useAuth } from '../auth'

export function LoginPage() {
  const { message } = App.useApp()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)

  const submit = async (v: { username: string; password: string }) => {
    setLoading(true)
    try {
      const { token, user } = await authApi.login(v.username, v.password)
      login(token, user)
      message.success(`欢迎，${user.name}`)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0b1f3a,#13355e)' }}>
      <Card style={{ width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32 }}>🏭</div>
          <Typography.Title level={4} style={{ marginTop: 8 }}>生产看板 · 管理后台</Typography.Title>
        </div>
        <Form onFinish={submit} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
        </Form>
        <div style={{ marginTop: 16, color: '#999', fontSize: 12, textAlign: 'center' }}>
          演示账号：admin/admin123 · ops/ops123 · viewer/viewer123
        </div>
      </Card>
    </div>
  )
}
