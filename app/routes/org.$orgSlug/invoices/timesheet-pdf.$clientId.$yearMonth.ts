import { renderToBuffer } from '@react-pdf/renderer'
import {
  TimesheetPdfDocument,
  buildTimesheetPdfData,
} from '~/components/timesheet/timesheet-pdf'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { parseYearMonthId } from '~/utils/month'
import { registerPdfFontServer } from './+pdf/register-font.server'
import { getTimesheetDataForPdf } from './+queries.server'
import type { Route } from './+types/timesheet-pdf.$clientId.$yearMonth'

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

  // PDF用データに変換
  const timesheets = buildTimesheetPdfData({
    ...data,
    organizationName: organization.name,
    year,
    month,
  })

  // PDF生成
  registerPdfFontServer()
  const pdfBuffer = await renderToBuffer(TimesheetPdfDocument({ timesheets }))

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
