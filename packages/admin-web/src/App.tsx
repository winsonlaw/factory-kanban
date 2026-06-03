import { useState } from 'react'
import { Button, Dropdown, Layout, Menu, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  ApiOutlined,
  HddOutlined,
  BookOutlined,
  ScheduleOutlined,
  TeamOutlined,
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined
} from '@ant-design/icons'
import { DeviceOverviewPage } from './pages/DeviceOverviewPage'
import { OrganizationPage } from './pages/OrganizationPage'
import { AcquisitionPage } from './pages/AcquisitionPage'
import { DeviceProfilePage } from './pages/DeviceProfilePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { ProductionPage } from './pages/ProductionPage'
import { UserPage } from './pages/UserPage'
import { LoginPage } from './pages/LoginPage'
import { ROLE_LABELS, useAuth } from './auth'

const { Sider, Header, Content } = Layout
const { Title } = Typography

type ModuleKey = 'overview' | 'org' | 'acquisition' | 'device' | 'dict' | 'production' | 'users'

const BASE_MENU = [
  { key: 'overview', icon: <DashboardOutlined />, label: '设备总览' },
  { key: 'org', icon: <ApartmentOutlined />, label: '组织架构' },
  { key: 'acquisition', icon: <ApiOutlined />, label: '采集服务' },
  { key: 'device', icon: <HddOutlined />, label: '设备类型' },
  { key: 'dict', icon: <BookOutlined />, label: '数据字典' },
  { key: 'production', icon: <ScheduleOutlined />, label: '生产配置' }
]

export function App() {
  const { user, isAdmin, logout } = useAuth()
  const [active, setActive] = useState<ModuleKey>('overview')

  if (!user) return <LoginPage />

  const menu = isAdmin
    ? [...BASE_MENU, { key: 'users', icon: <TeamOutlined />, label: '用户权限' }]
    : BASE_MENU

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="dark" width={208}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏭</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>看板管理后台</span>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[active]} items={menu} onClick={(e) => setActive(e.key as ModuleKey)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>{menu.find((m) => m.key === active)?.label}</Title>
          <Dropdown
            menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout }] }}
          >
            <Button type="text">
              <UserOutlined /> {user.name} <Tag color={user.role === 'admin' ? 'red' : user.role === 'ops' ? 'blue' : 'default'} style={{ marginLeft: 4 }}>{ROLE_LABELS[user.role]}</Tag>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20, overflow: 'auto', background: '#f5f6fa' }}>
          {active === 'overview' && <DeviceOverviewPage />}
          {active === 'org' && <OrganizationPage />}
          {active === 'acquisition' && <AcquisitionPage />}
          {active === 'device' && <DeviceProfilePage />}
          {active === 'dict' && <DictionaryPage />}
          {active === 'production' && <ProductionPage />}
          {active === 'users' && isAdmin && <UserPage />}
        </Content>
      </Layout>
    </Layout>
  )
}
