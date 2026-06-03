import { useKanban } from '../store/kanban'

export function startMockUpdater(): () => void {
  const interval = setInterval(() => {
    const { workshop, updateLineData } = useKanban.getState()
    if (!workshop) return

    for (const line of workshop.lines) {
      if (line.status === 'stopped') continue

      const delta = line.status === 'alarm' ? 0 : 1
      const newPass = line.passCount + delta
      const newOee = Math.min(1, Math.max(0, line.oee + (Math.random() - 0.5) * 0.005))

      const updatedStations = line.stations.map(s => {
        if (s.status === 'stopped' || s.status === 'alarm') return s
        return {
          ...s,
          passCount: s.passCount + delta,
          cycletime: Math.round(s.stdCycletime * (0.9 + Math.random() * 0.3))
        }
      })

      updateLineData(line.id, {
        passCount: newPass,
        oee: newOee,
        stations: updatedStations,
        currentOrder: {
          ...line.currentOrder,
          completedQty: Math.min(line.currentOrder.plannedQty, line.currentOrder.completedQty + delta)
        }
      })
    }
  }, 3000)

  return () => clearInterval(interval)
}
