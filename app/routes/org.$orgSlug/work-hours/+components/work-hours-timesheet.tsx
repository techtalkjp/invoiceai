import { CheckIcon, Download, LoaderIcon, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ControlBar } from '~/components/control-bar'
import { MonthNav } from '~/components/month-nav'
import {
  type Clipboard,
  type TimesheetEntry,
  FilterToggleButton,
  FloatingToolbar,
  MonthTotalDisplay,
  TimesheetContextMenuItems,
  TimesheetTable,
  getHolidayName,
  getMonthDates,
  isWeekday,
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

  // クリップボード
  const [clipboard, setClipboard] = useState<Clipboard>(null)

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

  // サーバーデータを store にセット（URL ナビゲーションで clientEntry が変わると React Router が再マウントする）
  useState(() => {
    const data = toMonthData(clientEntry.entries)
    useTimesheetStore.getState().setMonthData(data)
    useTimesheetStore.getState().setMonthDates(monthDates)
    initializeLastSaved(JSON.stringify(data))
  })

  // マウスアップ: 選択終了
  const handleMouseUp = useCallback(() => {
    useTimesheetStore.getState().setIsDragging(false)
  }, [])

  // グローバルなmouseup/mousemove/touchイベント + 自動スクロール
  useEffect(() => {
    let scrollAnimationId: number | null = null

    const handleGlobalMouseUp = () => {
      useTimesheetStore.getState().setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
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

      if (closestRow) {
        const date = closestRow.dataset.date
        if (date) {
          useTimesheetStore.getState().extendSelection(date)
        }
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { isDragging: dragging, dragStartDate: startDate } =
        useTimesheetStore.getState()
      if (!dragging || !startDate) return

      const mouseY = e.clientY
      const viewportHeight = window.innerHeight
      const scrollThreshold = 80
      const scrollSpeed = 15

      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }

      const autoScroll = () => {
        let scrolled = false
        if (mouseY < scrollThreshold) {
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (mouseY > viewportHeight - scrollThreshold) {
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          updateSelectionFromMouseY(mouseY)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      if (
        mouseY < scrollThreshold ||
        mouseY > viewportHeight - scrollThreshold
      ) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }

      updateSelectionFromMouseY(mouseY)
    }

    const handleGlobalTouchEnd = () => {
      useTimesheetStore.getState().setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalTouchMove = (e: TouchEvent) => {
      const { isDragging: dragging, dragStartDate: startDate } =
        useTimesheetStore.getState()
      if (!dragging || !startDate) return

      const touch = e.touches[0]
      if (!touch) return

      const touchY = touch.clientY
      const viewportHeight = window.innerHeight
      const scrollThreshold = 80
      const scrollSpeed = 15

      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }

      const autoScroll = () => {
        let scrolled = false
        if (touchY < scrollThreshold) {
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (touchY > viewportHeight - scrollThreshold) {
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          updateSelectionFromMouseY(touchY)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      if (
        touchY < scrollThreshold ||
        touchY > viewportHeight - scrollThreshold
      ) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }

      updateSelectionFromMouseY(touchY)
      e.preventDefault()
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('touchend', handleGlobalTouchEnd)
    window.addEventListener('touchmove', handleGlobalTouchMove, {
      passive: false,
    })
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('touchend', handleGlobalTouchEnd)
      window.removeEventListener('touchmove', handleGlobalTouchMove)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
      }
    }
  }, [])

  // 選択解除
  const handleClearSelection = useCallback(() => {
    const { selectedDates, setSelectedDates } = useTimesheetStore.getState()
    if (selectedDates.length > 0) {
      setSelectedDates([])
    }
  }, [])

  // コピー
  const handleCopy = useCallback(() => {
    const { selectedDates, monthData } = useTimesheetStore.getState()
    if (selectedDates.length === 0) return
    const entries = selectedDates
      .map((date: string) => monthData[date])
      .filter((e): e is TimesheetEntry => e !== undefined)
    if (entries.length > 0) {
      setClipboard(entries)
    }
  }, [])

  // ペースト
  const handlePaste = useCallback(() => {
    const { selectedDates, setMonthData } = useTimesheetStore.getState()
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date: string, idx: number) => {
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
    flush()
  }, [clipboard, flush])

  // 平日のみペースト
  const handlePasteWeekdaysOnly = useCallback(() => {
    const { selectedDates, setMonthData } = useTimesheetStore.getState()
    if (!clipboard || clipboard.length === 0 || selectedDates.length === 0)
      return

    const weekdayDates = selectedDates.filter(isWeekday)
    if (weekdayDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      weekdayDates.forEach((date: string, idx: number) => {
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
    flush()
  }, [clipboard, flush])

  // 選択行クリア
  const handleClearSelected = useCallback(() => {
    const { selectedDates, setMonthData, setSelectedDates } =
      useTimesheetStore.getState()
    if (selectedDates.length === 0) return

    setMonthData((prev) => {
      const newData = { ...prev }
      selectedDates.forEach((date: string) => {
        delete newData[date]
      })
      return newData
    })
    setSelectedDates([])
    flush()
  }, [flush])

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
        <TimesheetContextMenuItems
          clipboard={clipboard}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onPasteWeekdaysOnly={handlePasteWeekdaysOnly}
          onClearSelected={handleClearSelected}
        />
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
      <FloatingToolbar
        clipboard={clipboard}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onPasteWeekdaysOnly={handlePasteWeekdaysOnly}
        onClearSelected={handleClearSelected}
      />
    </div>
  )
}
