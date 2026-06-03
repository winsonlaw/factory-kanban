import type { EquipmentStatus } from '../types'

const STATUS_CONFIG: Record<EquipmentStatus, { color: string; label: string; pulse: boolean }> = {
  running: { color: '#00ff9d', label: '运行中', pulse: false },
  idle:    { color: '#ffb340', label: '待机', pulse: false },
  stopped: { color: '#6b7280', label: '停机', pulse: false },
  alarm:   { color: '#ff4a4a', label: '报警', pulse: true }
}

interface Props {
  status: EquipmentStatus
  showLabel?: boolean
  size?: number
}

export function StatusDot({ status, showLabel = true, size = 8 }: Props) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cfg.pulse ? 'animate-ping-slow' : ''}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          boxShadow: `0 0 ${size}px ${cfg.color}80`,
          flexShrink: 0
        }}
      />
      {showLabel && (
        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 500 }}>{cfg.label}</span>
      )}
    </span>
  )
}
