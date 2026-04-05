import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { getNowInTimezone, getRecentMonths } from '~/utils/month'
import {
  getExchangeRateForMonth,
  getExpenseGroups,
  getExpenseRecordsByMonth,
} from './+queries.server'
import type { Route } from './+types/expense-records'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const now = getNowInTimezone('Asia/Tokyo')
  const months = getRecentMonths(6, now)
  const groups = await getExpenseGroups(organization.id, clientId)

  const monthlyData = await Promise.all(
    months.map(async (m) => {
      const records = await getExpenseRecordsByMonth(
        organization.id,
        clientId,
        m.id,
      )
      if (records.length === 0) return null

      const exchangeRate = await getExchangeRateForMonth(
        organization.id,
        m.id,
        'USD/JPY',
      )

      return {
        yearMonth: m.id,
        label: m.label,
        exchangeRate: exchangeRate
          ? { rate: exchangeRate.rate, source: exchangeRate.source }
          : null,
        records: records.map((r) => ({
          id: r.id,
          itemName: r.itemName,
          groupId: r.groupId,
          amountForeign: r.amountForeign,
          currency: r.currency,
          isBilled: r.billedLineId != null,
        })),
      }
    }),
  )

  const filteredData = monthlyData.filter(
    (d): d is NonNullable<typeof d> => d !== null,
  )

  return { months: filteredData, groups }
}

function formatAmount(
  amount: string,
  currency: string,
  rate: string | null,
): string {
  if (currency === 'JPY') {
    return `\u00a5${Number(amount).toLocaleString()}`
  }
  const jpyAmount = rate ? Math.round(Number(amount) * Number(rate)) : null
  const foreignStr = `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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

export default function ExpenseRecords({
  loaderData: { months, groups },
}: Route.ComponentProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set(months.slice(0, 2).map((m) => m.yearMonth)),
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
    <div className="space-y-6">
      {months.map((month) => {
        const isExpanded = expandedMonths.has(month.yearMonth)

        // Group records by groupId
        const groupedRecords = new Map<
          string | null,
          Array<(typeof month.records)[number]>
        >()
        for (const record of month.records) {
          const key = record.groupId
          const arr = groupedRecords.get(key)
          if (arr) {
            arr.push(record)
          } else {
            groupedRecords.set(key, [record])
          }
        }

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
                            <Badge variant="secondary" className="text-[10px]">
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
  )
}
