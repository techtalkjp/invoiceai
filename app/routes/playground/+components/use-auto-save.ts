import { useEffect, useRef } from 'react'
import { useTimesheetStore } from '~/components/timesheet/store'
import type { MonthData } from '~/components/timesheet/types'

const STORAGE_KEY = 'invoiceai-playground-timesheet'

/**
 * store の monthData を監視し、変更があれば LocalStorage に保存する
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
 * 全クリア（LocalStorage からも削除）
 */
export function clearAllStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
