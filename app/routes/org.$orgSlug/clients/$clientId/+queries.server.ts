import { db } from '~/lib/db/kysely'

export function getExpenseGroups(organizationId: string, clientId: string) {
  return db
    .selectFrom('expenseGroup')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .orderBy('sortOrder', 'asc')
    .execute()
}

export function getExpenseItems(organizationId: string, clientId: string) {
  return db
    .selectFrom('expenseItem')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .orderBy('sortOrder', 'asc')
    .execute()
}

export function getExpenseRecordsByMonth(
  organizationId: string,
  clientId: string,
  yearMonth: string,
) {
  return db
    .selectFrom('expenseRecord')
    .innerJoin('expenseItem', 'expenseItem.id', 'expenseRecord.expenseItemId')
    .selectAll('expenseRecord')
    .select(['expenseItem.name as itemName', 'expenseItem.groupId'])
    .where('expenseItem.organizationId', '=', organizationId)
    .where('expenseItem.clientId', '=', clientId)
    .where('expenseRecord.yearMonth', '=', yearMonth)
    .execute()
}
