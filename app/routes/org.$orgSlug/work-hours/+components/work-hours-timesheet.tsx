import { CheckIcon, Download, LoaderIcon, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '~/components/control-bar'
import { MonthNav } from '~/components/month-nav'
import {
  FilterToggleButton,
  FloatingToolbar,
  MonthTotalDisplay,
  SelectionHint,
  TimesheetContextMenuItems,
  TimesheetTable,
  getHolidayName,
  getMonthDates,
  useTimesheetSelection,
  useTimesheetStore,
} from '~/components/timesheet'
import { downloadBlob, generateTimesheetPdf } from '~/components/timesheet-pdf'
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
import { ContextMenu, ContextMenuTrigger } from '~/components/ui/context-menu'
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
import type { MonthEntry } from '../+schema'
import { toMonthData } from './data-mapping'
import { useWorkHoursAutoSave } from './use-work-hours-auto-save'

interface WorkHoursTimesheetProps {
  clientId: string
  clientEntry: MonthEntry
  year: number
  month: number
  organizationName: string
  clientName: string
  staffName: string
  monthLabel: string
  prevMonthUrl: string
  nextMonthUrl: string
}

export function WorkHoursTimesheet({
  clientId,
  clientEntry,
  year,
  month,
  organizationName,
  clientName,
  staffName,
  monthLabel,
  prevMonthUrl,
  nextMonthUrl,
}: WorkHoursTimesheetProps) {
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  // PDFダウンロードダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState({
    organizationName,
    clientName,
    staffName,
  })

  // 自動保存
  const {
    initializeLastSaved,
    status: saveStatus,
    flush,
  } = useWorkHoursAutoSave(clientId, year, month)

  // サーバーデータを store にセット
  useState(() => {
    const data = toMonthData(clientEntry.entries)
    useTimesheetStore.getState().setMonthData(data)
    useTimesheetStore.getState().setMonthDates(monthDates)
    initializeLastSaved(JSON.stringify(data))
  })

  // 選択操作（mouse/touch/auto-scroll）
  const { handleMouseUp, handleClearSelection } = useTimesheetSelection()

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
    flush()
  }, [flush])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: selection clear on background click
    <div className="space-y-4" onClick={handleClearSelection}>
      {/* ヘッダー */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
      <div onClick={(e) => e.stopPropagation()}>
        <ControlBar
          left={
            <>
              <MonthNav
                label={monthLabel}
                prevUrl={prevMonthUrl}
                nextUrl={nextMonthUrl}
              />
              <div className="flex items-center gap-3">
                <MonthTotalDisplay monthDates={monthDates} />
                {saveStatus === 'saving' && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <LoaderIcon className="size-3 animate-spin" />
                    保存中…
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-muted-foreground animate-in fade-in flex items-center gap-1 text-xs">
                    <CheckIcon className="size-3" />
                    保存済み
                  </span>
                )}
              </div>
            </>
          }
          right={
            <>
              <FilterToggleButton />
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
            </>
          }
        />
      </div>

      {/* タイムシート */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
          <div
            className="overflow-hidden rounded-md border select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <TimesheetTable monthDates={monthDates} onMouseUp={handleMouseUp} />
          </div>
        </ContextMenuTrigger>
        <TimesheetContextMenuItems />
      </ContextMenu>

      <SelectionHint />
      <FloatingToolbar />
    </div>
  )
}
