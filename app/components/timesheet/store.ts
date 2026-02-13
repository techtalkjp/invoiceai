import { create } from 'zustand'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import type { Clipboard, MonthData, TimesheetEntry } from './types'
import { isWeekday } from './utils'

// タイムシート store の状態
export interface TimesheetState {
  // 選択状態
  selectedDates: string[]
  isDragging: boolean
  dragStartDate: string | null
  monthDates: string[] // 範囲選択のため
  // データ
  monthData: MonthData
  // フィルタ
  showOnlyFilled: boolean
  // クリップボード
  clipboard: Clipboard
  // ハイライト（インポート反映時のアニメーション用）
  highlightedDates: string[]
  // アクティビティ（GitHub コミット/PR 等）
  activitiesByDate: Record<string, ActivityRecord[]>
  // 選択操作
  setMonthDates: (dates: string[]) => void
  setSelectedDates: (dates: string[] | ((prev: string[]) => string[])) => void
  setIsDragging: (isDragging: boolean) => void
  setDragStartDate: (date: string | null) => void
  clearSelection: () => void
  startSelection: (date: string, shiftKey: boolean) => void
  extendSelection: (date: string) => void
  // データ操作
  setMonthData: (data: MonthData | ((prev: MonthData) => MonthData)) => void
  setShowOnlyFilled: (value: boolean | ((prev: boolean) => boolean)) => void
  updateEntry: (
    date: string,
    field: keyof TimesheetEntry,
    value: string | number,
  ) => void
  clearAllData: () => void
  // ハイライト操作
  setHighlightedDates: (dates: string[]) => void
  // アクティビティ操作
  setActivities: (activities: ActivityRecord[]) => void
  setActivitiesByDate: (byDate: Record<string, ActivityRecord[]>) => void
  clearActivities: () => void
  // クリップボード操作
  copySelection: () => void
  pasteToSelected: (weekdaysOnly?: boolean | undefined) => void
  clearSelectedEntries: () => void
}

export const useTimesheetStore = create<TimesheetState>((set, get) => ({
  // 選択状態
  selectedDates: [],
  isDragging: false,
  dragStartDate: null,
  monthDates: [],
  // データ
  monthData: {},
  // フィルタ
  showOnlyFilled: false,
  // クリップボード
  clipboard: null,
  // ハイライト
  highlightedDates: [],
  // アクティビティ
  activitiesByDate: {},
  // 選択操作
  setMonthDates: (monthDates) => set({ monthDates }),
  setSelectedDates: (dates) =>
    set((state) => ({
      selectedDates:
        typeof dates === 'function' ? dates(state.selectedDates) : dates,
    })),
  setIsDragging: (isDragging) => set({ isDragging }),
  setDragStartDate: (dragStartDate) => set({ dragStartDate }),
  clearSelection: () =>
    set({ selectedDates: [], isDragging: false, dragStartDate: null }),
  startSelection: (date, shiftKey) => {
    const { selectedDates, monthDates } = get()
    const getDateRange = (start: string, end: string): string[] => {
      const startIdx = monthDates.indexOf(start)
      const endIdx = monthDates.indexOf(end)
      const [fromIdx, toIdx] =
        startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
      return monthDates.slice(fromIdx, toIdx + 1)
    }

    set({ isDragging: true, dragStartDate: date })

    if (shiftKey && selectedDates.length > 0) {
      const lastSelected = selectedDates[selectedDates.length - 1]
      if (lastSelected) {
        set({ selectedDates: getDateRange(lastSelected, date) })
      }
    } else if (selectedDates.length === 1 && selectedDates[0] === date) {
      set({ selectedDates: [] })
    } else {
      set({ selectedDates: [date] })
    }
  },
  extendSelection: (date) => {
    const { isDragging, dragStartDate, monthDates } = get()
    if (!isDragging || !dragStartDate) return

    const startIdx = monthDates.indexOf(dragStartDate)
    const endIdx = monthDates.indexOf(date)
    const [fromIdx, toIdx] =
      startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    set({ selectedDates: monthDates.slice(fromIdx, toIdx + 1) })
  },
  // データ操作
  setMonthData: (data) =>
    set((state) => ({
      monthData: typeof data === 'function' ? data(state.monthData) : data,
    })),
  setShowOnlyFilled: (value) =>
    set((state) => ({
      showOnlyFilled:
        typeof value === 'function' ? value(state.showOnlyFilled) : value,
    })),
  updateEntry: (date, field, value) => {
    set((state) => {
      const entry = state.monthData[date] ?? {
        startTime: '',
        endTime: '',
        breakMinutes: 0,
        description: '',
      }
      const updated = {
        ...entry,
        [field]: value,
      }
      // description を手動編集したら aiGenerated をリセット
      if (field === 'description') {
        updated.aiGenerated = false
      }
      // 初回入力時のみ休憩を自動設定（既に両方入力済みの場合は上書きしない）
      if (
        (field === 'startTime' || field === 'endTime') &&
        value &&
        entry.breakMinutes === 0 &&
        !(entry.startTime && entry.endTime)
      ) {
        updated.breakMinutes = 60
      }
      return {
        monthData: {
          ...state.monthData,
          [date]: updated,
        },
      }
    })
  },
  clearAllData: () =>
    set({ monthData: {}, selectedDates: [], activitiesByDate: {} }),
  // ハイライト操作
  setHighlightedDates: (dates) => set({ highlightedDates: dates }),
  // アクティビティ操作
  setActivities: (activities) => {
    const byDate: Record<string, ActivityRecord[]> = {}
    for (const a of activities) {
      let arr = byDate[a.eventDate]
      if (!arr) {
        arr = []
        byDate[a.eventDate] = arr
      }
      arr.push(a)
    }
    set({ activitiesByDate: byDate })
  },
  setActivitiesByDate: (byDate) => set({ activitiesByDate: byDate }),
  clearActivities: () => set({ activitiesByDate: {} }),
  // クリップボード操作
  copySelection: () => {
    const { selectedDates, monthData } = get()
    if (selectedDates.length === 0) return
    const entries: TimesheetEntry[] = []
    for (const date of selectedDates) {
      const entry = monthData[date]
      if (entry) entries.push(entry)
    }
    if (entries.length > 0) {
      set({ clipboard: entries })
    }
  },
  pasteToSelected: (weekdaysOnly) => {
    const { selectedDates, clipboard } = get()
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    const targets = weekdaysOnly
      ? selectedDates.filter(isWeekday)
      : selectedDates
    if (targets.length === 0) return

    set((state) => {
      const newData = { ...state.monthData }
      for (let i = 0; i < targets.length; i++) {
        const date = targets[i]
        const entry = clipboard[i % clipboard.length]
        if (date && entry) {
          newData[date] = { ...entry, aiGenerated: false }
        }
      }
      return { monthData: newData }
    })
  },
  clearSelectedEntries: () => {
    const { selectedDates } = get()
    if (selectedDates.length === 0) return

    set((state) => {
      const newData = { ...state.monthData }
      for (const date of selectedDates) {
        delete newData[date]
      }
      return { monthData: newData, selectedDates: [] }
    })
  },
}))

// 各行が自分の選択状態のみ subscribe するセレクタ
export function useIsSelected(date: string) {
  return useTimesheetStore((state) => state.selectedDates.includes(date))
}

// 各行がハイライト状態のみ subscribe するセレクタ
export function useIsHighlighted(date: string) {
  return useTimesheetStore((state) => state.highlightedDates.includes(date))
}

// フィルタリング用: データがある日付のセットを subscribe するセレクタ
// monthData 全体ではなく「どの日にデータがあるか」の変化だけを検知する
export function useFilledDatesKey() {
  return useTimesheetStore((state) => {
    const parts: string[] = []
    for (const [date, entry] of Object.entries(state.monthData)) {
      if (entry?.startTime || entry?.endTime) {
        parts.push(date)
      }
    }
    return parts.join(',')
  })
}

// 各日のアクティビティのみ subscribe するセレクタ
export function useActivitiesForDate(date: string) {
  return useTimesheetStore((state) => state.activitiesByDate[date])
}

// 各セルが自分のフィールドのみ subscribe するセレクタ
export function useEntryField<K extends keyof TimesheetEntry>(
  date: string,
  field: K,
) {
  return useTimesheetStore((state) => state.monthData[date]?.[field])
}
