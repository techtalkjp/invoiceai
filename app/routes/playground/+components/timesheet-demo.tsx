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
  TimesheetProvider,
  getMonthDates,
  useTimesheetStoreApi,
} from '~/components/timesheet'
import { TimesheetPdfDownloadDialog } from '~/components/timesheet/pdf-download-dialog'
import { Button } from '~/components/ui/button'
import type { GitHubResult } from '../+lib/github-oauth.server'
import { ImportPanel } from './import-panel'
import {
  clearAllStorage,
  loadActivitiesFromStorage,
  useAutoSave,
} from './use-auto-save'

interface TimesheetDemoProps {
  year: number
  month: number
  buildUrl: (year: number, month: number) => string
  initialData?: Record<string, MonthData> | undefined
  githubResult?: GitHubResult | null | undefined
}

export function TimesheetDemo(props: TimesheetDemoProps) {
  return (
    <TimesheetProvider>
      <TimesheetDemoInner {...props} />
    </TimesheetProvider>
  )
}

function TimesheetDemoInner({
  year,
  month,
  buildUrl,
  initialData,
  githubResult,
}: TimesheetDemoProps) {
  const store = useTimesheetStoreApi()
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const [isImportOpen, setIsImportOpen] = useState(!!githubResult)
  const defaultImportTab = githubResult ? ('github' as const) : undefined

  // 自動保存（debounce 付き）
  useAutoSave(store, monthKey)

  // year/month が変わるたびに store を同期
  useMemo(() => {
    const data = initialData?.[monthKey] ?? {}
    store.getState().setMonthData(data)
    store.getState().setMonthDates(monthDates)
    // localStorage から保存済みアクティビティを復元
    const savedActivities = loadActivitiesFromStorage(monthKey)
    if (savedActivities) {
      store.getState().setActivitiesByDate(savedActivities)
    }
  }, [store, monthKey, initialData, monthDates])

  // 全クリア
  const handleClearAll = useCallback(() => {
    store.getState().clearAllData()
    clearAllStorage()
  }, [store])

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
