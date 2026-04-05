import {
  ChevronDownIcon,
  ChevronRightIcon,
  ReceiptTextIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ContentPanel } from '~/components/layout/content-panel'
import { Badge } from '~/components/ui/badge'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { getNowInTimezone, getRecentMonths } from '~/utils/month'
import {
  getExchangeRatesForMonths,
  getExpenseGroups,
  getExpenseRecordsByMonths,
} from './+queries.server'
import type { Route } from './+types/expense-records'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const now = getNowInTimezone('Asia/Tokyo')
  const months = getRecentMonths(6, now)
  const yearMonthIds = months.map((m) => m.id)

  const [groups, allRecords, allRates] = await Promise.all([
    getExpenseGroups(organization.id, clientId),
    getExpenseRecordsByMonths(organization.id, clientId, yearMonthIds),
    getExchangeRatesForMonths(organization.id, yearMonthIds),
  ])

  // Group records by yearMonth
  const recordsByMonth = new Map<string, typeof allRecords>()
  for (const record of allRecords) {
    const arr = recordsByMonth.get(record.yearMonth)
    if (arr) {
      arr.push(record)
    } else {
      recordsByMonth.set(record.yearMonth, [record])
    }
  }

  // Index exchange rates by yearMonth+currencyPair
  const rateMap = new Map<string, { rate: string; source: string }>()
  for (const rate of allRates) {
    rateMap.set(`${rate.yearMonth}:${rate.currencyPair}`, {
      rate: rate.rate,
      source: rate.source,
    })
  }

  const monthlyData = months
    .map((m) => {
      const records = recordsByMonth.get(m.id)
      if (!records || records.length === 0) return null

      const hasNonJpy = records.some((r) => r.currency !== 'JPY')
      const exchangeRate = hasNonJpy
        ? (rateMap.get(`${m.id}:USD/JPY`) ?? null)
        : null

      return {
        yearMonth: m.id,
        label: m.label,
        exchangeRate,
        records: records.map((r) => ({
          id: r.id,
          itemName: r.itemName,
          groupId: r.groupId,
          amountForeign: r.amountForeign,
          currency: r.currency,
          isBilled: r.billedLineId != null,
        })),
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  return { months: monthlyData, groups }
}

function formatAmount(
  amount: string,
  currency: string,
  rate: string | null,
): string {
  if (currency === 'JPY') {
    return `\u00a5${Number(amount).toLocaleString()}`
  }
  const symbol = currency === 'USD' ? '$' : currency
  const jpyAmount = rate ? Math.round(Number(amount) * Number(rate)) : null
  const foreignStr = `${symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  if (jpyAmount != null) {
    return `${foreignStr}  \u2192  \u00a5${jpyAmount.toLocaleString()}`
  }
  return foreignStr
}

function groupTotal(
  records: Array<{ amountForeign: string; currency: string }>,
  rate: string | null,
): string {
  const currency = records[0]?.currency ?? 'USD'
  const total = records.reduce((sum, r) => sum + Number(r.amountForeign), 0)
  return formatAmount(String(total), currency, currency !== 'JPY' ? rate : null)
}

type MonthData = NonNullable<
  Awaited<ReturnType<typeof loader>>['months'][number]
>

function groupRecordsByGroupId(records: MonthData['records']) {
  const grouped = new Map<string | null, typeof records>()
  for (const record of records) {
    const key = record.groupId
    const arr = grouped.get(key)
    if (arr) {
      arr.push(record)
    } else {
      grouped.set(key, [record])
    }
  }
  return grouped
}

export default function ExpenseRecords({
  loaderData: { months, groups },
  params: { orgSlug, clientId },
}: Route.ComponentProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set(months.slice(0, 2).map((m) => m.yearMonth)),
  )

  const groupedByMonth = useMemo(
    () =>
      new Map(
        months.map((m) => [m.yearMonth, groupRecordsByGroupId(m.records)]),
      ),
    [months],
  )

  function toggleMonth(ym: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(ym)) {
        next.delete(ym)
      } else {
        next.add(ym)
      }
      return next
    })
  }

  if (months.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        経費実績データがありません
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Link
          to={`/org/${orgSlug}/invoices/create?clientId=${clientId}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
        >
          <ReceiptTextIcon className="size-4" />
          請求書作成
        </Link>
      </div>
      <ContentPanel>
        <div className="space-y-6">
          {months.map((month) => {
            const isExpanded = expandedMonths.has(month.yearMonth)
            const groupedRecords = groupedByMonth.get(month.yearMonth)
            if (!groupedRecords) return null
            const rate = month.exchangeRate?.rate ?? null
            const hasUsd = month.records.some((r) => r.currency !== 'JPY')

            return (
              <div key={month.yearMonth} className="rounded-md border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                  onClick={() => toggleMonth(month.yearMonth)}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4 shrink-0" />
                  ) : (
                    <ChevronRightIcon className="size-4 shrink-0" />
                  )}
                  <span className="font-medium">{month.label}</span>
                  {hasUsd && rate && (
                    <span className="text-muted-foreground text-xs">
                      USD/JPY: {rate}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t px-4 py-3">
                    {[...groupedRecords.entries()].map(
                      ([groupId, groupRecords]) => {
                        const group = groupId
                          ? groups.find((g) => g.id === groupId)
                          : null
                        const currency = groupRecords[0]?.currency ?? 'JPY'

                        if (group) {
                          return (
                            <div key={groupId} className="space-y-1">
                              <div className="text-sm font-medium">
                                {group.name}{' '}
                                <span className="text-muted-foreground">
                                  ({currency})
                                </span>
                              </div>
                              <div className="ml-4 space-y-0.5">
                                {groupRecords.map((record) => (
                                  <div
                                    key={record.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="flex items-center gap-2">
                                      {record.itemName}
                                      {record.isBilled && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px]"
                                        >
                                          請求済
                                        </Badge>
                                      )}
                                    </span>
                                    <span className="font-mono text-xs">
                                      {formatAmount(
                                        record.amountForeign,
                                        record.currency,
                                        record.currency !== 'JPY' ? rate : null,
                                      )}
                                    </span>
                                  </div>
                                ))}
                                <div className="text-muted-foreground flex justify-between border-t pt-1 text-xs">
                                  <span>合計</span>
                                  <span className="font-mono">
                                    {groupTotal(groupRecords, rate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        // Ungrouped items
                        return groupRecords.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2">
                              {record.itemName}{' '}
                              <span className="text-muted-foreground">
                                ({record.currency})
                              </span>
                              {record.isBilled && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  請求済
                                </Badge>
                              )}
                            </span>
                            <span className="font-mono text-xs">
                              {formatAmount(
                                record.amountForeign,
                                record.currency,
                                record.currency !== 'JPY' ? rate : null,
                              )}
                            </span>
                          </div>
                        ))
                      },
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ContentPanel>
    </div>
  )
}
