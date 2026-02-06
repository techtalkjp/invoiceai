import type { MonthData } from '~/components/timesheet/types'
import type { WorkEntryData } from '../+schema'

/**
 * サーバーデータ → クライアントデータ (loader → store)
 */
export function toMonthData(entries: Record<string, WorkEntryData>): MonthData {
  const monthData: MonthData = {}
  for (const [date, entry] of Object.entries(entries)) {
    monthData[date] = {
      startTime: entry.startTime ?? '',
      endTime: entry.endTime ?? '',
      breakMinutes: entry.breakMinutes,
      description: entry.description ?? '',
    }
  }
  return monthData
}

/**
 * クライアントデータ → サーバーデータ (store → action)
 */
export function toServerEntries(clientId: string, monthData: MonthData) {
  return Object.entries(monthData).map(([date, entry]) => {
    const result: {
      clientId: string
      workDate: string
      startTime?: string
      endTime?: string
      breakMinutes: number
      description?: string
    } = {
      clientId,
      workDate: date,
      breakMinutes: entry.breakMinutes,
    }
    if (entry.startTime) result.startTime = entry.startTime
    if (entry.endTime) result.endTime = entry.endTime
    if (entry.description) result.description = entry.description
    return result
  })
}
