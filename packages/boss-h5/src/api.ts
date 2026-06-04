import type { ExecSummary, WorkshopData } from './types'

const BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ??
  'http://localhost:8080'

const WORKSHOP_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_WORKSHOP_ID ??
  'W01'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchBoardData(): Promise<{ workshop: WorkshopData; exec: ExecSummary }> {
  const [workshop, exec] = await Promise.all([
    get<WorkshopData>(`/api/workshop/${WORKSHOP_ID}`),
    get<ExecSummary>('/api/exec/summary')
  ])
  return { workshop, exec }
}
