import { dayjs } from '~/utils/dayjs'

/** 表示用タイムゾーン */
export const DISPLAY_TZ = 'Asia/Tokyo'

// ---------------------------------------------------------------------------
// DB 書き込み用
// ---------------------------------------------------------------------------

/** 現在時刻を UTC ISO 文字列で返す（DB の createdAt / updatedAt 用） */
export function nowISO(): string {
  return dayjs.utc().toISOString()
}

// ---------------------------------------------------------------------------
// カレンダー計算
// ---------------------------------------------------------------------------

/** 指定年月の日数を返す */
export function daysInMonth(year: number, month: number): number {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth()
}

/** 曜日番号を返す（0=日, 6=土） */
export function dayOfWeek(dateStr: string): number {
  return dayjs(dateStr).day()
}

// ---------------------------------------------------------------------------
// 30 時制 JST 変換（6:00 起点 — 0:00-5:59 は前日扱い）
// ---------------------------------------------------------------------------

/** UTC ISO タイムスタンプ → JST の「勤務日」YYYY-MM-DD */
export function toJstWorkDate(iso: string): string {
  const jst = dayjs(iso).tz(DISPLAY_TZ)
  const workDay = jst.hour() < 6 ? jst.subtract(1, 'day') : jst
  return workDay.format('YYYY-MM-DD')
}

/** UTC ISO タイムスタンプ → JST 時刻文字列（30 時制 HH:MM） */
export function toJstTime(iso: string): string {
  const jst = dayjs(iso).tz(DISPLAY_TZ)
  const hours = jst.hour()
  const minutes = jst.minute()
  const displayHours = hours < 6 ? hours + 24 : hours
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** UTC ISO タイムスタンプ → JST 分（30 時制） */
export function toJstMinutes(iso: string): number {
  const jst = dayjs(iso).tz(DISPLAY_TZ)
  const hours = jst.hour()
  const minutes = jst.minute()
  if (hours < 6) return (hours + 24) * 60 + minutes
  return hours * 60 + minutes
}

// ---------------------------------------------------------------------------
// 表示フォーマット（Asia/Tokyo）
// ---------------------------------------------------------------------------

/** 日付を YYYY/MM/DD で表示（DB の UTC タイムスタンプを JST に変換） */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = dayjs.utc(date).tz(DISPLAY_TZ)
  if (!d.isValid()) return '-'
  return d.format('YYYY/MM/DD')
}

/** 日時を YYYY/MM/DD HH:mm で表示（DB の UTC タイムスタンプを JST に変換） */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = dayjs.utc(date).tz(DISPLAY_TZ)
  if (!d.isValid()) return '-'
  return d.format('YYYY/MM/DD HH:mm')
}
