// タイムシートエントリの型
export interface TimesheetEntry {
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
  aiGenerated?: boolean | undefined
}

// 月データの型
export type MonthData = Record<string, TimesheetEntry>

// クリップボードの型
export type Clipboard = TimesheetEntry[] | null
