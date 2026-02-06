import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import {
  TimesheetPdfDocument,
  buildTimesheetPdfData,
} from '~/components/timesheet-pdf'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import { getFreeeClientForOrganization } from '~/utils/freee.server'
import { parseYearMonthId } from '~/utils/month'
import { registerPdfFontServer } from './+pdf/register-font.server'
import {
  getInvoiceByYearMonth,
  getTimesheetDataForPdf,
} from './+queries.server'
import type { Route } from './+types/invoice-pdf.$clientId.$yearMonth'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId, yearMonth } = params
  const { organization } = await requireOrgMember(request, orgSlug)

  const { year, month } = parseYearMonthId(yearMonth)

  // クライアント情報を取得
  const client = await db
    .selectFrom('client')
    .select(['name', 'freeePartnerId', 'billingType'])
    .where('organizationId', '=', organization.id)
    .where('id', '=', clientId)
    .executeTakeFirst()

  if (!client) {
    return new Response('クライアントが見つかりません', { status: 404 })
  }

  // DBから請求書情報を取得
  const invoice = await getInvoiceByYearMonth(
    organization.id,
    clientId,
    year,
    month,
  )

  if (!invoice?.freeeInvoiceId) {
    return new Response('請求書が見つかりません', { status: 404 })
  }

  // freee会社IDを取得
  const freeeCompanyId = organization.freeeCompanyId
  if (!freeeCompanyId) {
    return new Response('freee連携が設定されていません', { status: 400 })
  }

  // freee から請求書 PDF を取得
  const freee = await getFreeeClientForOrganization(organization.id)
  const invoicePdfBuffer = await freee.getInvoicePdf(
    Number(freeeCompanyId),
    Number(invoice.freeeInvoiceId),
  )

  // 時間制クライアントの場合はタイムシートも結合
  if (client.billingType === 'time') {
    const timesheetData = await getTimesheetDataForPdf(
      organization.id,
      clientId,
      year,
      month,
    )

    if (timesheetData.staffTimesheets.length > 0) {
      // PDF用データに変換
      const timesheets = buildTimesheetPdfData({
        ...timesheetData,
        organizationName: organization.name,
        year,
        month,
      })

      // タイムシート PDF を生成
      registerPdfFontServer()
      const timesheetPdfBuffer = await renderToBuffer(
        TimesheetPdfDocument({ timesheets }),
      )

      // PDF を結合
      const mergedPdf = await PDFDocument.create()

      // 請求書 PDF を追加
      const invoiceDoc = await PDFDocument.load(invoicePdfBuffer)
      const invoicePages = await mergedPdf.copyPages(
        invoiceDoc,
        invoiceDoc.getPageIndices(),
      )
      for (const page of invoicePages) {
        mergedPdf.addPage(page)
      }

      // タイムシート PDF を追加
      const timesheetDoc = await PDFDocument.load(timesheetPdfBuffer)
      const timesheetPages = await mergedPdf.copyPages(
        timesheetDoc,
        timesheetDoc.getPageIndices(),
      )
      for (const page of timesheetPages) {
        mergedPdf.addPage(page)
      }

      const mergedPdfBytes = await mergedPdf.save()

      const filename = `invoice_${client.name}_${year}${String(month).padStart(2, '0')}.pdf`

      return new Response(Buffer.from(mergedPdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      })
    }
  }

  // 固定制クライアントまたはタイムシートがない場合は請求書のみ
  const filename = `invoice_${client.name}_${year}${String(month).padStart(2, '0')}.pdf`

  return new Response(invoicePdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
