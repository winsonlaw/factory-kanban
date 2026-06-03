import { create } from 'zustand'
import type { WorkshopData, LineData } from '../types'
import { mockWorkshop } from '../mock/data'

export type RoleView = 'overview' | 'dispatch' | 'director' | 'showcase'

interface KanbanState {
  workshop: WorkshopData | null
  activeLineId: string | null
  viewMode: 'workshop' | 'line'
  roleView: RoleView
  connected: boolean
  lastUpdate: number

  setWorkshop: (data: WorkshopData) => void
  setActiveLine: (lineId: string | null) => void
  setViewMode: (mode: 'workshop' | 'line') => void
  setRoleView: (v: RoleView) => void
  setConnected: (v: boolean) => void
  updateLineData: (lineId: string, patch: Partial<LineData>) => void
  activeLine: () => LineData | null
}

export const useKanban = create<KanbanState>((set, get) => ({
  workshop: mockWorkshop,
  activeLineId: null,
  viewMode: 'workshop',
  roleView: 'overview',
  connected: false,
  lastUpdate: Date.now(),

  setWorkshop: (data) => set({ workshop: data, lastUpdate: Date.now() }),

  setActiveLine: (lineId) => set({
    activeLineId: lineId,
    viewMode: lineId ? 'line' : 'workshop'
  }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setRoleView: (v) => set({ roleView: v, activeLineId: null, viewMode: 'workshop' }),

  setConnected: (v) => set({ connected: v }),

  updateLineData: (lineId, patch) => set((state) => {
    if (!state.workshop) return state
    return {
      workshop: {
        ...state.workshop,
        lines: state.workshop.lines.map(l =>
          l.id === lineId ? { ...l, ...patch } : l
        )
      },
      lastUpdate: Date.now()
    }
  }),

  activeLine: () => {
    const { workshop, activeLineId } = get()
    if (!workshop || !activeLineId) return null
    return workshop.lines.find(l => l.id === activeLineId) ?? null
  }
}))
