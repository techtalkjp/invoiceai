import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '~/components/control-bar'
import {
  type MonthData,
  FilterToggleButton,
  MonthTotalDisplay,
  TimesheetArea,
  TimesheetClearAllDialog,
  generateSampleData,
  getMonthDates,
  useTimesheetStore,
} from '~/components/timesheet'
import { TimesheetPdfDownloadDialog } from '~/components/timesheet/pdf-download-dialog'
import { Button } from '~/components/ui/button'
import { clearAllStorage, useAutoSave } from './use-auto-save'

interface TimesheetDemoProps {
  initialData?: Record<string, MonthData>
}

export function TimesheetDemo({ initialData }: TimesheetDemoProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // 自動保存（debounce 付き）
  useAutoSave(monthKey)

  // store に月データをセットするヘルパー
  const syncStoreForMonth = useCallback(
    (y: number, m: number) => {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const data = initialData?.[key] ?? {}
      useTimesheetStore.getState().setMonthData(data)
      useTimesheetStore.getState().setMonthDates(getMonthDates(y, m))
    },
    [initialData],
  )

  // 初回マウント時に store を初期化
  useState(() => {
    syncStoreForMonth(year, month)
  })

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
    clearAllStorage()
  }, [])

  const handlePrevMonth = () => {
    const newYear = month === 1 ? year - 1 : year
    const newMonth = month === 1 ? 12 : month - 1
    setYear(newYear)
    setMonth(newMonth)
    syncStoreForMonth(newYear, newMonth)
  }

  const handleNextMonth = () => {
    const newYear = month === 12 ? year + 1 : year
    const newMonth = month === 12 ? 1 : month + 1
    setYear(newYear)
    setMonth(newMonth)
    syncStoreForMonth(newYear, newMonth)
  }

  return (
    <TimesheetArea monthDates={monthDates}>
      <ControlBar
        left={
          <>
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
          </>
        }
        right={
          <>
            <FilterToggleButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                useTimesheetStore
                  .getState()
                  .setMonthData(generateSampleData(year, month))
              }
              className="text-muted-foreground"
            >
              <Shuffle className="size-4" />
              サンプル
            </Button>
            <TimesheetPdfDownloadDialog
              year={year}
              month={month}
              monthDates={monthDates}
            />
            <TimesheetClearAllDialog onClearAll={handleClearAll} />
          </>
        }
      />
    </TimesheetArea>
  )
}
