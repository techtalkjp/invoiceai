export function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

export function formatYearMonth(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

export function formatYearMonthLabel(year: number, month: number) {
  return `${year}年${month}月`
}

export function getPreviousMonth(from = new Date()) {
  const year = from.getFullYear()
  const month = from.getMonth() + 1
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

export function parseYearMonthId(id: string) {
  const [yearStr, monthStr] = id.split('-')
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  }
}
