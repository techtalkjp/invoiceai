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
 * 指定タイムゾーンでの現在の年・月を取得する
 */
export function getNowInTimezone(timezone: string) {
  const d = dayjs().tz(timezone)
  return { year: d.year(), month: d.month() + 1 }
}

export function getPreviousMonth(from = new Date()) {
  const year = from.getFullYear()
  const month = from.getMonth() + 1
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return { year: prevYear, month: prevMonth }
}

export function getPreviousMonthTz(timezone: string) {
  const { year, month } = getNowInTimezone(timezone)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return { year: prevYear, month: prevMonth }
}

export function getRecentMonths(count: number, from = new Date()) {
  const months: Array<{
    id: string
    year: number
    month: number
    label: string
  }> = []
  let year = from.getFullYear()
  let month = from.getMonth() + 1

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

export function getRecentMonthsTz(count: number, timezone: string) {
  const { year: nowYear, month: nowMonth } = getNowInTimezone(timezone)
  const months: Array<{
    id: string
    year: number
    month: number
    label: string
  }> = []
  let year = nowYear
  let month = nowMonth

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
