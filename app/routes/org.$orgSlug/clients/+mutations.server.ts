import { parseWithZod } from '@conform-to/zod/v4'
import { db } from '~/lib/db/kysely'
import { bulkImportSchema, clientSchema, importSchema } from './+schema'

export async function deleteClient(organizationId: string, clientId: string) {
  await db
    .updateTable('client')
    .set({ isActive: 0, updatedAt: new Date().toISOString() })
    .where('id', '=', clientId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export async function restoreClient(organizationId: string, clientId: string) {
  await db
    .updateTable('client')
    .set({ isActive: 1, updatedAt: new Date().toISOString() })
    .where('id', '=', clientId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export async function importPartner(
  organizationId: string,
  formData: FormData,
) {
  const submission = parseWithZod(formData, { schema: importSchema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { partnerId, partnerName } = submission.value
  const now = new Date().toISOString()

  // 既存チェック
  const existing = await db
    .selectFrom('client')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('freeePartnerId', '=', partnerId)
    .executeTakeFirst()

  if (existing) {
    return { error: 'この取引先は既にインポート済みです' }
  }

  await db
    .insertInto('client')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      name: partnerName,
      billingType: 'time',
      freeePartnerId: partnerId,
      freeePartnerName: partnerName,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .execute()

  return { success: true, imported: partnerName }
}

export async function importPartnersBulk(
  organizationId: string,
  formData: FormData,
) {
  const submission = parseWithZod(formData, { schema: bulkImportSchema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const partners = JSON.parse(submission.value.partners) as Array<{
    id: number
    name: string
  }>
  const now = new Date().toISOString()

  // 既存のパートナーIDを取得
  const existingPartnerIds = new Set(
    (
      await db
        .selectFrom('client')
        .select('freeePartnerId')
        .where('organizationId', '=', organizationId)
        .where(
          'freeePartnerId',
          'in',
          partners.map((p) => p.id),
        )
        .execute()
    ).map((c) => c.freeePartnerId),
  )

  // 未登録のパートナーのみインポート
  const newPartners = partners.filter((p) => !existingPartnerIds.has(p.id))

  if (newPartners.length > 0) {
    await db
      .insertInto('client')
      .values(
        newPartners.map((p) => ({
          id: crypto.randomUUID(),
          organizationId,
          name: p.name,
          billingType: 'time' as const,
          freeePartnerId: p.id,
          freeePartnerName: p.name,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .execute()
  }

  return { success: true, importedCount: newPartners.length }
}

export async function upsertClient(organizationId: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: clientSchema })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const data = submission.value
  const now = new Date().toISOString()

  if (data.id) {
    await db
      .updateTable('client')
      .set({
        name: data.name,
        billingType: data.billingType,
        hourlyRate: data.hourlyRate ?? null,
        monthlyFee: data.monthlyFee ?? null,
        unitLabel: data.unitLabel ?? '式',
        hasWorkDescription: data.hasWorkDescription ?? 1,
        freeePartnerId: data.freeePartnerId ?? null,
        freeePartnerName: data.freeePartnerName ?? null,
        invoiceSubjectTemplate: data.invoiceSubjectTemplate ?? null,
        invoiceNote: data.invoiceNote ?? null,
        paymentTerms: data.paymentTerms ?? 'next_month_end',
        updatedAt: now,
      })
      .where('id', '=', data.id)
      .where('organizationId', '=', organizationId)
      .execute()
  } else {
    await db
      .insertInto('client')
      .values({
        id: crypto.randomUUID(),
        organizationId,
        name: data.name,
        billingType: data.billingType,
        hourlyRate: data.hourlyRate ?? null,
        monthlyFee: data.monthlyFee ?? null,
        unitLabel: data.unitLabel ?? '式',
        hasWorkDescription: data.hasWorkDescription ?? 1,
        freeePartnerId: data.freeePartnerId ?? null,
        freeePartnerName: data.freeePartnerName ?? null,
        invoiceSubjectTemplate: data.invoiceSubjectTemplate ?? null,
        invoiceNote: data.invoiceNote ?? null,
        paymentTerms: data.paymentTerms ?? 'next_month_end',
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .execute()
  }

  return { success: true }
}
