import { redirect } from 'react-router'
import {
  ensureUserHasOrganization,
  getActiveClientCount,
  hasUserCompletedSetup,
  hasUserConfirmedWorkspaceName,
  requireAuth,
} from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'

export type SetupState = {
  userId: string
  organizationId: string
  orgSlug: string
  workspaceName: string
  clientCount: number
  primaryClient: {
    id: string
    name: string
    billingType: 'time' | 'fixed'
    hourlyRate: number | null
    monthlyFee: number | null
  } | null
  setupCompleted: boolean
  workspaceNameConfirmed: boolean
  companyUpdated: boolean
}

export async function getSetupState(request: Request): Promise<SetupState> {
  const session = await requireAuth(request)
  if (session.user.isAnonymous) {
    throw redirect('/auth/signin')
  }

  const organization = await ensureUserHasOrganization({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  })

  const orgRow = await db
    .selectFrom('organization')
    .select(['name', 'slug'])
    .where('id', '=', organization.id)
    .executeTakeFirst()

  const [clientCount, primaryClient, setupCompleted, workspaceNameConfirmed] =
    await Promise.all([
      getActiveClientCount(organization.id),
      db
        .selectFrom('client')
        .select(['id', 'name', 'billingType', 'hourlyRate', 'monthlyFee'])
        .where('organizationId', '=', organization.id)
        .where('isActive', '=', 1)
        .orderBy('createdAt', 'asc')
        .executeTakeFirst(),
      hasUserCompletedSetup(organization.id, session.user.id),
      hasUserConfirmedWorkspaceName(organization.id, session.user.id),
    ])

  const url = new URL(request.url)

  return {
    userId: session.user.id,
    organizationId: organization.id,
    orgSlug: orgRow?.slug ?? organization.slug ?? '',
    workspaceName: orgRow?.name ?? '',
    clientCount,
    primaryClient: primaryClient
      ? {
          id: primaryClient.id,
          name: primaryClient.name,
          billingType: primaryClient.billingType as 'time' | 'fixed',
          hourlyRate: primaryClient.hourlyRate,
          monthlyFee: primaryClient.monthlyFee,
        }
      : null,
    setupCompleted,
    workspaceNameConfirmed,
    companyUpdated: url.searchParams.get('updated') === 'company',
  }
}
