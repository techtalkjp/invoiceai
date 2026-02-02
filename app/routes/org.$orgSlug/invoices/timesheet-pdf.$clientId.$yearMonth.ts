import holidayJp from '@holiday-jp/holiday_jp'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { parseYearMonthId } from '~/utils/month'
import {
  TimesheetDocument,
  type TimesheetData,
  type TimesheetEntry,
} from './+pdf/timesheet-template'
import { getTimesheetDataForPdf } from './+queries.server'
import type { Route } from './+types/timesheet-pdf.$clientId.$yearMonth'

function isHoliday(dateStr: string): { isHoliday: boolean; name?: string } {
  const date = new Date(dateStr)
  const holiday = holidayJp.between(date, date)[0]
  return holiday
    ? { isHoliday: true, name: holiday.name }
    : { isHoliday: false }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId, yearMonth } = params
  const { organization } = await requireOrgMember(request, orgSlug)

  const { year, month } = parseYearMonthId(yearMonth)

  // タイムシートデータを取得
  const data = await getTimesheetDataForPdf(
    organization.id,
    clientId,
    year,
    month,
  )

  if (data.staffTimesheets.length === 0) {
    return new Response('稼働データがありません', { status: 404 })
  }

  // スタッフごとのタイムシートデータを構築（稼働がある日のみ）
  const timesheets: TimesheetData[] = data.staffTimesheets.map((staff) => {
    // 稼働がある日のみをエントリとして生成
    const entries: TimesheetEntry[] = staff.entries.map((entry) => {
      const dateObj = new Date(entry.date)
      const holidayInfo = isHoliday(entry.date)

      return {
        date: entry.date,
        dayOfWeek: dateObj.getDay(),
        isHoliday: holidayInfo.isHoliday,
        holidayName: holidayInfo.name,
        startTime: entry.startTime ?? undefined,
        endTime: entry.endTime ?? undefined,
        breakMinutes: entry.breakMinutes ?? 0,
        hours: entry.hours ?? 0,
        description: entry.description ?? undefined,
      }
    })

    return {
      staffName: staff.staffName,
      clientName: data.clientName,
      organizationName: organization.name,
      year,
      month,
      entries,
      totalHours: staff.totalHours,
    }
  })

  // PDF生成
  const pdfBuffer = await renderToBuffer(TimesheetDocument({ timesheets }))

  const filename = `timesheet_${data.clientName}_${year}${String(month).padStart(2, '0')}.pdf`

  // BufferをUint8Arrayに変換
  const uint8Array = new Uint8Array(pdfBuffer)

  return new Response(uint8Array, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
