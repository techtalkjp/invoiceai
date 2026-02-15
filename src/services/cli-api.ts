import { loadConfig } from './cli-config'

/**
 * 認証済みの CLI API クライアント
 */
function getAuthHeaders(): Record<string, string> {
  const config = loadConfig()
  if (!config) {
    throw new Error(
      'ログインしていません。`invoiceai login` を実行してください。',
    )
  }
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
  }
}

function getServerUrl(): string {
  const config = loadConfig()
  if (!config) {
    throw new Error(
      'ログインしていません。`invoiceai login` を実行してください。',
    )
  }
  return config.serverUrl
}

export interface MeResponse {
  user: {
    id: string
    name: string
    email: string
  }
  organizations: Array<{
    id: string
    name: string
    slug: string | null
    role: string
  }>
}

export interface CliClient {
  id: string
  name: string
}

/**
 * ログインユーザー情報を取得
 */
export async function fetchMe(): Promise<MeResponse> {
  const url = `${getServerUrl()}/api/cli/me`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'セッションが無効です。`invoiceai login` で再ログインしてください。',
      )
    }
    throw new Error(`API エラー: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as MeResponse
}

/**
 * 組織に紐づくクライアント一覧を取得
 */
export async function fetchClients(
  organizationId: string,
): Promise<CliClient[]> {
  const url = `${getServerUrl()}/api/cli/clients?organizationId=${encodeURIComponent(organizationId)}`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'セッションが無効です。`invoiceai login` で再ログインしてください。',
      )
    }
    if (res.status === 403) {
      throw new Error('選択した組織へのアクセス権がありません。')
    }
    throw new Error(`API エラー: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { clients: CliClient[] }
  return json.clients
}
