import { useRef } from 'react'
import { useFetcher } from 'react-router'

/**
 * useFetcher のラッパー。
 *
 * 1. submit / load が参照安定なので useEffect / useCallback の依存配列に安全に入れられる。
 * 2. submit / load が Promise<T> を返す — await すれば action/loader の結果を直接取得できる。
 *
 * useFetcher は毎レンダリングで新しいオブジェクトを返すため、そのまま依存配列に入れると
 * useEffect が毎回再実行されて再レンダリングカスケードを引き起こす。
 */
export function useStableFetcher<T = unknown>(
  ...args: Parameters<typeof useFetcher>
) {
  const fetcher = useFetcher<T>(...args)

  // --- refs for latest methods ---
  const submitRef = useRef(fetcher.submit)
  submitRef.current = fetcher.submit
  const loadRef = useRef(fetcher.load)
  loadRef.current = fetcher.load

  // resolve 関数を保持。非idle → idle 遷移時に呼ばれる
  const resolveRef = useRef<((data: T) => void) | null>(null)
  const prevStateRef = useRef(fetcher.state)

  // submitting/loading → idle への遷移を検出して resolve
  if (prevStateRef.current !== 'idle' && fetcher.state === 'idle') {
    resolveRef.current?.(fetcher.data as T)
    resolveRef.current = null
  }
  prevStateRef.current = fetcher.state

  const stableSubmit = useRef(
    (...submitArgs: Parameters<typeof fetcher.submit>): Promise<T> => {
      const promise = new Promise<T>((resolve) => {
        resolveRef.current = resolve
      })
      submitRef.current(...submitArgs)
      return promise
    },
  ).current

  const stableLoad = useRef(
    (...loadArgs: Parameters<typeof fetcher.load>): Promise<T> => {
      const promise = new Promise<T>((resolve) => {
        resolveRef.current = resolve
      })
      loadRef.current(...loadArgs)
      return promise
    },
  ).current

  return { ...fetcher, submit: stableSubmit, load: stableLoad }
}
