import { dayjs } from '~/utils/dayjs'

// URL パラメータから year/month を解決
export function resolveYearMonth(searchParams: URLSearchParams) {
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const now = dayjs()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.year()
  const month = monthParam ? Number.parseInt(monthParam, 10) : now.month() + 1
  return { year, month }
}

export const buildPlaygroundUrl = (y: number, m: number) =>
  `/playground?year=${y}&month=${m}`
