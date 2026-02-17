import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { loader as reposLoader } from '~/routes/org.$orgSlug/settings/integrations/repos'

/**
 * GitHub リポジトリ一覧の取得・検索ロジックを共通化するフック
 */
export function useRepoFetcher(orgSlug: string, fetcherKey: string) {
  const reposFetcher = useFetcher<typeof reposLoader>({ key: fetcherKey })
  const [repoValue, setRepoValue] = useState('')
  const [repoQuery, setRepoQuery] = useState('')

  const reposBasePath = `/org/${orgSlug}/settings/integrations/repos`

  // sync with external resource: resource route からリポジトリ一覧を取得
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial load only, fetcher.load identity is unstable
  useEffect(() => {
    reposFetcher.load(reposBasePath)
  }, [reposBasePath])

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load identity is unstable
  const handleRepoQueryChange = useCallback(
    (value: string) => {
      setRepoQuery(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams()
        if (value) params.set('q', value)
        const qs = params.toString()
        reposFetcher.load(qs ? `${reposBasePath}?${qs}` : reposBasePath)
      }, 300)
    },
    [reposBasePath],
  )

  // アンマウント時にデバウンスタイマーをクリア
  // sync with external resource: pending debounce timer cleanup
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  return {
    repoValue,
    setRepoValue,
    repoQuery,
    setRepoQuery,
    repos: reposFetcher.data?.repos ?? [],
    error: reposFetcher.data?.error ?? null,
    isLoadingRepos: reposFetcher.state === 'loading',
    handleRepoQueryChange,
  }
}
