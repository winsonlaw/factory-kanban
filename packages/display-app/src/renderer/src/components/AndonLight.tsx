import { useTheme } from '../store/theme'

/**
 * 达成红黄绿大灯 —— 主任一眼判断"今天稳不稳"
 * 阈值：≥100%达标(绿) ≥90%正常(青) ≥80%紧张(黄) <80%告急(红)
 */
export function AndonLight({ value, size = 150 }: { value: number; size?: number }) {
  const { current: t } = useTheme()
  const pct = Math.round(value * 100)
  const color = value >= 1 ? t.good : value >= 0.9 ? t.primary : value >= 0.8 ? t.warn : t.alarm
  const text = value >= 1 ? '达标' : value >= 0.9 ? '正常' : value >= 0.8 ? '紧张' : '告急'

  return (
    <div
      className="rounded-full flex flex-col items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        border: `${Math.round(size * 0.05)}px solid ${color}`,
        boxShadow: `0 0 ${size * 0.18}px ${color}50, inset 0 0 ${size * 0.12}px ${color}30`,
        background: `${color}0d`
      }}
    >
      <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: size * 0.34, lineHeight: 1, color }}>
        {pct}<span style={{ fontSize: size * 0.16 }}>%</span>
      </span>
      <span style={{ fontSize: size * 0.12, color, fontWeight: 700, marginTop: size * 0.02 }}>{text}</span>
    </div>
  )
}
