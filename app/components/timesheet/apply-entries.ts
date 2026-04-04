import { useTimesheetStore } from '~/components/timesheet/store'

interface WorkEntry {
  workDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
}

export function applyEntries(entries: WorkEntry[]) {
  const store = useTimesheetStore.getState()
  const dates: string[] = []

  store.setMonthData((prev) => {
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
  store.setHighlightedDates(dates)
  setTimeout(() => store.setHighlightedDates([]), 1500)
}
