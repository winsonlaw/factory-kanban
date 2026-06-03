import { create } from 'zustand'

export interface Theme {
  id: string
  name: string
  bg: string
  bgCard: string
  border: string
  borderHover: string
  primary: string
  primaryGlow: string
  good: string
  warn: string
  alarm: string
  text: string
  textMuted: string
  headerBg: string
  scanline: boolean
}

export const THEMES: Theme[] = [
  {
    id: 'navy',
    name: '深海蓝',
    bg: '#060b18',
    bgCard: 'rgba(255,255,255,0.03)',
    border: 'rgba(0,212,255,0.12)',
    borderHover: 'rgba(0,212,255,0.4)',
    primary: '#00d4ff',
    primaryGlow: '#00d4ff60',
    good: '#00ff9d',
    warn: '#ffb340',
    alarm: '#ff4a4a',
    text: '#e2e8f0',
    textMuted: 'rgba(255,255,255,0.4)',
    headerBg: 'rgba(0,212,255,0.03)',
    scanline: true
  },
  {
    id: 'green',
    name: '工业绿',
    bg: '#04120a',
    bgCard: 'rgba(0,255,136,0.03)',
    border: 'rgba(0,255,136,0.15)',
    borderHover: 'rgba(0,255,136,0.45)',
    primary: '#00ff88',
    primaryGlow: '#00ff8860',
    good: '#39ff14',
    warn: '#ffd60a',
    alarm: '#ff4a4a',
    text: '#e8f5e9',
    textMuted: 'rgba(255,255,255,0.38)',
    headerBg: 'rgba(0,255,136,0.04)',
    scanline: true
  },
  {
    id: 'purple',
    name: '科技紫',
    bg: '#0a061a',
    bgCard: 'rgba(168,85,247,0.04)',
    border: 'rgba(168,85,247,0.18)',
    borderHover: 'rgba(168,85,247,0.5)',
    primary: '#c084fc',
    primaryGlow: '#c084fc60',
    good: '#4ade80',
    warn: '#fb923c',
    alarm: '#f87171',
    text: '#f3e8ff',
    textMuted: 'rgba(243,232,255,0.4)',
    headerBg: 'rgba(168,85,247,0.04)',
    scanline: false
  }
]

interface ThemeState {
  current: Theme
  set: (id: string) => void
}

export const useTheme = create<ThemeState>((set) => ({
  current: THEMES[0],
  set: (id) => {
    const t = THEMES.find(t => t.id === id)
    if (t) set({ current: t })
  }
}))
