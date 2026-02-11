import { useEffect, useRef } from 'react'
import { useActivityStore } from '~/components/timesheet/activity-store'
import { useTimesheetStore } from '~/components/timesheet/store'
import type { MonthData } from '~/components/timesheet/types'
import type { ActivityRecord } from '~/lib/activity-sources/types'

const STORAGE_KEY = 'invoiceai-playground-timesheet'
const ACTIVITY_STORAGE_KEY = 'invoiceai-playground-activities'

/**
 * store の monthData と activitiesByDate を監視し、変更があれば LocalStorage に保存する
 * debounce 付きで頻繁な保存を防ぐ
 *
 * useFetcher/clientAction を使わず直接 localStorage を操作することで、
 * React Router の revalidation や fetcher state 変更による再レンダリングを完全に回避する。
 */
export function useAutoSave(monthKey: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')

  useEffect(() => {
    const unsubscribe = useTimesheetStore.subscribe((state) => {
      const monthData = state.monthData
      const serialized = JSON.stringify(monthData)

      if (serialized === lastSavedRef.current) return

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        lastSavedRef.current = serialized
        saveMonthToStorage(monthKey, monthData)
      }, 500)
    })

    return () => {
      unsubscribe()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [monthKey])

  // アクティビティの自動保存
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<string>('')

  useEffect(() => {
    const unsubscribe = useActivityStore.subscribe((state) => {
      const serialized = JSON.stringify(state.activitiesByDate)

      if (serialized === lastActivityRef.current) return

      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }

      activityTimeoutRef.current = setTimeout(() => {
        lastActivityRef.current = serialized
        saveActivitiesToStorage(monthKey, state.activitiesByDate)
      }, 500)
    })

    return () => {
      unsubscribe()
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
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
