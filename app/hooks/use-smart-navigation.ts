import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * フィルタ・ページネーション付き一覧から編集画面に遷移し、
 * 戻った際に状態を維持するための hook
 *
 * @example
 * // 一覧画面 - 現在の URL を自動保存
 * useSmartNavigation({ autoSave: true, baseUrl: '/org/xxx/settings/clients' })
 *
 * // 編集画面 - 保存された URL に戻る
 * const { goBack, backUrl } = useSmartNavigation({ baseUrl: '/org/xxx/settings/clients' })
 * <Link to={backUrl}>戻る</Link>
 */
export function useSmartNavigation(options?: {
  autoSave?: boolean
  baseUrl?: string
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const { autoSave = false, baseUrl = '/' } = options || {}

  // 一覧画面で現在の URL（フィルタ含む）を sessionStorage に保存
  useEffect(() => {
    if (autoSave && location.pathname === baseUrl) {
      sessionStorage.setItem(
        `nav_${baseUrl}`,
        location.pathname + location.search,
      )
    }
  }, [location, baseUrl, autoSave])

  const getBackUrl = () => {
    if (typeof window === 'undefined') return baseUrl // SSR 対応
    return sessionStorage.getItem(`nav_${baseUrl}`) || baseUrl
  }

  const goBack = () => {
    navigate(getBackUrl())
  }

  return {
    goBack,
    backUrl: getBackUrl(),
  }
}
