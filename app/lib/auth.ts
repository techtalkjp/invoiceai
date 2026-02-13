import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { admin, anonymous, organization } from 'better-auth/plugins'
import { authDb } from './db/kysely'
import { isFeatureEnabled } from './feature-flags.server'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  database: {
    db: authDb,
    type: 'sqlite',
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // anonymous user は signup_enabled チェック不要
          if (user.isAnonymous) {
            return { data: user }
          }

          // Feature flag: 新規登録が無効な場合はエラー
          const signupEnabled = await isFeatureEnabled('signup_enabled')
          if (!signupEnabled) {
            throw new APIError('BAD_REQUEST', {
              message: '現在、新規登録は受け付けていません',
            })
          }

          // 最初のユーザーを管理者にする
          const existingUsers = await authDb
            .selectFrom('user')
            .select('id')
            .limit(1)
            .execute()

          if (existingUsers.length === 0) {
            return {
              data: {
                ...user,
                role: 'admin',
              },
            }
          }
          return { data: user }
        },
      },
    },
  },
  plugins: [
    organization({
      teams: {
        enabled: true,
      },
      schema: {
        organization: {
          fields: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        },
        member: {
          fields: {
            organizationId: 'organization_id',
            userId: 'user_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        },
        invitation: {
          fields: {
            organizationId: 'organization_id',
            inviterId: 'inviter_id',
            teamId: 'team_id',
            expiresAt: 'expires_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        },
        team: {
          fields: {
            organizationId: 'organization_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        },
        teamMember: {
          modelName: 'team_member',
          fields: {
            teamId: 'team_id',
            userId: 'user_id',
            createdAt: 'created_at',
          },
        },
      },
    }),
    admin({
      schema: {
        user: {
          fields: {
            banReason: 'ban_reason',
            banExpires: 'ban_expires',
          },
        },
      },
    }),
    anonymous({
      schema: {
        user: {
          fields: {
            isAnonymous: 'is_anonymous',
          },
        },
      },
    }),
  ],
  user: {
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      idToken: 'id_token',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
})
