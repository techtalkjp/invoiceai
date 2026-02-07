import { useCallback, useEffect, useRef, useState } from 'react'
import { useTimesheetStore } from '~/components/timesheet/store'
import { useStableFetcher } from '~/hooks/use-stable-fetcher'

/**
 * store の monthData を監視し、フォーカス移動時にサーバーへ保存する
 * - store 変更 → dirty フラグを立てる
 * - focusout（セル離脱）時に dirty なら保存
 * - フォールバック: 10秒間操作がなければ自動保存
 * - beforeunload: 未保存データがあれば警告
 */
type SaveStatus = 'idle' | 'saving' | 'saved'

export function useWorkHoursAutoSave(
  clientId: string,
  year: number,
  month: number,
) {
  const fetcher = useStableFetcher({ key: `auto-save-${clientId}` })
  const lastSavedRef = useRef<string>('')
  const dirtyRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFetcherStateRef = useRef(fetcher.state)

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

  // saving → idle への遷移を検出して「保存済み」を2秒間表示（タイマー = 外部リソース）
  if (
    prevFetcherStateRef.current !== 'idle' &&
    fetcher.state === 'idle' &&
    fetcher.data
  ) {
    setShowSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000)
  }
  prevFetcherStateRef.current = fetcher.state

  // status を導出
  const status: SaveStatus =
    fetcher.state !== 'idle' ? 'saving' : showSaved ? 'saved' : 'idle'

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

  return { initializeLastSaved, status, flush }
}
