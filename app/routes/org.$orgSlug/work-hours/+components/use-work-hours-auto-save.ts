import { useCallback, useEffect, useRef } from 'react'
import type { TimesheetStoreApi } from '~/components/timesheet/store'
import { useStableFetcher } from '~/hooks/use-stable-fetcher'

/**
 * store の monthData を監視し、変更をサーバーへ保存する
 *
 * トリガー設計:
 * - store 変更（subscribe）→ デバウンス保存（主トリガー）
 *   TimeInput は blur 時にしか onChange を呼ばないため、
 *   store 変更 = ユーザーが値をコミットした瞬間。最も信頼できるシグナル。
 * - beforeunload → 即時保存（安全網）
 *
 * focusout は使わない。React 19 では focusout が document に到達するタイミングと
 * React の onBlur ディスパッチ（→ store 更新）の順序が保証されないため。
 *
 * 保存ステータスの表示は SaveStatusIndicator コンポーネントが
 * 同じ fetcherKey で useFetcher を共有して行う。
 */
export const AUTO_SAVE_FETCHER_KEY_PREFIX = 'auto-save-'

const DEBOUNCE_MS = 300

export function useWorkHoursAutoSave(
  store: TimesheetStoreApi,
  clientId: string,
  year: number,
  month: number,
) {
  const fetcherKey = `${AUTO_SAVE_FETCHER_KEY_PREFIX}${clientId}`
  const fetcher = useStableFetcher({ key: fetcherKey })
  // サーバーに確認済みのスナップショット
  const confirmedRef = useRef<string>('')
  // 送信中のスナップショット（未確認）
  const pendingRef = useRef<string | null>(null)
  const initializingRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // fetcher 完了を監視: 送信成功なら confirmed に昇格、失敗なら pending を破棄（次回リトライ）
  useEffect(() => {
    if (fetcher.state !== 'idle' || pendingRef.current === null) return
    if (fetcher.data) {
      confirmedRef.current = pendingRef.current
    }
    pendingRef.current = null
  }, [fetcher.state, fetcher.data])

  // 実際の保存処理。保存が実行されたら true を返す。
  const flush = useCallback((): boolean => {
    const serialized = JSON.stringify(store.getState().monthData)
    // 確認済みまたは送信中と同じなら送らない
    if (serialized === confirmedRef.current) return false
    if (serialized === pendingRef.current) return false

    pendingRef.current = serialized

    const formData = new FormData()
    formData.append('intent', 'saveMonthData')
    formData.append('clientId', clientId)
    formData.append('yearMonth', `${year}-${String(month).padStart(2, '0')}`)
    formData.append('monthData', serialized)
    fetcher.submit(formData, { method: 'POST' })
    return true
  }, [store, clientId, year, month, fetcher.submit])

  // store 変更 → デバウンス保存
  useEffect(() => {
    const unsubscribe = store.subscribe((state, prevState) => {
      if (state.monthData === prevState.monthData) return
      if (initializingRef.current) return

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      // SPA ナビゲーション等でアンマウントされる場合、pending の保存を即実行
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        flush()
      }
    }
  }, [store, flush])

  // beforeunload: 未保存データがあれば即時保存 + 警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (flush()) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flush])

  // 初期データを confirmedRef に設定（マウント直後の無駄な保存を防ぐ）
  const initializeLastSaved = useCallback((data: string) => {
    confirmedRef.current = data
    initializingRef.current = false
  }, [])

  return { initializeLastSaved, fetcherKey, flush }
}
