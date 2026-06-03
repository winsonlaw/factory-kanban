import { useKanban, type RoleView } from '../store/kanban'
import { useTheme } from '../store/theme'

const VIEWS: { id: RoleView; label: string }[] = [
  { id: 'overview', label: '车间总览' },
  { id: 'dispatch', label: '调度中心' },
  { id: 'director', label: '主任驾驶舱' },
  { id: 'showcase', label: '参观大屏' }
]

/** 角色视图切换器（顶栏）*/
export function ViewSwitcher() {
  const { roleView, setRoleView } = useKanban()
  const { current: t } = useTheme()

  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
      {VIEWS.map(v => {
        const active = roleView === v.id
        return (
          <button
            key={v.id}
            onClick={() => setRoleView(v.id)}
            style={{
              fontSize: 13,
              padding: '5px 14px',
              color: active ? '#fff' : t.textMuted,
              background: active ? t.primary : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: active ? 700 : 400
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
