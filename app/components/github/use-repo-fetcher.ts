import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { loader as reposLoader } from '~/routes/org.$orgSlug/settings/integrations/repos'

/**
 * GitHub リポジトリ一覧の取得・検索ロジックを共通化するフック
 */
export function useRepoFetcher(orgSlug: string, fetcherKey: string) {
  const reposFetcher = useFetcher<typeof reposLoader>({ key: fetcherKey })
  const [selectedOrg, setSelectedOrg] = useState<string>('__personal__')
  const [repoValue, setRepoValue] = useState('')
  const [repoQuery, setRepoQuery] = useState('')

  const reposBasePath = `/org/${orgSlug}/settings/integrations/repos`

  // sync with external resource: resource route からリポジトリ一覧を取得
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial load only, fetcher.load identity is unstable
  useEffect(() => {
    reposFetcher.load(reposBasePath)
  }, [reposBasePath])

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load identity is unstable
  const handleOrgChange = useCallback(
    (org: string) => {
      setSelectedOrg(org)
      setRepoValue('')
      setRepoQuery('')
      const url =
        org === '__personal__' ? reposBasePath : `${reposBasePath}?ghOrg=${org}`
      reposFetcher.load(url)
    },
    [reposBasePath],
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load identity is unstable
  const handleRepoQueryChange = useCallback(
    (value: string) => {
      setRepoQuery(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams()
        if (selectedOrg !== '__personal__') params.set('ghOrg', selectedOrg)
        if (value) params.set('q', value)
        const qs = params.toString()
        reposFetcher.load(qs ? `${reposBasePath}?${qs}` : reposBasePath)
      }, 300)
    },
    [reposBasePath, selectedOrg],
  )

  return {
    selectedOrg,
    repoValue,
    setRepoValue,
    repoQuery,
    setRepoQuery,
    ghOrgs: reposFetcher.data?.ghOrgs ?? [],
    repos: reposFetcher.data?.repos ?? [],
    isLoadingRepos: reposFetcher.state === 'loading',
    handleOrgChange,
    handleRepoQueryChange,
  }
}
