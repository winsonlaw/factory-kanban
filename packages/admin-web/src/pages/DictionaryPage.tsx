import { Card, Tabs } from 'antd'
import { CrudTable } from '../components/CrudTable'

const codeFields = [
  { name: 'code', label: '代码', type: 'text' as const, required: true, disabledOnEdit: true },
  { name: 'name', label: '名称', type: 'text' as const, required: true }
]
const codeColumns = [
  { title: '代码', dataIndex: 'code', key: 'code' },
  { title: '名称', dataIndex: 'name', key: 'name' }
]

export function DictionaryPage() {
  return (
    <Card>
      <Tabs
        items={[
          {
            key: 'defect',
            label: '缺陷字典',
            children: (
              <CrudTable entity="defectCodes" rowKey="code" title="缺陷代码（支撑缺陷 Pareto）" columns={codeColumns} fields={codeFields} />
            )
          },
          {
            key: 'alarm',
            label: '停机/报警字典',
            children: (
              <CrudTable entity="alarmCodes" rowKey="code" title="报警代码（支撑停机 Pareto）" columns={codeColumns} fields={codeFields} />
            )
          }
        ]}
      />
    </Card>
  )
}
