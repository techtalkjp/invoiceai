import { redirect } from 'react-router'
import { db } from '~/lib/db/kysely'
import { getInstallationFromGitHub } from '~/lib/github-app/api.server'
import { parseInstallState } from '~/lib/github-app/install-url.server'
import { saveGitHubInstallation } from '~/lib/github-app/queries.server'
import type { Route } from './+types/callback.github-app'

/**
 * ngrok 等のトンネル経由でアクセスされた場合、
 * リダイレクト先を BETTER_AUTH_URL (localhost) に向ける
 */
function toLocalUrl(request: Request, path: string): string {
  const authUrl = process.env.BETTER_AUTH_URL
  if (!authUrl) return path
  const requestHost = new URL(request.url).host
  const authHost = new URL(authUrl).host
  if (requestHost !== authHost) {
    return `${authUrl}${path}`
  }
  return path
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const installationIdParam = url.searchParams.get('installation_id')
  const stateParam = url.searchParams.get('state')

  if (!installationIdParam || !stateParam) {
    return redirect('/')
  }

  const state = parseInstallState(stateParam)
  if (!state) {
    return redirect('/')
  }

  const { orgSlug } = state
  const settingsUrl = `/org/${orgSlug}/settings/integrations`

  // orgSlug から organization を取得
  const organization = await db
    .selectFrom('organization')
    .select(['id', 'slug'])
    .where('slug', '=', orgSlug)
    .executeTakeFirst()

  if (!organization) {
    return redirect('/')
  }

  const installationId = Number.parseInt(installationIdParam, 10)

  try {
    // GitHub API で installation を検証
    const installation = await getInstallationFromGitHub(installationId)

    // 保存
    await saveGitHubInstallation(organization.id, installation)

    return redirect(toLocalUrl(request, settingsUrl))
  } catch {
    return redirect(toLocalUrl(request, settingsUrl))
  }
}

export default function GitHubAppCallback() {
  return null
}
