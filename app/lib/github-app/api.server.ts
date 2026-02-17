import { generateGitHubAppJWT } from './jwt.server'

export interface GitHubInstallationResponse {
  id: number
  account: { login: string; type: string }
  permissions: Record<string, string>
  repository_selection: string
  suspended_at: string | null
}

/**
 * GitHub App の全インストール一覧を取得
 */
export async function listAppInstallations(): Promise<
  GitHubInstallationResponse[]
> {
  const jwtToken = generateGitHubAppJWT()
  const res = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to list installations: ${res.status}`)
  }

  return res.json() as Promise<GitHubInstallationResponse[]>
}

/**
 * 指定 installation_id のインストール情報を取得
 */
export async function getInstallationFromGitHub(
  installationId: number,
): Promise<GitHubInstallationResponse> {
  const jwtToken = generateGitHubAppJWT()
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!res.ok) {
    throw new Error(`Failed to verify installation: ${res.status}`)
  }

  return res.json() as Promise<GitHubInstallationResponse>
}

/**
 * GitHub App のインストールを削除（アンインストール）
 */
export async function deleteInstallationFromGitHub(
  installationId: number,
): Promise<void> {
  const jwtToken = generateGitHubAppJWT()
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete installation: ${res.status}`)
  }
}
