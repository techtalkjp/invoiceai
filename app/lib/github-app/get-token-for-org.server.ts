import { getInstallationAccessToken } from './installation-token.server'
import { getGitHubInstallation } from './queries.server'

export async function getGitHubTokenForOrg(
  organizationId: string,
): Promise<string> {
  const installation = await getGitHubInstallation(organizationId)
  if (!installation) {
    throw new Error('GitHub App is not installed for this organization')
  }
  if (installation.suspendedAt) {
    throw new Error('GitHub App installation is suspended')
  }
  return getInstallationAccessToken(installation.installationId)
}
