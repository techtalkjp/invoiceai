import { loadConfig } from './cli-config'
import type { ActivityRecord } from './cli-types'

function getAuthHeaders(): Record<string, string> {
  const config = loadConfig()
  if (!config) {
    throw new Error('ログインしていません。`invoiceai` を実行してください。')
  }
  return {
    Authorization: `Bearer ${config.auth.token}`,
    'Content-Type': 'application/json',
  }
}

function getServerUrl(): string {
  const config = loadConfig()
  if (!config) {
    throw new Error('ログインしていません。`invoiceai` を実行してください。')
  }
  return config.auth.serverUrl
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

export interface SyncRequest {
  orgSlug: string
  clientId: string
  remoteUrl: string
  activities: ActivityRecord[]
}

export interface SyncSummary {
  workDays: number
  commits: number
  prs: number
  reviews: number
  comments: number
  estimatedHours: number
  period: { from: string; to: string }
}

export interface SyncResponse {
  synced: number
  summary: SyncSummary
  webUrl: string
}

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getServerUrl()}${path}`
  const init: RequestInit = {
    method,
    headers: getAuthHeaders(),
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)

  if (!res.ok) {
    if (res.status === 401) {
      throw new AuthError('セッションが無効です。再ログインしてください。')
    }
    if (res.status === 403) {
      throw new Error('アクセス権がありません。')
    }
    throw new Error(`API エラー: ${res.status} ${res.statusText}`)
  }

  return (await res.json()) as T
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function fetchMe(): Promise<MeResponse> {
  return await apiFetch('GET', '/api/cli/me')
}

export async function fetchClients(
  organizationId: string,
): Promise<CliClient[]> {
  const json = await apiFetch<{ clients: CliClient[] }>(
    'GET',
    `/api/cli/clients?organizationId=${encodeURIComponent(organizationId)}`,
  )
  return json.clients
}

export async function syncActivities(
  request: SyncRequest,
): Promise<SyncResponse> {
  return await apiFetch('POST', '/api/cli/sync', request)
}

export async function createClient(
  organizationId: string,
  name: string,
): Promise<CliClient> {
  return await apiFetch('POST', '/api/cli/create-client', {
    organizationId,
    name,
  })
}

export async function createOrg(
  name: string,
): Promise<{ id: string; slug: string; name: string }> {
  return await apiFetch('POST', '/api/cli/create-org', { name })
}

export async function completeSetup(organizationId: string): Promise<void> {
  await apiFetch('POST', '/api/cli/complete-setup', { organizationId })
}
