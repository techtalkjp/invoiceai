import { ImportIcon } from 'lucide-react'
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
import { Button } from '~/components/ui/button'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import type { MonthEntry } from '../+schema'
import { toMonthData } from './data-mapping'
import { ImportPanel } from './import-panel'
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
  activitiesByDate?: Record<string, ActivityRecord[]> | undefined
  buildUrl: (year: number, month: number) => string
  orgSlug: string
  hasGitHubPat: boolean
  mappings: Array<{ clientId: string; sourceIdentifier: string }>
}

export function WorkHoursTimesheet({
  clientId,
  clientEntry,
  year,
  month,
  organizationName,
  clientName,
  staffName,
  activitiesByDate,
  buildUrl,
  orgSlug,
  hasGitHubPat,
  mappings,
}: WorkHoursTimesheetProps) {
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const [isImportOpen, setIsImportOpen] = useState(false)

  // 自動保存
  const {
    initializeLastSaved,
    fetcherKey: saveFetcherKey,
    flush,
  } = useWorkHoursAutoSave(clientId, year, month)

  // サーバーデータを store にセット
  useState(() => {
    const store = useTimesheetStore.getState()
    const data = toMonthData(clientEntry.entries)
    store.setMonthData(data)
    store.setMonthDates(monthDates)
    store.setActivitiesByDate(activitiesByDate ?? {})
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
            <Button
              variant={isImportOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsImportOpen((v) => !v)}
              className="text-muted-foreground text-xs"
            >
              <ImportIcon className="size-3.5" />
              取込
            </Button>
            <div className="bg-border h-4 w-px" />
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
      <ImportPanel
        clientId={clientId}
        year={year}
        month={month}
        orgSlug={orgSlug}
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        hasGitHubPat={hasGitHubPat}
        mappings={mappings}
      />
    </TimesheetArea>
  )
}
