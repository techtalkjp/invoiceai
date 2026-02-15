import {
  markUserSetupCompleted,
  markUserWorkspaceNameConfirmed,
} from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import type { ClientFormValue } from './+schema'

type ConfirmWorkspaceNameArgs = {
  organizationId: string
  userId: string
  workspaceName: string
}

export async function confirmWorkspaceName({
  organizationId,
  userId,
  workspaceName,
}: ConfirmWorkspaceNameArgs): Promise<void> {
  await db
    .updateTable('organization')
    .set({
      name: workspaceName,
      updatedAt: new Date().toISOString(),
    })
    .where('id', '=', organizationId)
    .execute()

  await markUserWorkspaceNameConfirmed(organizationId, userId)
}

type UpsertPrimaryClientArgs = {
  organizationId: string
  primaryClientId: string | null
  value: ClientFormValue
}

export function findDuplicateClientName({
  organizationId,
  primaryClientId,
  name,
}: {
  organizationId: string
  primaryClientId: string | null
  name: string
}) {
  let query = db
    .selectFrom('client')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('name', '=', name)

  if (primaryClientId) {
    query = query.where('id', '!=', primaryClientId)
  }

  return query.executeTakeFirst()
}

export async function upsertPrimaryClient({
  organizationId,
  primaryClientId,
  value,
}: UpsertPrimaryClientArgs): Promise<void> {
  const now = new Date().toISOString()

  if (primaryClientId) {
    await db
      .updateTable('client')
      .set({
        name: value.name,
        billingType: value.billingType,
        hourlyRate:
          value.billingType === 'time' ? (value.hourlyRate ?? null) : null,
        monthlyFee:
          value.billingType === 'fixed' ? (value.monthlyFee ?? null) : null,
        updatedAt: now,
      })
      .where('id', '=', primaryClientId)
      .execute()
    return
  }

  await db
    .insertInto('client')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      name: value.name,
      billingType: value.billingType,
      hourlyRate:
        value.billingType === 'time' ? (value.hourlyRate ?? null) : null,
      monthlyFee:
        value.billingType === 'fixed' ? (value.monthlyFee ?? null) : null,
      unitLabel: '式',
      hasWorkDescription: 1,
      freeePartnerId: null,
      freeePartnerName: null,
      invoiceSubjectTemplate: null,
      invoiceNote: null,
      paymentTerms: 'next_month_end',
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .execute()
}

export async function completeSetup({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}): Promise<void> {
  await markUserSetupCompleted(organizationId, userId)
}
