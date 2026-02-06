import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  FilterIcon,
  Shuffle,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ControlBar } from '~/components/control-bar'
import {
  type Clipboard,
  type MonthData,
  type TimesheetEntry,
  FloatingToolbar,
  MonthTotalDisplay,
  TimesheetTable,
  generateSampleData,
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '~/components/ui/context-menu'
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
import { useAutoSave, useSaveAction } from './use-auto-save'

interface TimesheetDemoProps {
  initialData?: Record<string, MonthData>
}

export function TimesheetDemo({ initialData }: TimesheetDemoProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // 選択状態（length のみ subscribe - 配列全体を subscribe すると全行が再レンダリングされる）
  const selectedCount = useTimesheetStore((s) => s.selectedDates.length)

  // クリップボード
  const [clipboard, setClipboard] = useState<Clipboard>(null)

  // PDFダウンロードダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState({
    organizationName: '',
    clientName: '',
    staffName: '',
  })

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const [showOnlyFilled, setShowOnlyFilled] = useState(false)
  const monthData = useTimesheetStore((s) => s.monthData)
  const filteredDates = useMemo(() => {
    if (!showOnlyFilled) return monthDates
    return monthDates.filter((date) => {
      const entry = monthData[date]
      return entry?.startTime || entry?.endTime
    })
  }, [showOnlyFilled, monthDates, monthData])
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // 自動保存（debounce 付き）
  useAutoSave(monthKey)
  const { clearAll } = useSaveAction()

  // 月切り替え時に initialData から store にセット
  useEffect(() => {
    const data = initialData?.[monthKey] ?? {}
    useTimesheetStore.getState().setMonthData(data)
  }, [initialData, monthKey])

  // monthDates を store にセット（範囲選択で使用）
  useEffect(() => {
    useTimesheetStore.getState().setMonthDates(monthDates)
  }, [monthDates])

  // マウスアップ: 選択終了
  const handleMouseUp = useCallback(() => {
    useTimesheetStore.getState().setIsDragging(false)
  }, [])

  // グローバルなmouseup/mousemoveをリッスン + 自動スクロール
  useEffect(() => {
    let scrollAnimationId: number | null = null

    const handleGlobalMouseUp = () => {
      useTimesheetStore.getState().setIsDragging(false)
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { isDragging: dragging, dragStartDate: startDate } =
        useTimesheetStore.getState()
      if (!dragging || !startDate) return

      const mouseY = e.clientY
      const viewportHeight = window.innerHeight
      const scrollThreshold = 80 // 画面端からこのpx以内で自動スクロール開始
      const scrollSpeed = 15

      // 自動スクロール処理
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }

      const autoScroll = () => {
        let scrolled = false
        if (mouseY < scrollThreshold) {
          // 上端に近い: 上にスクロール
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (mouseY > viewportHeight - scrollThreshold) {
          // 下端に近い: 下にスクロール
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          // スクロール後に選択を更新
          updateSelectionFromMouseY(mouseY)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      // 端に近ければ自動スクロール開始
      if (
        mouseY < scrollThreshold ||
        mouseY > viewportHeight - scrollThreshold
      ) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }

      // 選択を更新
      updateSelectionFromMouseY(mouseY)
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

        // マウスが行より上にある場合は最初の行、下にある場合は最後の行を選択
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
      // タッチ中のスクロールを防止（選択操作を優先）
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

  // 選択解除（テーブル外クリック）
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
        // クリップボードの内容を繰り返し適用
        const entry = clipboard[idx % clipboard.length]
        if (entry) {
          newData[date] = { ...entry }
        }
      })
      return newData
    })
  }, [clipboard])

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
  }, [clipboard])

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
  }, [])

  // 全クリア
  const handleClearAll = useCallback(() => {
    useTimesheetStore.getState().clearAllData()
    clearAll() // LocalStorage からも削除
  }, [clearAll])

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
    // 月切り替え時は useEffect で initialData から読み込む
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
    // 月切り替え時は useEffect で initialData から読み込む
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
              <Button
                variant={showOnlyFilled ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowOnlyFilled((v) => !v)}
                className="text-muted-foreground text-xs"
              >
                <FilterIcon className="size-3.5" />
                入力済みのみ
              </Button>
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
            <TimesheetTable
              monthDates={filteredDates}
              onMouseUp={handleMouseUp}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopy} disabled={selectedCount === 0}>
            <Copy className="size-4" />
            コピー
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePaste}
            disabled={
              !clipboard || clipboard.length === 0 || selectedCount === 0
            }
          >
            <ClipboardPaste className="size-4" />
            ペースト
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handlePasteWeekdaysOnly}
            disabled={
              !clipboard || clipboard.length === 0 || selectedCount === 0
            }
          >
            <ClipboardPaste className="size-4" />
            平日のみペースト
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleClearSelected}
            disabled={selectedCount === 0}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            選択行をクリア
          </ContextMenuItem>
        </ContextMenuContent>
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
        selectedCount={selectedCount}
        clipboard={clipboard}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onPasteWeekdaysOnly={handlePasteWeekdaysOnly}
        onClearSelected={handleClearSelected}
      />
    </div>
  )
}
