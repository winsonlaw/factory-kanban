/**
 * 配置快照 hook —— 一次拉全量，供各页面取下拉选项与名称映射，并提供刷新。
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { ConfigData } from './types'

const EMPTY: ConfigData = {
  factories: [], workshops: [], lines: [], stations: [], deviceProfiles: [],
  gateways: [], collectors: [], channels: [], dataPoints: [],
  defectCodes: [], alarmCodes: [], shifts: [], targets: [], thresholds: []
}

export function useConfig() {
  const [data, setData] = useState<ConfigData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.snapshot())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, reload }
}
