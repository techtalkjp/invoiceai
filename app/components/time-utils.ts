/**
 * 時間入力のユーティリティ関数
 */

export interface ParsedTime {
  hours: number
  minutes: number
  isNextDay: boolean // 24時超えかどうか
}

/**
 * あいまいな時間入力をパースする
 *
 * 対応パターン:
 * - "9" → 09:00
 * - "930" or "0930" → 09:30
 * - "9:30" → 09:30
 * - "18" → 18:00
 * - "26" → 26:00 (翌2:00)
 * - "+1h" → 基準時間+1時間
 * - "+30m" → 基準時間+30分
 */
export function parseTimeInput(
  input: string,
  baseTime?: string,
): ParsedTime | null {
  const trimmed = input.trim()

  if (!trimmed) return null

  // 相対時間パターン (+1h, +30m, -1h など)
  const relativeMatch = trimmed.match(/^([+-])(\d+)(h|m)$/i)
  if (relativeMatch && baseTime) {
    const sign = relativeMatch[1]
    const amount = relativeMatch[2]
    const unit = relativeMatch[3]
    if (!sign || !amount || !unit) return null
    const baseMinutes = timeToMinutes(baseTime)
    const delta =
      unit.toLowerCase() === 'h'
        ? parseInt(amount, 10) * 60
        : parseInt(amount, 10)
    const newMinutes = sign === '+' ? baseMinutes + delta : baseMinutes - delta
    return minutesToParsedTime(newMinutes)
  }

  // コロン区切りパターン (9:30, 09:30, 18:00 など)
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (colonMatch) {
    const hoursStr = colonMatch[1]
    const minutesStr = colonMatch[2]
    if (!hoursStr || !minutesStr) return null
    const hours = parseInt(hoursStr, 10)
    const minutes = parseInt(minutesStr, 10)
    if (minutes < 0 || minutes > 59) return null
    return {
      hours,
      minutes,
      isNextDay: hours >= 24,
    }
  }

  // 数字のみパターン
  const numericMatch = trimmed.match(/^(\d{1,4})$/)
  if (numericMatch) {
    const num = numericMatch[1]
    if (!num) return null

    // 1桁または2桁: 時間として解釈 (9 → 09:00, 18 → 18:00)
    if (num.length <= 2) {
      const hours = parseInt(num, 10)
      return {
        hours,
        minutes: 0,
        isNextDay: hours >= 24,
      }
    }

    // 3桁: 最初の1桁が時間、残り2桁が分 (930 → 9:30)
    if (num.length === 3) {
      const firstChar = num[0]
      if (!firstChar) return null
      const hours = parseInt(firstChar, 10)
      const minutes = parseInt(num.slice(1), 10)
      if (minutes < 0 || minutes > 59) return null
      return {
        hours,
        minutes,
        isNextDay: hours >= 24,
      }
    }

    // 4桁: 最初の2桁が時間、残り2桁が分 (0930 → 09:30, 1830 → 18:30)
    if (num.length === 4) {
      const hours = parseInt(num.slice(0, 2), 10)
      const minutes = parseInt(num.slice(2), 10)
      if (minutes < 0 || minutes > 59) return null
      return {
        hours,
        minutes,
        isNextDay: hours >= 24,
      }
    }
  }

  return null
}

/**
 * 時間を "HH:MM" 形式にフォーマット
 * 24時超えもそのまま表示（26:00 など）
 */
export function formatTime(hours: number, minutes: number): string {
  const h = hours.toString().padStart(2, '0')
  const m = minutes.toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * "HH:MM" 形式を分に変換
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':')
  const hours = parseInt(parts[0] ?? '0', 10)
  const minutes = parseInt(parts[1] ?? '0', 10)
  return hours * 60 + minutes
}

/**
 * 分を "HH:MM" 形式に変換
 */
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return formatTime(hours, minutes)
}

/**
 * 分をParsedTimeに変換
 */
function minutesToParsedTime(totalMinutes: number): ParsedTime {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return {
    hours,
    minutes,
    isNextDay: hours >= 24,
  }
}

/**
 * 分を時間フォーマットに変換
 */
export function formatMinutesToDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h${mins}m`
}

/**
 * 実働時間を計算
 */
export function calculateWorkDuration(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): {
  totalMinutes: number
  workMinutes: number
  totalFormatted: string
  workFormatted: string
} {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const totalMinutes = endMinutes - startMinutes
  const workMinutes = totalMinutes - breakMinutes

  return {
    totalMinutes,
    workMinutes,
    totalFormatted: formatMinutesToDuration(totalMinutes),
    workFormatted: formatMinutesToDuration(workMinutes),
  }
}

/**
 * 時間帯の種類を判定
 */
export type TimeCategory =
  | 'early-morning' // 6時前
  | 'morning' // 6-9時
  | 'daytime' // 9-18時
  | 'evening' // 18-22時
  | 'night' // 22時以降

export function getTimeCategory(time: string): TimeCategory {
  const minutes = timeToMinutes(time)
  const hours = minutes / 60

  // 24時超えの場合は24を引いて判定
  const normalizedHours = hours >= 24 ? hours - 24 : hours

  if (normalizedHours < 6) return 'early-morning'
  if (normalizedHours < 9) return 'morning'
  if (normalizedHours < 18) return 'daytime'
  if (normalizedHours < 22) return 'evening'
  return 'night'
}

/**
 * 時間グリッドを生成
 */
export function generateTimeGrid(
  centerHour: number,
  interval: 15 | 30,
  rowCount: number = 4,
  allow24Plus: boolean = false,
): string[][] {
  const grid: string[][] = []
  const intervalsPerRow = 60 / interval
  const startHour = Math.max(0, centerHour - Math.floor(rowCount / 2))
  const maxHour = allow24Plus ? 30 : 24

  for (let row = 0; row < rowCount * 2; row++) {
    const hour = startHour + row
    if (hour >= maxHour) break

    const rowTimes: string[] = []
    for (let i = 0; i < intervalsPerRow; i++) {
      const minutes = i * interval
      rowTimes.push(formatTime(hour, minutes))
    }
    grid.push(rowTimes)
  }

  return grid
}
