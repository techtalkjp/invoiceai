import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
import {
  FilterToggleButton,
  MonthTotalDisplay,
  TimesheetArea,
  TimesheetClearAllDialog,
  getMonthDates,
  useTimesheetStore,
} from '~/components/timesheet'
import { TimesheetPdfDownloadDialog } from '~/components/timesheet/pdf-download-dialog'
import type { MonthEntry } from '../+schema'
import { toMonthData } from './data-mapping'
import { SaveStatusIndicator } from './save-status-indicator'
import { useWorkHoursAutoSave } from './use-work-hours-auto-save'

interface WorkHoursTimesheetProps {
  clientId: string
  clientEntry: MonthEntry
  year: number
  month: number
  organizationName: string
  clientName: string
  staffName: string
  buildUrl: (year: number, month: number) => string
}

export function WorkHoursTimesheet({
  clientId,
  clientEntry,
  year,
  month,
  organizationName,
  clientName,
  staffName,
  buildUrl,
}: WorkHoursTimesheetProps) {
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  // 自動保存
  const {
    initializeLastSaved,
    fetcherKey: saveFetcherKey,
    flush,
  } = useWorkHoursAutoSave(clientId, year, month)

  // サーバーデータを store にセット
  useState(() => {
    const data = toMonthData(clientEntry.entries)
    useTimesheetStore.getState().setMonthData(data)
    useTimesheetStore.getState().setMonthDates(monthDates)
    initializeLastSaved(JSON.stringify(data))
  })

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
    flush()
  }, [flush])

  return (
    <TimesheetArea monthDates={monthDates}>
      <ControlBar
        left={
          <>
            <MonthNav year={year} month={month} buildUrl={buildUrl} />
            <div className="flex items-center gap-3">
              <MonthTotalDisplay monthDates={monthDates} />
              <SaveStatusIndicator fetcherKey={saveFetcherKey} />
            </div>
          </>
        }
        right={
          <>
            <FilterToggleButton />
            <TimesheetPdfDownloadDialog
              year={year}
              month={month}
              monthDates={monthDates}
              defaultInfo={{ organizationName, clientName, staffName }}
            />
            <TimesheetClearAllDialog onClearAll={handleClearAll} />
          </>
        }
      />
    </TimesheetArea>
  )
}
