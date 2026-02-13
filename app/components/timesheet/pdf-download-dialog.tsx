import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
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
import { useTimesheetStore } from './store'
import type { TimesheetPdfInfo } from './timesheet-pdf'
import { downloadBlob, generateTimesheetPdf } from './timesheet-pdf'
import { getHolidayName } from './utils'

interface TimesheetPdfDownloadDialogProps {
  year: number
  month: number
  monthDates: string[]
  defaultInfo?: Partial<TimesheetPdfInfo> | undefined
}

export function TimesheetPdfDownloadDialog({
  year,
  month,
  monthDates,
  defaultInfo,
}: TimesheetPdfDownloadDialogProps) {
  const [open, setOpen] = useState(false)
  const [pdfInfo, setPdfInfo] = useState<TimesheetPdfInfo>({
    organizationName: defaultInfo?.organizationName ?? '',
    clientName: defaultInfo?.clientName ?? '',
    staffName: defaultInfo?.staffName ?? '',
  })

  const handleDownload = async () => {
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
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="PDFダウンロード"
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
          <Button onClick={handleDownload}>
            <Download className="size-4" />
            ダウンロード
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
