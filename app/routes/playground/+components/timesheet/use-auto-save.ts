import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useTimesheetStore } from './store'
import type { MonthData } from './types'

/**
 * store の monthData を監視し、変更があれば clientAction に保存を依頼する
 * debounce 付きで頻繁な保存を防ぐ
 */
export function useAutoSave(monthKey: string) {
  const fetcher = useFetcher()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')

  useEffect(() => {
    // store の monthData を subscribe
    const unsubscribe = useTimesheetStore.subscribe((state) => {
      const monthData = state.monthData
      const serialized = JSON.stringify(monthData)

      // 変更がなければスキップ
      if (serialized === lastSavedRef.current) return

      // debounce: 500ms 後に保存
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        lastSavedRef.current = serialized

        // clientAction に保存を依頼
        const formData = new FormData()
        formData.append(
          'json',
          JSON.stringify({
            intent: 'setMonthData',
            monthKey,
            data: monthData,
          }),
        )
        fetcher.submit(formData, { method: 'POST' })
      }, 500)
    })

    return () => {
      unsubscribe()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [monthKey, fetcher])
}

/**
 * 即座に保存を実行する（全クリア時など）
 */
export function useSaveAction() {
  const fetcher = useFetcher()

  const saveMonthData = (monthKey: string, data: MonthData) => {
    const formData = new FormData()
    formData.append(
      'json',
      JSON.stringify({
        intent: 'setMonthData',
        monthKey,
        data,
      }),
    )
    fetcher.submit(formData, { method: 'POST' })
  }

  const clearAll = () => {
    const formData = new FormData()
    formData.append('json', JSON.stringify({ intent: 'clearAll' }))
    fetcher.submit(formData, { method: 'POST' })
  }

  return { saveMonthData, clearAll }
}
