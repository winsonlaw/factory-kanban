import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useKanban } from './store/kanban'
import { useTheme } from './store/theme'
import { WorkshopView } from './views/WorkshopView'
import { LineView } from './views/LineView'
import { DispatchView } from './views/DispatchView'
import { DirectorView } from './views/DirectorView'
import { ShowcaseView } from './views/ShowcaseView'
import { startMockUpdater } from './utils/mock-updater'

export default function App() {
  const { activeLineId, roleView } = useKanban()
  const { current: t } = useTheme()

  useEffect(() => {
    const stop = startMockUpdater()
    return stop
  }, [])

  // 当前视图：下钻产线优先，否则按角色视图
  const view = activeLineId ? 'line' : roleView

  const slide = {
    line: { initial: { opacity: 0, x: 16 }, exit: { opacity: 0, x: 16 } },
    overview: { initial: { opacity: 0, x: -16 }, exit: { opacity: 0, x: -16 } },
    dispatch: { initial: { opacity: 0, x: -16 }, exit: { opacity: 0, x: -16 } },
    director: { initial: { opacity: 0, x: -16 }, exit: { opacity: 0, x: -16 } },
    showcase: { initial: { opacity: 0, scale: 0.98 }, exit: { opacity: 0, scale: 0.98 } }
  }[view]

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={{ background: t.bg, color: t.text, fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 0.5s' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          className="w-full h-full"
          initial={slide.initial}
          animate={{ opacity: 1, x: 0 }}
          exit={slide.exit}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {view === 'line' && <LineView />}
          {view === 'overview' && <WorkshopView />}
          {view === 'dispatch' && <DispatchView />}
          {view === 'director' && <DirectorView />}
          {view === 'showcase' && <ShowcaseView />}
        </motion.div>
      </AnimatePresence>

      {/* CRT 扫描线效果（部分主题启用）*/}
      {t.scanline && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)',
            zIndex: 9999
          }}
        />
      )}
    </div>
  )
}
