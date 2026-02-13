import { ImportIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '~/components/layout/control-bar'
import { MonthNav } from '~/components/layout/month-nav'
import {
  type MonthData,
  FilterToggleButton,
  MonthTotalDisplay,
  TimesheetArea,
  TimesheetClearAllDialog,
  getMonthDates,
  useTimesheetStore,
} from '~/components/timesheet'
import { useActivityStore } from '~/components/timesheet/activity-store'
import { TimesheetPdfDownloadDialog } from '~/components/timesheet/pdf-download-dialog'
import { Button } from '~/components/ui/button'
import type { GitHubResult } from '../+lib/github-oauth.server'
import { ImportPanel } from './import-panel'
import { clearAllStorage, useAutoSave } from './use-auto-save'

interface TimesheetDemoProps {
  year: number
  month: number
  buildUrl: (year: number, month: number) => string
  initialData?: Record<string, MonthData> | undefined
  githubResult?: GitHubResult | null | undefined
}

export function TimesheetDemo({
  year,
  month,
  buildUrl,
  initialData,
  githubResult,
}: TimesheetDemoProps) {
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const [isImportOpen, setIsImportOpen] = useState(!!githubResult)
  const defaultImportTab = githubResult ? ('github' as const) : undefined

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
    useActivityStore.getState().clearActivities()
    clearAllStorage()
  }, [])

  return (
    <TimesheetArea monthDates={monthDates}>
      <ControlBar
        left={
          <>
            <MonthNav year={year} month={month} buildUrl={buildUrl} />
            <MonthTotalDisplay monthDates={monthDates} />
          </>
        }
        right={
          <>
            <Button
              variant={isImportOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsImportOpen((v) => !v)}
              title="インポート"
              className="text-muted-foreground"
            >
              <ImportIcon className="size-4" />
              取込
            </Button>
            <div className="bg-border h-4 w-px" />
            <FilterToggleButton />
            <TimesheetPdfDownloadDialog
              year={year}
              month={month}
              monthDates={monthDates}
            />
            <TimesheetClearAllDialog onClearAll={handleClearAll} />
          </>
        }
      />
      <ImportPanel
        year={year}
        month={month}
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        defaultTab={defaultImportTab}
        githubResult={githubResult}
      />
    </TimesheetArea>
  )
}
