import { Shuffle } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
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
  year: number
  month: number
  monthLabel: string
  prevUrl: string
  nextUrl: string
  initialData?: Record<string, MonthData> | undefined
}

export function TimesheetDemo({
  year,
  month,
  monthLabel,
  prevUrl,
  nextUrl,
  initialData,
}: TimesheetDemoProps) {
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // 自動保存（debounce 付き）
  useAutoSave(monthKey)

  // year/month が変わるたびに store を同期
  useMemo(() => {
    const data = initialData?.[monthKey] ?? {}
    useTimesheetStore.getState().setMonthData(data)
    useTimesheetStore.getState().setMonthDates(monthDates)
  }, [monthKey, initialData, monthDates])

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
    clearAllStorage()
  }, [])

  return (
    <TimesheetArea monthDates={monthDates}>
      <ControlBar
        left={
          <>
            <MonthNav label={monthLabel} prevUrl={prevUrl} nextUrl={nextUrl} />
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
