import { useState } from 'react'
import { TabBar } from 'antd-mobile'
import { Dashboard } from './pages/Dashboard'
import { Trends } from './pages/Trends'

export function App() {
  const [tab, setTab] = useState('dash')

  return (
    <div style={{ paddingBottom: 52 }}>
      <div style={{ display: tab === 'dash' ? 'block' : 'none' }}><Dashboard /></div>
      {tab === 'trend' && <Trends />}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', zIndex: 100 }}>
        <TabBar activeKey={tab} onChange={setTab}>
          <TabBar.Item key="dash" icon={<span style={{ fontSize: 18 }}>📊</span>} title="经营" />
          <TabBar.Item key="trend" icon={<span style={{ fontSize: 18 }}>📈</span>} title="趋势" />
        </TabBar>
      </div>
    </div>
  )
}
