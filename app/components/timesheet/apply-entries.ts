import type { TimesheetStoreApi } from './store'

interface WorkEntry {
  workDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
}

export function applyEntries(store: TimesheetStoreApi, entries: WorkEntry[]) {
  const state = store.getState()
  const dates: string[] = []

  state.setMonthData((prev) => {
    const next = { ...prev }
    for (const entry of entries) {
      next[entry.workDate] = {
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        description: entry.description,
      }
      dates.push(entry.workDate)
    }
    return next
  })

  // ハイライト → 自動クリア
  state.setHighlightedDates(dates)
  setTimeout(() => store.getState().setHighlightedDates([]), 1500)
}
