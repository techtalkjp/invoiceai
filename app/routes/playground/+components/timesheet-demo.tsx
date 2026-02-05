import holidayJp from '@holiday-jp/holiday_jp'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Shuffle,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '~/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { cn } from '~/lib/utils'
import { BreakGridPicker } from './break-grid-picker'
import { TimeGridPicker } from './time-grid-picker'
import { TimeInput } from './time-input'
import { calculateWorkDuration } from './time-utils'
import { downloadBlob, generateTimesheetPdf } from './timesheet-pdf'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// タイムシートエントリの型（先に定義）
export interface TimesheetEntry {
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
}

type MonthData = Record<string, TimesheetEntry>

// タイムシート store（選択状態 + データ - パフォーマンス最適化: 各行が自分の状態のみ subscribe）
interface TimesheetState {
  // 選択状態
  selectedDates: string[]
  isDragging: boolean
  dragStartDate: string | null
  monthDates: string[] // 範囲選択のため
  // データ
  monthData: MonthData
  // 選択操作
  setMonthDates: (dates: string[]) => void
  setSelectedDates: (
    dates: string[] | ((prev: string[]) => string[]),
  ) => void
  setIsDragging: (isDragging: boolean) => void
  setDragStartDate: (date: string | null) => void
  clearSelection: () => void
  startSelection: (date: string, shiftKey: boolean) => void
  extendSelection: (date: string) => void
  // データ操作
  setMonthData: (data: MonthData | ((prev: MonthData) => MonthData)) => void
  updateEntry: (date: string, field: keyof TimesheetEntry, value: string | number) => void
  clearAllData: () => void
}

const useTimesheetStore = create<TimesheetState>((set, get) => ({
  // 選択状態
  selectedDates: [],
  isDragging: false,
  dragStartDate: null,
  monthDates: [],
  // データ
  monthData: {},
  // 選択操作
  setMonthDates: (monthDates) => set({ monthDates }),
  setSelectedDates: (dates) =>
    set((state) => ({
      selectedDates: typeof dates === 'function' ? dates(state.selectedDates) : dates,
    })),
  setIsDragging: (isDragging) => set({ isDragging }),
  setDragStartDate: (dragStartDate) => set({ dragStartDate }),
  clearSelection: () => set({ selectedDates: [], isDragging: false, dragStartDate: null }),
  startSelection: (date, shiftKey) => {
    const { selectedDates, monthDates } = get()
    const getDateRange = (start: string, end: string): string[] => {
      const startIdx = monthDates.indexOf(start)
      const endIdx = monthDates.indexOf(end)
      const [fromIdx, toIdx] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
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
    const [fromIdx, toIdx] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    set({ selectedDates: monthDates.slice(fromIdx, toIdx + 1) })
  },
  // データ操作
  setMonthData: (data) =>
    set((state) => ({
      monthData: typeof data === 'function' ? data(state.monthData) : data,
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
function useIsSelected(date: string) {
  return useTimesheetStore((state) => state.selectedDates.includes(date))
}

// 各セルが自分のフィールドのみ subscribe するセレクタ
function useEntryField<K extends keyof TimesheetEntry>(date: string, field: K) {
  return useTimesheetStore((state) => state.monthData[date]?.[field])
}

function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    dates.push(dateStr)
  }
  return dates
}

function formatDateRow(dateStr: string): string {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const day = date.getDate()
  return `${day}日 (${DAY_LABELS[dayOfWeek]})`
}

function isSaturday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 6
}

function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0
}

function getHolidayName(dateStr: string): string | null {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday?.name ?? null
}

// キーボードナビゲーション用のヘルパー
function navigateToCell(
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

// タイムシート用の時間入力セル（Popover付き） - 各セルが自分のフィールドのみ subscribe
function TimesheetTimeCell({
  date,
  field,
  baseTimeField,
  allow24Plus = false,
  disabled = false,
  col,
  defaultValue = '09:00',
  open,
  onOpenChange,
  onSelectFromPicker,
}: {
  date: string
  field: 'startTime' | 'endTime'
  baseTimeField?: 'startTime' | 'endTime' | undefined
  allow24Plus?: boolean
  disabled?: boolean
  col: number
  defaultValue?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSelectFromPicker?: () => void
}) {
  // 自分のフィールドのみ subscribe（フックは常に呼び出す）
  const value = useEntryField(date, field) ?? ''
  const startTime = useEntryField(date, 'startTime')
  const baseTime = baseTimeField === 'startTime' ? startTime : undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled
    ? (onOpenChange ?? (() => {}))
    : setInternalOpen

  const handleChange = (v: string) => {
    useTimesheetStore.getState().updateEntry(date, field, v)
  }

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="inline-block">
            <TimeInput
              value={value}
              onChange={handleChange}
              placeholder=""
              className={cn(
                'h-7! w-20! text-center text-xs',
                'border-transparent! bg-muted/70! md:bg-transparent!',
                'hover:border-border! hover:bg-accent/50!',
                'focus:border-primary! focus:bg-background!',
                disabled && 'pointer-events-none opacity-50',
              )}
              baseTime={baseTime}
              onNavigate={(direction) => navigateToCell(date, col, direction)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
          <PopoverArrow className="fill-popover drop-shadow-sm" />
          <TimeGridPicker
            value={value || defaultValue}
            onChange={(v) => {
              handleChange(v)
              setIsOpen(false)
              onSelectFromPicker?.()
            }}
            interval={30}
            allow24Plus={allow24Plus}
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}

// 休憩時間入力セル（Popover付き） - 自分のフィールドのみ subscribe
function TimesheetBreakCell({
  date,
  col,
}: {
  date: string
  col: number
}) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, 'breakMinutes') ?? 0
  const [open, setOpen] = useState(false)

  const formatBreak = (minutes: number): React.ReactNode => {
    if (minutes === 0) return null
    if (minutes < 60)
      return (
        <>
          {minutes}
          <span className="text-[0.7em]">分</span>
        </>
      )
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return (
      <>
        {h}
        <span className="text-[0.7em]">時間</span>
        {m > 0 && (
          <>
            {m}
            <span className="text-[0.7em]">分</span>
          </>
        )}
      </>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateToCell(date, col, 'up')
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      navigateToCell(date, col, 'down')
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      navigateToCell(date, col, 'left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      navigateToCell(date, col, 'right')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
    }
  }

  const handleChange = (v: number) => {
    useTimesheetStore.getState().updateEntry(date, 'breakMinutes', v)
  }

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onKeyDown={handleKeyDown}
            className={cn(
              'h-7 w-20 rounded-md border text-center leading-7',
              'border-transparent bg-muted/70 md:bg-transparent',
              'hover:border-border hover:bg-accent/50',
              'focus:border-primary focus:bg-background focus:outline-none',
            )}
          >
            {formatBreak(value) || '\u00A0'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
          <PopoverArrow className="fill-popover drop-shadow-sm" />
          <BreakGridPicker
            value={value}
            onChange={(v) => {
              handleChange(v)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}

// 備考入力セル - 自分のフィールドのみ subscribe
function TimesheetDescriptionCell({
  date,
  col,
}: {
  date: string
  col: number
}) {
  // 自分のフィールドのみ subscribe
  const value = useEntryField(date, 'description') ?? ''
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (v: string) => {
    useTimesheetStore.getState().updateEntry(date, 'description', v)
  }

  return (
    <TableCell className="p-1" data-col={col}>
      <div className="relative">
        {/* 高さを確保するための非表示のプレースホルダー（常にline-clamp-3で3行分の高さ） */}
        <div
          aria-hidden="true"
          className="pointer-events-none invisible min-h-7 w-full min-w-32 whitespace-pre-wrap px-2 py-1 text-xs"
        >
          <span className="line-clamp-3">{value || '-'}</span>
        </div>

        {/* フォーカス時: 編集用textarea（absolute配置でオーバーレイ） */}
        {isFocused ? (
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              // IME変換中は何もしない
              if (e.nativeEvent.isComposing) return

              const textarea = e.target as HTMLTextAreaElement
              const atStart =
                textarea.selectionStart === 0 && textarea.selectionEnd === 0
              const atEnd =
                textarea.selectionStart === textarea.value.length &&
                textarea.selectionEnd === textarea.value.length

              // Shift+Enterで改行を許可、Enterのみで次の行へ
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                navigateToCell(date, col, 'down')
              } else if (e.key === 'Tab') {
                e.preventDefault()
                navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
              } else if (e.key === 'ArrowUp' && atStart) {
                e.preventDefault()
                navigateToCell(date, col, 'up')
              } else if (e.key === 'ArrowDown' && atEnd) {
                e.preventDefault()
                navigateToCell(date, col, 'down')
              } else if (e.key === 'ArrowLeft' && atStart) {
                e.preventDefault()
                navigateToCell(date, col, 'left')
              } else if (e.key === 'ArrowRight' && atEnd) {
                e.preventDefault()
                navigateToCell(date, col, 'right')
              }
            }}
            // biome-ignore lint/a11y/noAutofocus: フォーカス切り替え時に必要
            autoFocus
            rows={1}
            placeholder=""
            className={cn(
              'absolute inset-0 field-sizing-content min-h-7 w-full min-w-32 resize-none rounded-md border px-2 py-1 text-base md:text-xs',
              'border-primary bg-background outline-none',
            )}
          />
        ) : (
          /* 非フォーカス時: line-clampで省略表示（absolute配置でオーバーレイ） */
          <button
            type="button"
            onClick={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault()
                navigateToCell(date, col, e.shiftKey ? 'left' : 'right')
              }
            }}
            className={cn(
              'absolute inset-0 min-h-7 w-full min-w-32 cursor-text rounded-md border px-2 py-1 text-left text-xs',
              'border-transparent bg-muted/70 md:bg-transparent',
              'hover:border-border hover:bg-accent/50',
              'focus:border-primary focus:bg-background focus:outline-none',
              !value && 'text-transparent',
            )}
          >
            <span className="line-clamp-3 whitespace-pre-wrap">
              {value || '-'}
            </span>
          </button>
        )}
        {isFocused && (
          <span className="text-muted-foreground pointer-events-none absolute right-1 bottom-1.5 z-10 hidden text-[10px] md:block">
            Shift+Enter: 改行
          </span>
        )}
      </div>
    </TableCell>
  )
}

// サンプルデータ生成
function generateSampleData(year: number, month: number): MonthData {
  const data: MonthData = {}
  const dates = getMonthDates(year, month)

  dates.forEach((date) => {
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
  })

  return data
}

// クリップボードの型
type Clipboard = TimesheetEntry[] | null

// 稼働時間表示セル - 必要なフィールドのみ subscribe
function TimesheetWorkCell({ date }: { date: string }) {
  const startTime = useEntryField(date, 'startTime')
  const endTime = useEntryField(date, 'endTime')
  const breakMinutes = useEntryField(date, 'breakMinutes') ?? 0

  let workDisplay: React.ReactNode = null
  if (startTime && endTime) {
    const duration = calculateWorkDuration(startTime, endTime, breakMinutes)
    if (duration.workMinutes > 0) {
      const hours = Math.floor(duration.workMinutes / 60)
      const mins = duration.workMinutes % 60
      workDisplay = (
        <>
          {hours}
          <span className="text-[0.7em]">時間</span>
          {mins > 0 && (
            <>
              {mins}
              <span className="text-[0.7em]">分</span>
            </>
          )}
        </>
      )
    }
  }

  return (
    <TableCell className="text-muted-foreground text-center">
      {workDisplay}
    </TableCell>
  )
}

// 行コンポーネント（パフォーマンス最適化のため分離 - 選択状態のみ subscribe、各セルが自分のフィールドを subscribe）
function TimesheetRow({ date }: { date: string }) {
  // store から自分の選択状態のみ subscribe
  const selected = useIsSelected(date)

  // 選択操作（store から直接取得 - stable reference）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return
    }
    const currentSelectedDates = useTimesheetStore.getState().selectedDates
    if (e.button === 2 && currentSelectedDates.includes(date)) {
      return
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.preventDefault()
    useTimesheetStore.getState().startSelection(date, e.shiftKey)
  }

  const handleMouseEnter = () => {
    useTimesheetStore.getState().extendSelection(date)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return
    }
    useTimesheetStore.getState().startSelection(date, false)
  }
  // Picker の開閉状態を行内で管理（0: startTime, 1: endTime）
  const [openPickerCol, setOpenPickerCol] = useState<number | null>(null)

  const saturday = isSaturday(date)
  const sunday = isSunday(date)
  const holidayName = getHolidayName(date)
  const isOffDay = saturday || sunday || holidayName !== null

  const dateColorClass =
    sunday || holidayName
      ? 'text-destructive'
      : saturday
        ? 'text-blue-500'
        : undefined

  return (
    <TableRow
      data-date={date}
      className={cn(
        'cursor-pointer transition-colors',
        isOffDay && 'bg-muted/30',
        selected && 'bg-primary/5',
        !selected && !isOffDay && 'odd:bg-muted/10',
        !selected && 'active:bg-muted/40',
        !selected && 'md:hover:bg-muted/50',
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
    >
      <TableCell className="relative py-0.5 font-medium">
        {selected && (
          <div className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" />
        )}
        <div className="flex flex-col">
          <span className={dateColorClass}>{formatDateRow(date)}</span>
          {holidayName && (
            <span
              className="text-destructive/70 max-w-20 truncate text-[9px] leading-tight"
              title={holidayName}
            >
              {holidayName}
            </span>
          )}
        </div>
      </TableCell>
      <TimesheetTimeCell
        date={date}
        field="startTime"
        col={0}
        open={openPickerCol === 0}
        onOpenChange={(open) => setOpenPickerCol(open ? 0 : null)}
        onSelectFromPicker={() => {
          // 終了時間が未入力なら終了時間のPickerを開く
          const endTime = useTimesheetStore.getState().monthData[date]?.endTime
          if (!endTime) {
            setOpenPickerCol(1)
          } else {
            // 両方入力済みなら備考欄にフォーカス
            setTimeout(() => {
              const descButton = document.querySelector(
                `[data-date="${date}"] [data-col="3"] button`,
              ) as HTMLButtonElement | null
              descButton?.click()
            }, 0)
          }
        }}
      />
      <TimesheetTimeCell
        date={date}
        field="endTime"
        baseTimeField="startTime"
        allow24Plus
        col={1}
        defaultValue="18:00"
        open={openPickerCol === 1}
        onOpenChange={(open) => setOpenPickerCol(open ? 1 : null)}
        onSelectFromPicker={() => {
          // 開始時間が未入力なら開始時間のPickerを開く
          const startTime = useTimesheetStore.getState().monthData[date]?.startTime
          if (!startTime) {
            setOpenPickerCol(0)
          } else {
            // 両方入力済みなら備考欄にフォーカス
            setTimeout(() => {
              const descButton = document.querySelector(
                `[data-date="${date}"] [data-col="3"] button`,
              ) as HTMLButtonElement | null
              descButton?.click()
            }, 0)
          }
        }}
      />
      <TimesheetBreakCell date={date} col={2} />
      <TimesheetWorkCell date={date} />
      <TimesheetDescriptionCell date={date} col={3} />
    </TableRow>
  )
}

// 月合計表示（自分だけが再レンダリング - monthData の変更で TimesheetDemo を再レンダリングしない）
function MonthTotalDisplay({ monthDates }: { monthDates: string[] }) {
  const monthTotal = useTimesheetStore((s) => {
    return monthDates.reduce((sum, date) => {
      const entry = s.monthData[date]
      if (!entry?.startTime || !entry?.endTime) return sum
      const duration = calculateWorkDuration(
        entry.startTime,
        entry.endTime,
        entry.breakMinutes,
      )
      return sum + duration.workMinutes
    }, 0)
  })

  return (
    <div className="text-muted-foreground text-sm">
      合計:{' '}
      <span className="font-bold">
        {Math.floor(monthTotal / 60)}
        <span className="text-[0.8em]">時間</span>
        {monthTotal % 60 > 0 && (
          <>
            {monthTotal % 60}
            <span className="text-[0.8em]">分</span>
          </>
        )}
      </span>
    </div>
  )
}

// テーブル本体（memo で親の再レンダリングから分離）
const TimesheetTable = memo(function TimesheetTable({
  monthDates,
  onMouseUp,
}: {
  monthDates: string[]
  onMouseUp: () => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">日付</TableHead>
          <TableHead className="w-24 text-center">開始</TableHead>
          <TableHead className="w-24 text-center">終了</TableHead>
          <TableHead className="w-20 text-center">休憩</TableHead>
          <TableHead className="w-20 text-center">稼働</TableHead>
          <TableHead>概要</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody onMouseUp={onMouseUp}>
        {monthDates.map((date) => (
          <TimesheetRow key={date} date={date} />
        ))}
      </TableBody>
    </Table>
  )
})

export function TimesheetDemo() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // 選択状態（length のみ subscribe - 配列全体を subscribe すると全行が再レンダリングされる）
  const selectedCount = useTimesheetStore((s) => s.selectedDates.length)

  // クリップボード
  const [clipboard, setClipboard] = useState<Clipboard>(null)

  // PDFダウンロードダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState({
    organizationName: '',
    clientName: '',
    staffName: '',
  })

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  // monthDates を store にセット（範囲選択で使用）
  useEffect(() => {
    useTimesheetStore.getState().setMonthDates(monthDates)
  }, [monthDates])

  // マウスアップ: 選択終了
  const handleMouseUp = useCallback(() => {
    useTimesheetStore.getState().setIsDragging(false)
  }, [])

  // グローバルなmouseup/mousemoveをリッスン + 自動スクロール
  useEffect(() => {
    let scrollAnimationId: number | null = null

    const handleGlobalMouseUp = () => {
      useTimesheetStore.getState().setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { isDragging: dragging, dragStartDate: startDate } = useTimesheetStore.getState()
      if (!dragging || !startDate) return

      const mouseY = e.clientY
      const viewportHeight = window.innerHeight
      const scrollThreshold = 80 // 画面端からこのpx以内で自動スクロール開始
      const scrollSpeed = 15

      // 自動スクロール処理
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }

      const autoScroll = () => {
        let scrolled = false
        if (mouseY < scrollThreshold) {
          // 上端に近い: 上にスクロール
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (mouseY > viewportHeight - scrollThreshold) {
          // 下端に近い: 下にスクロール
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          // スクロール後に選択を更新
          updateSelectionFromMouseY(mouseY)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      // 端に近ければ自動スクロール開始
      if (mouseY < scrollThreshold || mouseY > viewportHeight - scrollThreshold) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }

      // 選択を更新
      updateSelectionFromMouseY(mouseY)
    }

    const updateSelectionFromMouseY = (mouseY: number) => {
      const rows = Array.from(
        document.querySelectorAll('[data-date]'),
      ) as HTMLElement[]
      if (rows.length === 0) return

      let closestRow: HTMLElement | null = null
      let closestDistance = Number.POSITIVE_INFINITY

      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        const rowCenterY = rect.top + rect.height / 2
        const distance = Math.abs(mouseY - rowCenterY)

        // マウスが行より上にある場合は最初の行、下にある場合は最後の行を選択
        if (mouseY < rect.top && rows.indexOf(row) === 0) {
          closestRow = row
          break
        }
        if (mouseY > rect.bottom && rows.indexOf(row) === rows.length - 1) {
          closestRow = row
          break
        }
        if (distance < closestDistance) {
          closestDistance = distance
          closestRow = row
        }
      }

      if (closestRow) {
        const date = closestRow.dataset.date
        if (date) {
          useTimesheetStore.getState().extendSelection(date)
        }
      }
    }

    const handleGlobalTouchEnd = () => {
      useTimesheetStore.getState().setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalTouchMove = (e: TouchEvent) => {
      const { isDragging: dragging, dragStartDate: startDate } = useTimesheetStore.getState()
      if (!dragging || !startDate) return

      const touch = e.touches[0]
      if (!touch) return

      const touchY = touch.clientY
      const viewportHeight = window.innerHeight
      const scrollThreshold = 80
      const scrollSpeed = 15

      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }

      const autoScroll = () => {
        let scrolled = false
        if (touchY < scrollThreshold) {
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (touchY > viewportHeight - scrollThreshold) {
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          updateSelectionFromMouseY(touchY)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      if (touchY < scrollThreshold || touchY > viewportHeight - scrollThreshold) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }

      updateSelectionFromMouseY(touchY)
      // タッチ中のスクロールを防止（選択操作を優先）
      e.preventDefault()
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('touchend', handleGlobalTouchEnd)
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('touchend', handleGlobalTouchEnd)
      window.removeEventListener('touchmove', handleGlobalTouchMove)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
      }
    }
  }, [])

  // 選択解除（テーブル外クリック）
  const handleClearSelection = useCallback(() => {
    const { selectedDates, setSelectedDates } = useTimesheetStore.getState()
    if (selectedDates.length > 0) {
      setSelectedDates([])
    }
  }, [])

  // コピー
  const handleCopy = useCallback(() => {
    const { selectedDates, monthData } = useTimesheetStore.getState()
    if (selectedDates.length === 0) return
    const entries = selectedDates
      .map((date: string) => monthData[date])
      .filter((e): e is TimesheetEntry => e !== undefined)
    if (entries.length > 0) {
      setClipboard(entries)
    }
  }, [])

  // 平日かどうか判定
  const isWeekday = useCallback((dateStr: string): boolean => {
    const dayOfWeek = new Date(dateStr).getDay()
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(dateStr)
  }, [])

  // ペースト
  const handlePaste = useCallback(() => {
    const { selectedDates, setMonthData } = useTimesheetStore.getState()
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date: string, idx: number) => {
        // クリップボードの内容を繰り返し適用
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
  }, [clipboard])

  // 平日のみペースト
  const handlePasteWeekdaysOnly = useCallback(() => {
    const { selectedDates, setMonthData } = useTimesheetStore.getState()
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    const weekdayDates = selectedDates.filter(isWeekday)
    if (weekdayDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      weekdayDates.forEach((date: string, idx: number) => {
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
  }, [clipboard, isWeekday])

  // 選択行クリア
  const handleClearSelected = useCallback(() => {
    const { selectedDates, setMonthData, setSelectedDates } = useTimesheetStore.getState()
    if (selectedDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date: string) => {
        delete newData[date]
      })
      return newData
    })
    setSelectedDates([])
  }, [])

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
  }, [])

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
    useTimesheetStore.getState().clearAllData()
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
    useTimesheetStore.getState().clearAllData()
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: selection clear on background click
    <div className="space-y-4" onClick={handleClearSelection}>
      {/* ヘッダー */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上段: 月切替 + 合計 */}
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-32 text-center text-lg font-medium">
              {year}年{month}月
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <MonthTotalDisplay monthDates={monthDates} />
        </div>
        {/* 下段: アクションボタン群 */}
        <div className="flex items-center justify-end gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useTimesheetStore.getState().setMonthData(generateSampleData(year, month))}
            className="text-muted-foreground"
          >
            <Shuffle className="size-4" />
            サンプル
          </Button>
          <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <Download className="size-4" />
                PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>稼働報告書ダウンロード</DialogTitle>
                <DialogDescription>
                  PDFに出力する情報を入力してください
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="clientName">クライアント名</Label>
                  <Input
                    id="clientName"
                    value={pdfInfo.clientName}
                    onChange={(e) =>
                      setPdfInfo((prev) => ({
                        ...prev,
                        clientName: e.target.value,
                      }))
                    }
                    placeholder="株式会社△△"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="organizationName">会社名</Label>
                  <Input
                    id="organizationName"
                    value={pdfInfo.organizationName}
                    onChange={(e) =>
                      setPdfInfo((prev) => ({
                        ...prev,
                        organizationName: e.target.value,
                      }))
                    }
                    placeholder="株式会社〇〇"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staffName">担当者名</Label>
                  <Input
                    id="staffName"
                    value={pdfInfo.staffName}
                    onChange={(e) =>
                      setPdfInfo((prev) => ({
                        ...prev,
                        staffName: e.target.value,
                      }))
                    }
                    placeholder="山田 太郎"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    const { monthData } = useTimesheetStore.getState()
                    const blob = await generateTimesheetPdf(
                      year,
                      month,
                      monthData,
                      monthDates,
                      getHolidayName,
                      pdfInfo,
                    )
                    downloadBlob(blob, `稼働報告書_${year}年${month}月.pdf`)
                    setPdfDialogOpen(false)
                  }}
                >
                  <Download className="size-4" />
                  ダウンロード
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                全クリア
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>全クリア</AlertDialogTitle>
                <AlertDialogDescription>
                  すべての入力内容を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleClearAll}
                >
                  クリア
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* タイムシート */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
          <div
            className="overflow-hidden rounded-md border select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <TimesheetTable
              monthDates={monthDates}
              onMouseUp={handleMouseUp}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={handleCopy}
            disabled={selectedCount === 0}
          >
            <Copy className="size-4" />
            コピー
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePaste}
            disabled={
              !clipboard || clipboard.length === 0 || selectedCount === 0
            }
          >
            <ClipboardPaste className="size-4" />
            ペースト
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePasteWeekdaysOnly}
            disabled={
              !clipboard || clipboard.length === 0 || selectedCount === 0
            }
          >
            <ClipboardPaste className="size-4" />
            平日のみペースト
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleClearSelected}
            disabled={selectedCount === 0}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            選択行をクリア
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 操作ヒント */}
      <div className="text-muted-foreground text-xs">
        行をクリックで選択 / ドラッグで範囲選択 / Shift+クリックで範囲拡張
        {clipboard && clipboard.length > 0 && (
          <span className="text-primary ml-2">
            ({clipboard.length}行コピー済み)
          </span>
        )}
      </div>

      {/* フローティングツールバー */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="bg-background/95 flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur sm:gap-2 sm:px-4 sm:py-2">
            <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
              {selectedCount}行
            </span>
            <div className="bg-border h-4 w-px" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              title="コピー"
              className="sm:hidden"
            >
              <Copy className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="hidden gap-1.5 sm:inline-flex"
            >
              <Copy className="size-4" />
              コピー
            </Button>
            {clipboard && clipboard.length > 0 && (
              <>
                <div className="bg-border hidden h-4 w-px sm:block" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePaste}
                  title="ペースト"
                  className="sm:hidden"
                >
                  <ClipboardPaste className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="hidden gap-1.5 sm:inline-flex"
                >
                  <ClipboardPaste className="size-4" />
                  ペースト
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePasteWeekdaysOnly}
                  title="平日のみペースト"
                  className="sm:hidden"
                >
                  <CalendarDays className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePasteWeekdaysOnly}
                  className="hidden gap-1.5 sm:inline-flex"
                >
                  <ClipboardPaste className="size-4" />
                  平日のみ
                </Button>
              </>
            )}
            <div className="bg-border hidden h-4 w-px sm:block" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearSelected}
              title="クリア"
              className="text-destructive hover:text-destructive sm:hidden"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelected}
              className="text-destructive hover:text-destructive hidden gap-1.5 sm:inline-flex"
            >
              <Trash2 className="size-4" />
              クリア
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
