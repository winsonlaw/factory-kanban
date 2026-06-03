import { Card, Tabs } from 'antd'
import { CrudTable } from '../components/CrudTable'
import { useConfig } from '../useConfig'

export function ProductionPage() {
  const { data } = useConfig()
  const workshopOpts = data.workshops.map((w) => ({ label: w.name, value: w.id }))
  const lineOpts = data.lines.map((l) => ({ label: l.name, value: l.id }))
  const lineName = (id: unknown) => data.lines.find((l) => l.id === id)?.name ?? String(id ?? '')
  const wsName = (id: unknown) => data.workshops.find((w) => w.id === id)?.name ?? String(id ?? '')

  return (
    <Card>
      <Tabs
        items={[
          {
            key: 'shift',
            label: '班次',
            children: (
              <CrudTable
                entity="shifts"
                rowKey="id"
                title="班次（决定可用工时 / Takt）"
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  { title: '车间', dataIndex: 'workshopId', key: 'ws', render: wsName },
                  { title: '起(分)', dataIndex: 'startMin', key: 's' },
                  { title: '止(分)', dataIndex: 'endMin', key: 'e' },
                  { title: '休息(分)', dataIndex: 'breakMin', key: 'b' }
                ]}
                fields={[
                  { name: 'id', label: 'ID', type: 'text', required: true, disabledOnEdit: true },
                  { name: 'name', label: '名称', type: 'text', required: true },
                  { name: 'workshopId', label: '车间', type: 'select', options: workshopOpts, required: true },
                  { name: 'startMin', label: '开始(自0点分钟)', type: 'number', required: true, initial: 480 },
                  { name: 'endMin', label: '结束(分钟)', type: 'number', required: true, initial: 1020 },
                  { name: 'breakMin', label: '休息(分钟)', type: 'number', initial: 60 }
                ]}
              />
            )
          },
          {
            key: 'target',
            label: '生产目标',
            children: (
              <CrudTable
                entity="targets"
                rowKey="id"
                title="产线目标（按型号可选）"
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  { title: '产线', dataIndex: 'lineId', key: 'l', render: lineName },
                  { title: '型号', dataIndex: 'model', key: 'm' },
                  { title: '计划量', dataIndex: 'plannedQty', key: 'q' },
                  { title: '标准UPH', dataIndex: 'stdUph', key: 'u' }
                ]}
                fields={[
                  { name: 'id', label: 'ID', type: 'text', required: true, disabledOnEdit: true },
                  { name: 'lineId', label: '产线', type: 'select', options: lineOpts, required: true },
                  { name: 'model', label: '型号(可空)', type: 'text' },
                  { name: 'plannedQty', label: '计划产量', type: 'number', required: true, initial: 1400 },
                  { name: 'stdUph', label: '标准UPH', type: 'number', initial: 200 }
                ]}
              />
            )
          },
          {
            key: 'threshold',
            label: '报警阈值',
            children: (
              <CrudTable
                entity="thresholds"
                rowKey="id"
                title="报警阈值（全局/按线）"
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  { title: '范围', dataIndex: 'scope', key: 'sc' },
                  { title: '产线', dataIndex: 'lineId', key: 'l', render: (v) => (v ? lineName(v) : '—') },
                  { title: '节拍超标比', dataIndex: 'taktWarnRatio', key: 't' },
                  { title: '停机超时(秒)', dataIndex: 'downtimeSec', key: 'd' },
                  { title: '连续不良', dataIndex: 'consecutiveFail', key: 'c' }
                ]}
                fields={[
                  { name: 'id', label: 'ID', type: 'text', required: true, disabledOnEdit: true },
                  { name: 'scope', label: '范围', type: 'select', options: [{ label: '全局', value: 'global' }, { label: '按产线', value: 'line' }], required: true, initial: 'global' },
                  { name: 'lineId', label: '产线(范围=按线时)', type: 'select', options: lineOpts },
                  { name: 'taktWarnRatio', label: '节拍超标比(如1.15)', type: 'number', required: true, initial: 1.15 },
                  { name: 'downtimeSec', label: '停机超时(秒)', type: 'number', required: true, initial: 300 },
                  { name: 'consecutiveFail', label: '连续不良触发数', type: 'number', required: true, initial: 3 }
                ]}
              />
            )
          }
        ]}
      />
    </Card>
  )
}
