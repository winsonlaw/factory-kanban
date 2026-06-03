import { useTheme } from '../store/theme'
import { useNow } from '../hooks/useNow'
import { formatElapsed } from '../utils/pacing'

/** 倒计时芯片 —— 换型/缺料剩余时间，<5分钟变橙告急 */
export function CountdownChip({ startTs, durationSec, size = 'md' }: {
  startTs: number; durationSec: number; size?: 'md' | 'lg'
}) {
  const { current: t } = useTheme()
  const now = useNow(1000)
  const remainMs = Math.max(0, startTs + durationSec * 1000 - now)
  const done = remainMs <= 0
  const urgent = remainMs > 0 && remainMs < 5 * 60 * 1000
  const color = done ? t.good : urgent ? t.warn : t.primary
  const fs = size === 'lg' ? 26 : 20

  return (
    <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: fs, color, lineHeight: 1 }}>
      {done ? '完成' : formatElapsed(remainMs)}
    </span>
  )
}

/** 按剩余分钟显示的倒计时（缺料用，输入已是分钟）*/
export function RemainMinChip({ remainMin, size = 'md' }: { remainMin: number; size?: 'md' | 'lg' }) {
  const { current: t } = useTheme()
  const urgent = remainMin < 20
  const color = urgent ? t.alarm : remainMin < 40 ? t.warn : t.primary
  const fs = size === 'lg' ? 26 : 20
  return (
    <span className="font-bold" style={{ fontFamily: 'Rajdhani, monospace', fontSize: fs, color, lineHeight: 1 }}>
      {remainMin}<span style={{ fontSize: fs * 0.55 }}> 分</span>
    </span>
  )
}
