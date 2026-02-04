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
import { useCallback, useEffect, useMemo, useState } from 'react'
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

export interface TimesheetEntry {
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
}

type MonthData = Record<string, TimesheetEntry>

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

// タイムシート用の時間入力セル（Popover付き）
function TimesheetTimeCell({
  value,
  onChange,
  baseTime,
  allow24Plus = false,
  disabled = false,
  date,
  col,
  defaultValue = '09:00',
  open,
  onOpenChange,
  onSelectFromPicker,
}: {
  value: string
  onChange: (value: string) => void
  baseTime?: string | undefined
  allow24Plus?: boolean
  disabled?: boolean
  date: string
  col: number
  defaultValue?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSelectFromPicker?: () => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled
    ? (onOpenChange ?? (() => {}))
    : setInternalOpen

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="inline-block">
            <TimeInput
              value={value}
              onChange={onChange}
              placeholder=""
              className={cn(
                'h-7! w-20! text-center text-xs',
                'border-transparent! bg-transparent!',
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
              onChange(v)
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

// 休憩時間入力セル（Popover付き）
function TimesheetBreakCell({
  value,
  onChange,
  date,
  col,
}: {
  value: number
  onChange: (value: number) => void
  date: string
  col: number
}) {
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

  return (
    <TableCell className="p-1 text-center" data-col={col}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onKeyDown={handleKeyDown}
            className={cn(
              'h-7 w-20 rounded-md border text-center text-xs leading-7',
              'border-transparent bg-transparent',
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
              onChange(v)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}

// 備考入力セル
function TimesheetDescriptionCell({
  value,
  onChange,
  date,
  col,
}: {
  value: string
  onChange: (value: string) => void
  date: string
  col: number
}) {
  const [isFocused, setIsFocused] = useState(false)

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
            onChange={(e) => onChange(e.target.value)}
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
              'absolute inset-0 field-sizing-content min-h-7 w-full min-w-32 resize-none rounded-md border px-2 py-1 text-xs',
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
              'border-transparent bg-transparent',
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
          <span className="text-muted-foreground pointer-events-none absolute right-1 bottom-1.5 z-10 text-[10px]">
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

export function TimesheetDemo() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthData, setMonthData] = useState<MonthData>({})

  // 選択状態
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [dragStartDate, setDragStartDate] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // クリップボード
  const [clipboard, setClipboard] = useState<Clipboard>(null)

  // 時間Pickerの開閉状態 (date-col の形式でキーを管理)
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null)

  // PDFダウンロードダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState({
    organizationName: '',
    clientName: '',
    staffName: '',
  })

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  // 範囲選択のヘルパー
  const getDateRange = useCallback(
    (start: string, end: string): string[] => {
      const startIdx = monthDates.indexOf(start)
      const endIdx = monthDates.indexOf(end)
      const [fromIdx, toIdx] =
        startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
      return monthDates.slice(fromIdx, toIdx + 1)
    },
    [monthDates],
  )

  // マウスダウン: 選択開始
  const handleMouseDown = useCallback(
    (date: string, e: React.MouseEvent) => {
      // input要素、textarea要素、select要素をクリックした場合は選択しない
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // 右クリックで既に選択範囲内の場合は選択を維持
      if (e.button === 2 && selectedDates.includes(date)) {
        return
      }

      // 現在フォーカスがある要素からフォーカスを外す
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      e.preventDefault()
      setIsDragging(true)
      setDragStartDate(date)

      if (e.shiftKey && selectedDates.length > 0) {
        // Shift+クリック: 最後の選択から範囲選択
        const lastSelected = selectedDates[selectedDates.length - 1]
        if (lastSelected) {
          const range = getDateRange(lastSelected, date)
          setSelectedDates(range)
        }
      } else if (selectedDates.length === 1 && selectedDates[0] === date) {
        // 1行選択中にその行をクリック: 選択クリア
        setSelectedDates([])
      } else {
        // 通常クリック: 新しい選択
        setSelectedDates([date])
      }
    },
    [selectedDates, getDateRange],
  )

  // マウス移動: ドラッグ選択
  const handleMouseEnter = useCallback(
    (date: string) => {
      if (isDragging && dragStartDate) {
        const range = getDateRange(dragStartDate, date)
        setSelectedDates(range)
      }
    },
    [isDragging, dragStartDate, getDateRange],
  )

  // マウスアップ: 選択終了
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // グローバルなmouseup/mousemoveをリッスン + 自動スクロール
  useEffect(() => {
    let scrollAnimationId: number | null = null

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartDate) return

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

        if (scrolled && isDragging) {
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

      if (closestRow && dragStartDate) {
        const date = closestRow.dataset.date
        if (date) {
          const range = getDateRange(dragStartDate, date)
          setSelectedDates(range)
        }
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
      }
    }
  }, [isDragging, dragStartDate, getDateRange])

  // 選択解除（テーブル外クリック）
  const handleClearSelection = useCallback(() => {
    if (selectedDates.length > 0) {
      setSelectedDates([])
    }
  }, [selectedDates.length])

  // コピー
  const handleCopy = useCallback(() => {
    if (selectedDates.length === 0) return
    const entries = selectedDates
      .map((date) => monthData[date])
      .filter((e): e is TimesheetEntry => e !== undefined)
    if (entries.length > 0) {
      setClipboard(entries)
    }
  }, [selectedDates, monthData])

  // 平日かどうか判定
  const isWeekday = useCallback((dateStr: string): boolean => {
    const dayOfWeek = new Date(dateStr).getDay()
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayName(dateStr)
  }, [])

  // ペースト
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date, idx) => {
        // クリップボードの内容を繰り返し適用
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
  }, [clipboard, selectedDates])

  // 平日のみペースト
  const handlePasteWeekdaysOnly = useCallback(() => {
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    const weekdayDates = selectedDates.filter(isWeekday)
    if (weekdayDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      weekdayDates.forEach((date, idx) => {
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
  }, [clipboard, selectedDates, isWeekday])

  // 選択行クリア
  const handleClearSelected = useCallback(() => {
    if (selectedDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date) => {
        delete newData[date]
      })
      return newData
    })
    setSelectedDates([])
  }, [selectedDates])

  // 全クリア
  const handleClearAll = useCallback(() => {
    setMonthData({})
    setSelectedDates([])
  }, [])

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
    setMonthData({})
    setSelectedDates([])
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
    setMonthData({})
    setSelectedDates([])
  }

  const handleUpdateEntry = (
    date: string,
    field: keyof TimesheetEntry,
    value: string | number,
  ) => {
    setMonthData((prev) => {
      const entry = prev[date] ?? {
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
        ...prev,
        [date]: updated,
      }
    })
  }

  // 月合計計算
  const monthTotal = useMemo(() => {
    return monthDates.reduce((sum, date) => {
      const entry = monthData[date]
      if (!entry?.startTime || !entry?.endTime) return sum
      const duration = calculateWorkDuration(
        entry.startTime,
        entry.endTime,
        entry.breakMinutes,
      )
      return sum + duration.workMinutes
    }, 0)
  }, [monthDates, monthData])

  // 選択中かどうか
  const isSelected = useCallback(
    (date: string) => selectedDates.includes(date),
    [selectedDates],
  )

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: selection clear on background click
    <div className="space-y-4" onClick={handleClearSelection}>
      {/* ヘッダー */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
      <div
        className="flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex items-center gap-4">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonthData(generateSampleData(year, month))}
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
              <TableBody onMouseUp={handleMouseUp}>
                {monthDates.map((date) => {
                  const entry = monthData[date]
                  const saturday = isSaturday(date)
                  const sunday = isSunday(date)
                  const holidayName = getHolidayName(date)
                  const isOffDay = saturday || sunday || holidayName !== null
                  const selected = isSelected(date)

                  const dateColorClass =
                    sunday || holidayName
                      ? 'text-destructive'
                      : saturday
                        ? 'text-blue-500'
                        : undefined

                  // 稼働時間計算
                  let workDisplay: React.ReactNode = null
                  if (entry?.startTime && entry?.endTime) {
                    const duration = calculateWorkDuration(
                      entry.startTime,
                      entry.endTime,
                      entry.breakMinutes,
                    )
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
                    <TableRow
                      key={date}
                      data-date={date}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isOffDay && 'bg-muted/30',
                        selected && 'bg-primary/5',
                        !selected && 'hover:bg-muted/50',
                      )}
                      onMouseDown={(e) => handleMouseDown(date, e)}
                      onMouseEnter={() => handleMouseEnter(date)}
                    >
                      <TableCell className="relative py-0.5 font-medium">
                        {selected && (
                          <div className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" />
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className={dateColorClass}>
                            {formatDateRow(date)}
                          </span>
                          {holidayName && (
                            <span
                              className="text-destructive/70 max-w-16 truncate text-[10px]"
                              title={holidayName}
                            >
                              {holidayName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TimesheetTimeCell
                        value={entry?.startTime ?? ''}
                        onChange={(value) =>
                          handleUpdateEntry(date, 'startTime', value)
                        }
                        date={date}
                        col={0}
                        open={openPickerKey === `${date}-0`}
                        onOpenChange={(open) =>
                          setOpenPickerKey(open ? `${date}-0` : null)
                        }
                        onSelectFromPicker={() => {
                          // 終了時間が未入力なら終了時間のPickerを開く
                          if (!entry?.endTime) {
                            setOpenPickerKey(`${date}-1`)
                          } else {
                            // 両方入力済みなら備考欄にフォーカス（buttonをクリックしてフォーカスモードにする）
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
                        value={entry?.endTime ?? ''}
                        onChange={(value) =>
                          handleUpdateEntry(date, 'endTime', value)
                        }
                        baseTime={entry?.startTime}
                        allow24Plus
                        date={date}
                        col={1}
                        defaultValue="18:00"
                        open={openPickerKey === `${date}-1`}
                        onOpenChange={(open) =>
                          setOpenPickerKey(open ? `${date}-1` : null)
                        }
                        onSelectFromPicker={() => {
                          // 開始時間が未入力なら開始時間のPickerを開く
                          if (!entry?.startTime) {
                            setOpenPickerKey(`${date}-0`)
                          } else {
                            // 両方入力済みなら備考欄にフォーカス（buttonをクリックしてフォーカスモードにする）
                            setTimeout(() => {
                              const descButton = document.querySelector(
                                `[data-date="${date}"] [data-col="3"] button`,
                              ) as HTMLButtonElement | null
                              descButton?.click()
                            }, 0)
                          }
                        }}
                      />
                      <TimesheetBreakCell
                        value={entry?.breakMinutes ?? 0}
                        onChange={(value) =>
                          handleUpdateEntry(date, 'breakMinutes', value)
                        }
                        date={date}
                        col={2}
                      />
                      <TableCell className="text-muted-foreground text-center">
                        {workDisplay}
                      </TableCell>
                      <TimesheetDescriptionCell
                        value={entry?.description ?? ''}
                        onChange={(value) =>
                          handleUpdateEntry(date, 'description', value)
                        }
                        date={date}
                        col={3}
                      />
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={handleCopy}
            disabled={selectedDates.length === 0}
          >
            <Copy className="size-4" />
            コピー
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePaste}
            disabled={
              !clipboard || clipboard.length === 0 || selectedDates.length === 0
            }
          >
            <ClipboardPaste className="size-4" />
            ペースト
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePasteWeekdaysOnly}
            disabled={
              !clipboard || clipboard.length === 0 || selectedDates.length === 0
            }
          >
            <ClipboardPaste className="size-4" />
            平日のみペースト
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleClearSelected}
            disabled={selectedDates.length === 0}
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
      {selectedDates.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="bg-background/95 flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur sm:gap-2 sm:px-4 sm:py-2">
            <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
              {selectedDates.length}行
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
