import holidayJp from '@holiday-jp/holiday_jp'
import type { MonthData } from './types'

export const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// 月の日付一覧を取得
export function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    dates.push(dateStr)
  }
  return dates
}

// 日付行の表示フォーマット
export function formatDateRow(dateStr: string): string {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const day = date.getDate()
  return `${day}日 (${DAY_LABELS[dayOfWeek]})`
}

// 土曜日判定
export function isSaturday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 6
}

// 日曜日判定
export function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0
}

// 祝日名を取得
export function getHolidayName(dateStr: string): string | null {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday?.name ?? null
}

// 平日判定
export function isWeekday(dateStr: string): boolean {
  const dayOfWeek = new Date(dateStr).getDay()
  return dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(dateStr)
}

// キーボードナビゲーション用のヘルパー
export function navigateToCell(
  currentDate: string,
  currentCol: number,
  direction: 'up' | 'down' | 'left' | 'right',
) {
  const allDates = Array.from(
    document.querySelectorAll('[data-date]'),
  ) as HTMLElement[]
  const dateList = allDates.map((el) => el.dataset.date)
  const currentIndex = dateList.indexOf(currentDate)

  let targetDate = currentDate
  let targetCol = currentCol

  if (direction === 'up' && currentIndex > 0) {
    targetDate = dateList[currentIndex - 1] ?? currentDate
  } else if (direction === 'down' && currentIndex < dateList.length - 1) {
    targetDate = dateList[currentIndex + 1] ?? currentDate
  } else if (direction === 'left') {
    targetCol = Math.max(0, currentCol - 1)
  } else if (direction === 'right') {
    targetCol = Math.min(3, currentCol + 1) // 0:start, 1:end, 2:break, 3:description
  }

  // input, textarea, または button を探す
  const targetCell = document.querySelector(
    `[data-date="${targetDate}"] [data-col="${targetCol}"]`,
  )
  const targetElement = targetCell?.querySelector('input, textarea, button') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLButtonElement
    | null

  if (targetElement instanceof HTMLButtonElement && targetCol === 3) {
    // 概要欄(col=3)のボタンはクリックして編集モードに入る
    targetElement.click()
  } else if (targetElement) {
    targetElement.focus()
    if (
      targetElement instanceof HTMLInputElement ||
      targetElement instanceof HTMLTextAreaElement
    ) {
      targetElement.select()
    }
  }
}

// サンプルデータ生成
export function generateSampleData(year: number, month: number): MonthData {
  const data: MonthData = {}
  const dates = getMonthDates(year, month)

  for (const date of dates) {
    const d = new Date(date)
    const dayOfWeek = d.getDay()
    // 平日のみデータを入れる
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // ランダムに一部の日だけデータを入れる
      if (Math.random() > 0.3) {
        const startHour = 9 + Math.floor(Math.random() * 2)
        const endHour = 17 + Math.floor(Math.random() * 3)
        data[date] = {
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(endHour).padStart(2, '0')}:00`,
          breakMinutes: 60,
          description: '',
        }
      }
    }
  }

  return data
}
