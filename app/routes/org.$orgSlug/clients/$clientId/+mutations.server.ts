import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'
import { nowISO } from '~/utils/date'

export async function upsertExpenseGroup(
  organizationId: string,
  clientId: string,
  input: {
    id?: string | undefined
    name: string
    invoiceLabel: string
    currency: string
    taxRate: number
    sortOrder: number
  },
) {
  const now = nowISO()
  const id = input.id ?? nanoid()

  if (input.id) {
    await db
      .updateTable('expenseGroup')
      .set({
        name: input.name,
        invoiceLabel: input.invoiceLabel,
        currency: input.currency,
        taxRate: input.taxRate,
        sortOrder: input.sortOrder,
        updatedAt: now,
      })
      .where('id', '=', input.id)
      .where('organizationId', '=', organizationId)
      .where('clientId', '=', clientId)
      .execute()
  } else {
    await db
      .insertInto('expenseGroup')
      .values({
        id,
        organizationId,
        clientId,
        name: input.name,
        invoiceLabel: input.invoiceLabel,
        currency: input.currency,
        taxRate: input.taxRate,
        sortOrder: input.sortOrder,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .execute()
  }

  return id
}

export async function deleteExpenseGroup(
  organizationId: string,
  clientId: string,
  groupId: string,
) {
  await db
    .deleteFrom('expenseGroup')
    .where('id', '=', groupId)
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .execute()
}

export async function upsertExpenseItem(
  organizationId: string,
  clientId: string,
  input: {
    id?: string | undefined
    groupId?: string | null | undefined
    name: string
    type: 'fixed' | 'metered'
    currency: string
    monthlyAmount?: string | undefined
    provider?: string | undefined
    providerConfig?: string | undefined
    invoiceLabel?: string | undefined
    taxRate?: number | undefined
    effectiveFrom?: string | undefined
    effectiveTo?: string | undefined
    sortOrder: number
  },
) {
  const now = nowISO()
  const id = input.id ?? nanoid()

  // グループ内通貨不一致チェック
  if (input.groupId) {
    const group = await db
      .selectFrom('expenseGroup')
      .select('currency')
      .where('id', '=', input.groupId)
      .where('organizationId', '=', organizationId)
      .where('clientId', '=', clientId)
      .executeTakeFirst()

    if (group && group.currency !== input.currency) {
      throw new Error(
        `通貨が一致しません: グループは ${group.currency} ですが、項目は ${input.currency} です`,
      )
    }
  }

  if (input.id) {
    await db
      .updateTable('expenseItem')
      .set({
        groupId: input.groupId ?? null,
        name: input.name,
        type: input.type,
        currency: input.currency,
        monthlyAmount: input.monthlyAmount ?? null,
        provider: input.provider ?? null,
        providerConfig: input.providerConfig ?? null,
        invoiceLabel: input.invoiceLabel ?? null,
        taxRate: input.taxRate ?? null,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        sortOrder: input.sortOrder,
        updatedAt: now,
      })
      .where('id', '=', input.id)
      .where('organizationId', '=', organizationId)
      .where('clientId', '=', clientId)
      .execute()
  } else {
    await db
      .insertInto('expenseItem')
      .values({
        id,
        organizationId,
        clientId,
        groupId: input.groupId ?? null,
        name: input.name,
        type: input.type,
        currency: input.currency,
        monthlyAmount: input.monthlyAmount ?? null,
        provider: input.provider ?? null,
        providerConfig: input.providerConfig ?? null,
        invoiceLabel: input.invoiceLabel ?? null,
        taxRate: input.taxRate ?? null,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        sortOrder: input.sortOrder,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .execute()
  }

  return id
}

export async function deleteExpenseItem(
  organizationId: string,
  clientId: string,
  itemId: string,
) {
  await db
    .deleteFrom('expenseItem')
    .where('id', '=', itemId)
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .execute()
}
