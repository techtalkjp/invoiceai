import { db } from '~/lib/db/kysely'
import { getFreeeClientForOrganization } from '~/utils/freee.server'
import type { InvoicePartner } from './+schema'

export type LatestInvoiceInfo = {
  invoiceSubjectTemplate: string | null
  invoiceNote: string | null
  partnerTitle: string | null
  taxEntryMethod: string | null
  withholdingTaxEntryMethod: string | null
  billingDate: string | null
}

export async function getClients(organizationId: string) {
  return await db
    .selectFrom('client')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('name', 'asc')
    .execute()
}

export async function getClient(organizationId: string, clientId: string) {
  return await db
    .selectFrom('client')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', clientId)
    .executeTakeFirst()
}

export async function fetchFreeePartners(
  organizationId: string,
  freeeCompanyId: number | null,
): Promise<InvoicePartner[]> {
  if (!freeeCompanyId) return []

  try {
    const freee = await getFreeeClientForOrganization(organizationId)

    // 請求書APIでページングして取得（最大500件 = 100件 x 5回）
    const allInvoices: Array<{
      partner_id: number
      partner_name: string
      billing_date: string
    }> = []

    for (let offset = 0; offset < 500; offset += 100) {
      const { invoices } = await freee.getInvoices(freeeCompanyId, {
        limit: 100,
        offset,
      })
      allInvoices.push(...invoices)
      // 取得件数が100未満なら終了
      if (invoices.length < 100) break
    }

    // 取引先ごとに最終請求日を記録
    const partnerMap = new Map<number, InvoicePartner>()
    for (const invoice of allInvoices) {
      if (!invoice.partner_id || !invoice.partner_name) continue
      const existing = partnerMap.get(invoice.partner_id)
      if (!existing || invoice.billing_date > existing.lastBillingDate) {
        partnerMap.set(invoice.partner_id, {
          id: invoice.partner_id,
          name: invoice.partner_name,
          lastBillingDate: invoice.billing_date,
        })
      }
    }

    // 最終請求日の新しい順でソート
    return Array.from(partnerMap.values()).sort((a, b) =>
      b.lastBillingDate.localeCompare(a.lastBillingDate),
    )
  } catch (error) {
    console.error('freee 取引先取得エラー:', error)
    return []
  }
}

/**
 * 最新の請求書から件名・備考などの情報を取得
 */
export async function fetchLatestInvoiceInfo(
  organizationId: string,
  freeeCompanyId: number,
  freeePartnerId: number,
): Promise<LatestInvoiceInfo | null> {
  try {
    const freee = await getFreeeClientForOrganization(organizationId)

    // 指定の取引先の請求書を取得（partner_ids はカンマ区切り文字列）
    const { invoices } = await freee.getInvoices(freeeCompanyId, {
      limit: 100,
      partner_ids: String(freeePartnerId),
    })

    if (invoices.length === 0) {
      return null
    }

    // billing_date で降順ソートして最新を取得
    const sorted = invoices.sort((a, b) =>
      b.billing_date.localeCompare(a.billing_date),
    )
    const latestInvoice = sorted[0]
    if (!latestInvoice) {
      return null
    }

    // 詳細情報を取得
    const { invoice } = await freee.getInvoice(freeeCompanyId, latestInvoice.id)

    // 件名から年月を除去してテンプレート化を試みる
    let invoiceSubjectTemplate = invoice.subject || null
    if (invoiceSubjectTemplate) {
      // 「2025年1月」「2025年01月」などのパターンを {year}年{month}月 に置換
      invoiceSubjectTemplate = invoiceSubjectTemplate.replace(
        /(\d{4})年(\d{1,2})月/,
        '{year}年{month}月',
      )
    }

    return {
      invoiceSubjectTemplate,
      invoiceNote: invoice.invoice_note || null,
      partnerTitle: invoice.partner_title || null,
      taxEntryMethod: invoice.tax_entry_method || null,
      withholdingTaxEntryMethod: invoice.withholding_tax_entry_method || null,
      billingDate: invoice.billing_date || null,
    }
  } catch (error) {
    console.error('最新請求書情報の取得に失敗:', error)
    return null
  }
}
