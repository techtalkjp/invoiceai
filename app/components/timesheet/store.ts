import { create } from 'zustand'
import type { MonthData, TimesheetEntry } from './types'

// タイムシート store の状態（UI状態管理のみ、永続化は clientAction で行う）
export interface TimesheetState {
  // 選択状態
  selectedDates: string[]
  isDragging: boolean
  dragStartDate: string | null
  monthDates: string[] // 範囲選択のため
  // データ（メモリ上のみ - 永続化は clientAction で行う）
  monthData: MonthData
  // フィルタ
  showOnlyFilled: boolean
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
      // 開始 or 終了が入力され、休憩が未設定の場合はデフォルト1時間
      if (
        (field === 'startTime' || field === 'endTime') &&
        value &&
        entry.breakMinutes === 0
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
  clearAllData: () => set({ monthData: {}, selectedDates: [] }),
}))

// 各行が自分の選択状態のみ subscribe するセレクタ
export function useIsSelected(date: string) {
  return useTimesheetStore((state) => state.selectedDates.includes(date))
}

// 各セルが自分のフィールドのみ subscribe するセレクタ
export function useEntryField<K extends keyof TimesheetEntry>(
  date: string,
  field: K,
) {
  return useTimesheetStore((state) => state.monthData[date]?.[field])
}
