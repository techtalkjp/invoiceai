import {
  ChevronLeft,
  ChevronRight,
  Download,
  Shuffle,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '~/components/control-bar'
import {
  type MonthData,
  FilterToggleButton,
  FloatingToolbar,
  MonthTotalDisplay,
  SelectionHint,
  TimesheetContextMenuItems,
  TimesheetTable,
  generateSampleData,
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
import { clearAllStorage, useAutoSave } from './use-auto-save'

interface TimesheetDemoProps {
  initialData?: Record<string, MonthData>
}

export function TimesheetDemo({ initialData }: TimesheetDemoProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // PDFダウンロードダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState({
    organizationName: '',
    clientName: '',
    staffName: '',
  })

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // 自動保存（debounce 付き）
  useAutoSave(monthKey)

  // 選択操作（mouse/touch/auto-scroll）
  const { handleMouseUp, handleClearSelection } = useTimesheetSelection()

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
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: selection clear on background click
    <div className="space-y-4" onClick={handleClearSelection}>
      {/* ヘッダー */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
      <div onClick={(e) => e.stopPropagation()}>
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
