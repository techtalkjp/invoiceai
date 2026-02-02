import {
  generateSubject,
  getBillingDate,
  getPaymentDate,
  type PaymentTerms,
} from '../core/invoice-utils'

/**
 * 請求書作成に必要なクライアント情報
 */
export type InvoiceClient = {
  freeePartnerId: number
  invoiceSubjectTemplate: string
  invoiceNote: string
  billingType: 'time' | 'fixed'
  // 時間制用
  hourlyRate?: number
  // 固定月額用
  monthlyFee?: number
  unitLabel?: string
  // 支払条件
  paymentTerms?: PaymentTerms
}

/**
 * 前月請求書の情報（設定引き継ぎ用）
 */
export type PreviousInvoice = {
  subject: string | null
  invoice_note: string | null
  memo: string | null
  tax_entry_method: string
  partner_title: string
  withholding_tax_entry_method: string | null
}

/**
 * 請求書 API パラメータの型
 */
export type InvoiceApiParams = {
  company_id: number
  template_id?: number
  billing_date: string
  payment_date?: string
  partner_id: number
  partner_title: '御中' | '様' | '(空白)'
  subject?: string
  invoice_note?: string
  memo?: string
  tax_entry_method: 'in' | 'out' // in: 内税, out: 外税
  tax_fraction: 'omit' | 'round' | 'round_up' // omit: 切り捨て, round: 四捨五入, round_up: 切り上げ
  withholding_tax_entry_method: 'in' | 'out' // in: 税込から計算, out: 税抜から計算（必須）
  lines: Array<{
    type?: 'item' | 'text' // item: 品目行, text: テキスト行
    description: string
    quantity?: string
    unit?: string
    unit_price?: string
    tax_rate?: number
    reduced_tax_rate?: boolean
    withholding?: boolean
  }>
}

export type InvoiceApiResult = {
  invoice: {
    id: number
    invoice_number: string
    total_amount: number
    amount_tax: number
    sending_status: string
  }
}

export type InvoiceDeps = {
  getCompanyId: () => number
  getTemplateId: () => number
  getTotalHours: () => number
  getPreviousInvoice: () => Promise<PreviousInvoice | null>
  createInvoice: (params: InvoiceApiParams) => Promise<InvoiceApiResult>
  getInvoicePdf?: (companyId: number, invoiceId: number) => Promise<ArrayBuffer>
}

export type UpdateInvoiceDeps = InvoiceDeps & {
  updateInvoice: (
    invoiceId: number,
    params: InvoiceApiParams,
  ) => Promise<InvoiceApiResult>
}

export type CreateInvoiceResult = {
  totalHours: number
  amount: number
  invoice?: {
    id: number
    number: string
    totalAmount: number
    amountTax: number
    sendingStatus: string
  }
  invoicePdf?: Uint8Array | undefined
}

/**
 * 請求明細行を生成
 */
function buildInvoiceLine(
  client: InvoiceClient,
  year: number,
  month: number,
  totalHours: number,
) {
  const subject = generateSubject(client, year, month)

  if (client.billingType === 'fixed') {
    return {
      type: 'item' as const,
      description: `${subject}分`,
      quantity: '1',
      unit: client.unitLabel ?? '式',
      unit_price: String(client.monthlyFee ?? 0),
      tax_rate: 10,
      reduced_tax_rate: false,
      withholding: false,
    }
  }

  // 時間制
  return {
    type: 'item' as const,
    description: `${subject}分`,
    quantity: String(totalHours),
    unit: '時間',
    unit_price: String(client.hourlyRate ?? 0),
    tax_rate: 10,
    reduced_tax_rate: false,
    withholding: false,
  }
}

/**
 * 請求金額を計算
 */
function calculateAmount(client: InvoiceClient, totalHours: number): number {
  if (client.billingType === 'fixed') {
    return client.monthlyFee ?? 0
  }
  return totalHours * (client.hourlyRate ?? 0)
}

/**
 * 請求書 API パラメータを構築
 */
async function buildInvoiceParams(
  client: InvoiceClient,
  year: number,
  month: number,
  deps: Pick<
    InvoiceDeps,
    'getCompanyId' | 'getTemplateId' | 'getTotalHours' | 'getPreviousInvoice'
  >,
): Promise<{ params: InvoiceApiParams; totalHours: number; amount: number }> {
  const totalHours = deps.getTotalHours()
  const amount = calculateAmount(client, totalHours)
  const companyId = deps.getCompanyId()
  const templateId = deps.getTemplateId()

  // 前月請求書から設定を引き継ぐ
  const previousInvoice = await deps.getPreviousInvoice()

  // subject: 前月請求書があればそのパターンを参考にしつつ年月を更新
  // ただし実際は generateSubject で新しい年月に置き換える
  const subject = generateSubject(client, year, month)

  // invoice_note と memo は前月から引き継ぐ（なければクライアント設定を使用）
  // 空文字列だと freee API がエラーになるので、値がある場合のみ設定
  const invoiceNote =
    previousInvoice?.invoice_note || client.invoiceNote || undefined
  const memo = previousInvoice?.memo || undefined

  // tax_entry_method は前月から引き継ぐ（なければデフォルト: out=外税）
  const taxEntryMethod =
    (previousInvoice?.tax_entry_method as 'in' | 'out') ?? 'out'

  // partner_title は前月から引き継ぐ（なければデフォルト）
  // API レスポンスでは全角カッコの場合もあるので正規化
  const rawPartnerTitle = previousInvoice?.partner_title ?? '御中'
  const partnerTitle: '御中' | '様' | '(空白)' =
    rawPartnerTitle === '御中' || rawPartnerTitle === '様'
      ? rawPartnerTitle
      : '(空白)' // （空白）や (空白) はすべて半角に統一

  // withholding_tax_entry_method は前月から引き継ぐ（なければデフォルト: out=税抜から計算）
  const withholdingTaxEntryMethod: 'in' | 'out' =
    previousInvoice?.withholding_tax_entry_method === 'in' ||
    previousInvoice?.withholding_tax_entry_method === 'out'
      ? previousInvoice.withholding_tax_entry_method
      : 'out'

  const params: InvoiceApiParams = {
    company_id: companyId,
    template_id: templateId,
    billing_date: getBillingDate(year, month),
    payment_date: getPaymentDate(year, month, client.paymentTerms),
    partner_id: client.freeePartnerId,
    partner_title: partnerTitle,
    ...(subject && { subject }),
    ...(invoiceNote && { invoice_note: invoiceNote }),
    ...(memo && { memo }),
    tax_entry_method: taxEntryMethod,
    tax_fraction: 'omit' as const,
    withholding_tax_entry_method: withholdingTaxEntryMethod,
    lines: [buildInvoiceLine(client, year, month, totalHours)],
  }

  return { params, totalHours, amount }
}

/**
 * 請求書を作成
 */
export async function createClientInvoice(
  client: InvoiceClient,
  year: number,
  month: number,
  deps: InvoiceDeps,
): Promise<CreateInvoiceResult> {
  const { params, totalHours, amount } = await buildInvoiceParams(
    client,
    year,
    month,
    deps,
  )
  const companyId = deps.getCompanyId()

  const result = await deps.createInvoice(params)
  const invoicePdf = deps.getInvoicePdf
    ? await deps.getInvoicePdf(companyId, result.invoice.id)
    : undefined

  return {
    totalHours,
    amount,
    invoice: {
      id: result.invoice.id,
      number: result.invoice.invoice_number,
      totalAmount: result.invoice.total_amount,
      amountTax: result.invoice.amount_tax,
      sendingStatus: result.invoice.sending_status,
    },
    invoicePdf: invoicePdf ? new Uint8Array(invoicePdf) : undefined,
  }
}

/**
 * 請求書を更新
 */
export async function updateClientInvoice(
  invoiceId: number,
  client: InvoiceClient,
  year: number,
  month: number,
  deps: UpdateInvoiceDeps,
): Promise<CreateInvoiceResult> {
  const { params, totalHours, amount } = await buildInvoiceParams(
    client,
    year,
    month,
    deps,
  )
  const companyId = deps.getCompanyId()

  const result = await deps.updateInvoice(invoiceId, params)
  const invoicePdf = deps.getInvoicePdf
    ? await deps.getInvoicePdf(companyId, result.invoice.id)
    : undefined

  return {
    totalHours,
    amount,
    invoice: {
      id: result.invoice.id,
      number: result.invoice.invoice_number,
      totalAmount: result.invoice.total_amount,
      amountTax: result.invoice.amount_tax,
      sendingStatus: result.invoice.sending_status,
    },
    invoicePdf: invoicePdf ? new Uint8Array(invoicePdf) : undefined,
  }
}
