import { useEffect, useRef } from 'react'
import { timesheetEntrySchema } from '~/components/timesheet/schema'
import { useTimesheetStore } from '~/components/timesheet/store'
import type { MonthData } from '~/components/timesheet/types'
import type { ActivityRecord } from '~/lib/activity-sources/types'

const STORAGE_KEY = 'invoiceai-playground-timesheet'
const ACTIVITY_STORAGE_KEY = 'invoiceai-playground-activities'

/**
 * store の monthData と activitiesByDate を監視し、変更があれば LocalStorage に保存する
 * debounce 付きで頻繁な保存を防ぐ（単一サブスクリプション）
 *
 * useFetcher/clientAction を使わず直接 localStorage を操作することで、
 * React Router の revalidation や fetcher state 変更による再レンダリングを完全に回避する。
 */
export function useAutoSave(monthKey: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEntriesRef = useRef<string>('')
  const lastActivitiesRef = useRef<string>('')

  useEffect(() => {
    const unsubscribe = useTimesheetStore.subscribe((state) => {
      const entries = JSON.stringify(state.monthData)
      const activities = JSON.stringify(state.activitiesByDate)

      const entriesChanged = entries !== lastEntriesRef.current
      const activitiesChanged = activities !== lastActivitiesRef.current
      if (!entriesChanged && !activitiesChanged) return

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        if (entriesChanged) {
          lastEntriesRef.current = entries
          saveMonthToStorage(monthKey, state.monthData)
        }
        if (activitiesChanged) {
          lastActivitiesRef.current = activities
          saveActivitiesToStorage(monthKey, state.activitiesByDate)
        }
      }, 500)
    })

    return () => {
      unsubscribe()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [monthKey])
}

function saveMonthToStorage(monthKey: string, data: MonthData) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const allData: Record<string, MonthData> = stored ? JSON.parse(stored) : {}
    allData[monthKey] = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData))
  } catch {
    // Storage full or disabled
  }
}

/**
 * アクティビティを即座に localStorage に保存（clientLoader 等から呼ぶ用）
 */
export function saveActivities(
  monthKey: string,
  activitiesByDate: Record<string, ActivityRecord[]>,
) {
  saveActivitiesToStorage(monthKey, activitiesByDate)
}

function saveActivitiesToStorage(
  monthKey: string,
  activitiesByDate: Record<string, ActivityRecord[]>,
) {
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    const allData: Record<string, Record<string, ActivityRecord[]>> = stored
      ? JSON.parse(stored)
      : {}
    allData[monthKey] = activitiesByDate
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(allData))
  } catch {
    // Storage full or disabled
  }
}

/**
 * LocalStorage からアクティビティを読み込み
 */
export function loadActivitiesFromStorage(
  monthKey: string,
): Record<string, ActivityRecord[]> | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!stored) return null
    const allData = JSON.parse(stored) as Record<
      string,
      Record<string, ActivityRecord[]>
    >
    return allData[monthKey] ?? null
  } catch {
    return null
  }
}

/**
 * 全クリア（LocalStorage からも削除）
 */
export function clearAllStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVITY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * LocalStorage から全月データを読み込み
 * エントリ単位で safeParse し、1エントリの不正で月全体が消えるのを防ぐ
 */
export function loadFromStorage(): Record<string, MonthData> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    const validated: Record<string, MonthData> = {}
    for (const [monthKey, monthValue] of Object.entries(parsed)) {
      if (typeof monthValue !== 'object' || monthValue === null) continue
      const monthData: MonthData = {}
      for (const [date, entry] of Object.entries(
        monthValue as Record<string, unknown>,
      )) {
        const result = timesheetEntrySchema.safeParse(entry)
        if (result.success) {
          monthData[date] = result.data
        }
        // 不正なエントリはスキップ（他のエントリは保持）
      }
      if (Object.keys(monthData).length > 0) {
        validated[monthKey] = monthData
      }
    }
    return validated
  } catch {
    return {}
  }
}
