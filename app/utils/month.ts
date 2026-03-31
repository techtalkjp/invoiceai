import { dayjs } from './dayjs'

export function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

export function formatYearMonth(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

export function formatYearMonthLabel(year: number, month: number) {
  return `${year}年${month}月`
}

/**
 * 指定タイムゾーンでの現在の年・月を取得する。
 * 省略時はシステムのローカル時刻を使用。
 */
export function getNowInTimezone(timezone?: string | undefined) {
  if (timezone) {
    const d = dayjs().tz(timezone)
    return { year: d.year(), month: d.month() + 1 }
  }
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export type YearMonth = { year: number; month: number }

export function getPreviousMonth(from?: Date | YearMonth | undefined) {
  const { year, month } =
    from instanceof Date
      ? { year: from.getFullYear(), month: from.getMonth() + 1 }
      : (from ?? getNowInTimezone())
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return { year: prevYear, month: prevMonth }
}

export function getRecentMonths(
  count: number,
  from?: Date | YearMonth | undefined,
) {
  const resolved =
    from instanceof Date
      ? { year: from.getFullYear(), month: from.getMonth() + 1 }
      : (from ?? getNowInTimezone())
  const months: Array<{
    id: string
    year: number
    month: number
    label: string
  }> = []
  let year = resolved.year
  let month = resolved.month

  for (let i = 0; i < count; i += 1) {
    const id = formatYearMonth(year, month)
    months.push({ id, year, month, label: formatYearMonthLabel(year, month) })
    if (month === 1) {
      month = 12
      year -= 1
    } else {
      month -= 1
    }
  }

  return months
}

export function parseYearMonthId(id: string) {
  const [yearStr, monthStr] = id.split('-')
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  }
}
