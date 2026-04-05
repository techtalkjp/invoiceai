import { useCallback, useEffect, useRef } from 'react'
import type { TimesheetStoreApi } from '~/components/timesheet/store'
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
  store: TimesheetStoreApi,
  clientId: string,
  year: number,
  month: number,
) {
  const fetcherKey = `${AUTO_SAVE_FETCHER_KEY_PREFIX}${clientId}`
  const fetcher = useStableFetcher({ key: fetcherKey })
  const lastSavedRef = useRef<string>('')
  const dirtyRef = useRef(false)
  const initializingRef = useRef(true)
  const mountedRef = useRef(true)
  const rafRef = useRef<number>(0)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 実際の保存処理
  const flush = useCallback(() => {
    if (!mountedRef.current) return
    if (!dirtyRef.current) return

    const serialized = JSON.stringify(store.getState().monthData)
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
  }, [store, clientId, year, month, fetcher.submit])

  // store 変更 → dirty + fallback タイマーリセット
  useEffect(() => {
    const unsubscribe = store.subscribe((state, prevState) => {
      if (state.monthData === prevState.monthData) return
      if (initializingRef.current) return

      dirtyRef.current = true

      // フォールバック: 10秒操作なしで自動保存
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(flush, 10_000)
    })

    return () => {
      unsubscribe()
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [store, flush])

  // focusout で保存トリガー（セル間移動時）
  useEffect(() => {
    const handleFocusOut = () => {
      // 次の tick で保存（新しいフォーカス先が確定してから）
      rafRef.current = requestAnimationFrame(flush)
    }

    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusout', handleFocusOut)
      cancelAnimationFrame(rafRef.current)
    }
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

  // アンマウント時にスコープ無効化
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 初期データを lastSavedRef に設定（マウント直後の無駄な保存を防ぐ）
  const initializeLastSaved = useCallback((data: string) => {
    lastSavedRef.current = data
    dirtyRef.current = false
    initializingRef.current = false
  }, [])

  return { initializeLastSaved, fetcherKey, flush }
}
