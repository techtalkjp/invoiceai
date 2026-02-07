import { useCallback, useEffect, useRef } from 'react'
import { useTimesheetStore } from '~/components/timesheet/store'
import { useStableFetcher } from '~/hooks/use-stable-fetcher'

/**
 * store の monthData を監視し、フォーカス移動時にサーバーへ保存する
 * - store 変更 → dirty フラグを立てる
 * - focusout（セル離脱）時に dirty なら保存
 * - フォールバック: 10秒間操作がなければ自動保存
 * - beforeunload: 未保存データがあれば警告
 *
 * 保存ステータスの表示は SaveStatusIndicator コンポーネントが
 * 同じ fetcherKey で useFetcher を共有して行う。
 */
export const AUTO_SAVE_FETCHER_KEY_PREFIX = 'auto-save-'

export function useWorkHoursAutoSave(
  clientId: string,
  year: number,
  month: number,
) {
  const fetcherKey = `${AUTO_SAVE_FETCHER_KEY_PREFIX}${clientId}`
  const fetcher = useStableFetcher({ key: fetcherKey })
  const lastSavedRef = useRef<string>('')
  const dirtyRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 実際の保存処理
  const flush = useCallback(() => {
    if (!dirtyRef.current) return

    const serialized = JSON.stringify(useTimesheetStore.getState().monthData)
    if (serialized === lastSavedRef.current) {
      dirtyRef.current = false
      return
    }

    dirtyRef.current = false
    lastSavedRef.current = serialized

    const formData = new FormData()
    formData.append('intent', 'saveMonthData')
    formData.append('clientId', clientId)
    formData.append('yearMonth', `${year}-${String(month).padStart(2, '0')}`)
    formData.append('monthData', serialized)
    fetcher.submit(formData, { method: 'POST' })
  }, [clientId, year, month, fetcher.submit])

  // store 変更 → dirty + fallback タイマーリセット
  useEffect(() => {
    const unsubscribe = useTimesheetStore.subscribe((state) => {
      const serialized = JSON.stringify(state.monthData)
      if (serialized === lastSavedRef.current) return

      dirtyRef.current = true

      // フォールバック: 10秒操作なしで自動保存
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(flush, 10_000)
    })

    return () => {
      unsubscribe()
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [flush])

  // focusout で保存トリガー（セル間移動時）
  useEffect(() => {
    const handleFocusOut = () => {
      // 次の tick で保存（新しいフォーカス先が確定してから）
      requestAnimationFrame(flush)
    }

    document.addEventListener('focusout', handleFocusOut)
    return () => document.removeEventListener('focusout', handleFocusOut)
  }, [flush])

  // beforeunload: 未保存データがあれば警告 + 保存試行
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        flush()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flush])

  // 初期データを lastSavedRef に設定（マウント直後の無駄な保存を防ぐ）
  const initializeLastSaved = useCallback((data: string) => {
    lastSavedRef.current = data
    dirtyRef.current = false
  }, [])

  return { initializeLastSaved, fetcherKey, flush }
}
