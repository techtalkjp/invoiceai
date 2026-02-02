import dayjs from 'dayjs'

/**
 * 日付を日本語フォーマットで表示
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = dayjs(date)
  if (!d.isValid()) return '-'
  return d.format('YYYY/MM/DD')
}

/**
 * 日付を日本語フォーマットで表示（時刻含む）
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = dayjs(date)
  if (!d.isValid()) return '-'
  return d.format('YYYY/MM/DD HH:mm')
}
