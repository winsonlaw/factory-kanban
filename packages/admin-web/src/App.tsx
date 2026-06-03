import { useState } from 'react'
import { Layout, Menu, Typography } from 'antd'
import {
  ApartmentOutlined,
  ApiOutlined,
  HddOutlined,
  BookOutlined,
  ScheduleOutlined
} from '@ant-design/icons'
import { OrganizationPage } from './pages/OrganizationPage'
import { AcquisitionPage } from './pages/AcquisitionPage'
import { DeviceProfilePage } from './pages/DeviceProfilePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { ProductionPage } from './pages/ProductionPage'

const { Sider, Header, Content } = Layout
const { Title } = Typography

type ModuleKey = 'org' | 'acquisition' | 'device' | 'dict' | 'production'

const MENU = [
  { key: 'org', icon: <ApartmentOutlined />, label: '组织架构' },
  { key: 'acquisition', icon: <ApiOutlined />, label: '采集服务' },
  { key: 'device', icon: <HddOutlined />, label: '设备类型' },
  { key: 'dict', icon: <BookOutlined />, label: '数据字典' },
  { key: 'production', icon: <ScheduleOutlined />, label: '生产配置' }
]

export function App() {
  const [active, setActive] = useState<ModuleKey>('org')

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="dark" width={208}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏭</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>看板管理后台</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[active]}
          items={MENU}
          onClick={(e) => setActive(e.key as ModuleKey)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: '16px 0' }}>
            {MENU.find((m) => m.key === active)?.label}
          </Title>
        </Header>
        <Content style={{ padding: 20, overflow: 'auto', background: '#f5f6fa' }}>
          {active === 'org' && <OrganizationPage />}
          {active === 'acquisition' && <AcquisitionPage />}
          {active === 'device' && <DeviceProfilePage />}
          {active === 'dict' && <DictionaryPage />}
          {active === 'production' && <ProductionPage />}
        </Content>
      </Layout>
    </Layout>
  )
}
