import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { formatYearMonthLabel } from '~/utils/month'

interface MonthNavProps {
  year: number
  month: number
  buildUrl: (year: number, month: number) => string
}

const MONTH_NAMES = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]

export function MonthNav({ year, month, buildUrl }: MonthNavProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const isCurrentMonth = year === todayYear && month === todayMonth

  const label = formatYearMonthLabel(year, month)

  const handleMonthSelect = (m: number) => {
    setOpen(false)
    navigate(buildUrl(pickerYear, m))
  }

  // ピッカーを開く度に表示年をリセット
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPickerYear(year)
    }
    setOpen(nextOpen)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" asChild>
        <Link to={buildUrl(prevYear, prevMonth)}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
      </Button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:bg-accent min-w-32 cursor-pointer rounded-md px-3 py-1.5 text-center text-lg font-medium transition-colors"
          >
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          {/* 年ナビゲーション */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{pickerYear}年</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* 月グリッド */}
          <div className="grid grid-cols-4 gap-1">
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1
              const isSelected = pickerYear === year && m === month
              const isToday = pickerYear === todayYear && m === todayMonth
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMonthSelect(m)}
                  className={`cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                        ? 'ring-primary hover:bg-accent ring-1'
                        : 'hover:bg-accent'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>

          {/* 今月ボタン */}
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate(buildUrl(todayYear, todayMonth))
              }}
              className="text-muted-foreground hover:text-foreground mt-2 w-full cursor-pointer rounded-md py-1 text-center text-xs transition-colors"
            >
              今月に戻る
            </button>
          )}
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" asChild>
        <Link to={buildUrl(nextYear, nextMonth)}>
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
