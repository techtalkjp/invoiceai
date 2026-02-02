import { AppError } from '@shared/core/errors'
import { createFreeeClient as createFreeeClientBase } from '@shared/freee-client'
import { refreshFreeeToken } from '@shared/services/freee-oauth'
import {
  getProviderToken,
  saveProviderToken,
} from '~/lib/provider-token.server'

export { getEnvValue, updateEnvFileAt } from '@shared/adapters/env'
export {
  listCompanies,
  listInvoices,
  listPartners,
  listTemplates,
  showInvoice,
} from '@shared/services/freee-listing'
export { loadFreeeAuthEnv } from '@shared/validators/env'

const FREEE_TOKEN_URL = 'https://accounts.secure.freee.co.jp/public_api/token'

/**
 * 組織の freee トークンを取得し、期限切れなら更新
 */
export async function getFreeeAccessTokenForOrganization(
  organizationId: string,
): Promise<string> {
  const token = await getProviderToken(organizationId, 'freee')
  if (!token) {
    throw new AppError(
      'FREEE_TOKEN_MISSING',
      'freee token not found for organization',
      'freee 認証が必要です。設定画面から freee 連携を行ってください。',
    )
  }

  // トークンが期限切れかチェック
  if (token.expiresAt) {
    const expiresAt = new Date(token.expiresAt)
    const now = new Date()
    // 5分前には更新
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      return refreshFreeeTokenForOrganization(
        organizationId,
        token.refreshToken,
      )
    }
  }

  return token.accessToken
}

async function refreshFreeeTokenForOrganization(
  organizationId: string,
  refreshToken: string | null,
): Promise<string> {
  if (!refreshToken) {
    throw new AppError(
      'FREEE_REFRESH_TOKEN_MISSING',
      'freee refresh token not found',
      'freee の再認証が必要です。',
    )
  }

  const clientId = process.env.FREEE_API_CLIENT_ID
  const clientSecret = process.env.FREEE_API_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new AppError(
      'FREEE_CONFIG_MISSING',
      'freee client credentials not configured',
      'freee API の設定が不足しています。',
    )
  }

  const data = await refreshFreeeToken(
    {
      tokenUrl: FREEE_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
    },
    refreshToken,
  )

  await saveProviderToken(organizationId, 'freee', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  })

  return data.access_token
}

/**
 * 組織の freee クライアントを取得（トークン取得含む）
 */
export async function getFreeeClientForOrganization(organizationId: string) {
  const accessToken = await getFreeeAccessTokenForOrganization(organizationId)
  return createFreeeClientBase({
    getAccessToken: () => accessToken,
  })
}
