import { useState } from 'react'
import { THEMES, useTheme } from '../store/theme'

export function ThemeSwitcher() {
  const { current, set } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 11,
          padding: '3px 10px',
          borderRadius: 4,
          background: `${current.primary}18`,
          color: current.primary,
          border: `1px solid ${current.primary}40`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: current.primary, display: 'inline-block' }} />
        {current.name}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded overflow-hidden z-50"
          style={{ background: '#0d1629', border: `1px solid ${current.primary}30`, minWidth: 120 }}
        >
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => { set(t.id); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 12px',
                fontSize: 12,
                color: t.id === current.id ? t.primary : 'rgba(255,255,255,0.6)',
                background: t.id === current.id ? `${t.primary}15` : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.primary, display: 'inline-block', flexShrink: 0 }} />
              {t.name}
              {t.id === current.id && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
