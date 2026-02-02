export type FreeeClient = {
  getCompanies: () => Promise<{
    companies: Array<{
      id: number
      name: string
      display_name: string
      role: string
    }>
  }>
  getPartners: (companyId: number) => Promise<{
    partners: Array<{
      id: number
      name: string
      code: string | null
    }>
  }>
  getInvoices: (
    companyId: number,
    params?: { limit?: number; offset?: number; partner_ids?: string },
  ) => Promise<{
    invoices: Array<{
      id: number
      company_id: number
      invoice_number: string
      billing_date: string
      payment_date: string | null
      total_amount: number
      sending_status: string
      payment_status: string
      partner_id: number
      partner_name: string
      subject: string | null
    }>
  }>
  getInvoice: (
    companyId: number,
    invoiceId: number,
  ) => Promise<{
    invoice: {
      id: number
      company_id: number
      invoice_number: string
      billing_date: string
      payment_date: string | null
      total_amount: number
      amount_excluding_tax: number
      amount_tax: number
      sending_status: string
      payment_status: string
      partner_id: number
      partner_name: string
      partner_display_name: string
      partner_title: string
      subject: string | null
      invoice_note: string | null
      memo: string | null
      tax_entry_method: string
      withholding_tax_entry_method: string | null
      lines: Array<{
        type: string
        description: string
        quantity: number
        unit: string
        unit_price: string
        amount_excluding_tax: number
        tax_rate: number
        reduced_tax_rate: boolean
        withholding: boolean
      }>
    }
  }>
  getInvoiceTemplates: (companyId: number) => Promise<{
    templates: Array<{
      id: number
      name: string
    }>
  }>
  createInvoice: (params: CreateInvoiceParams) => Promise<{
    invoice: {
      id: number
      invoice_number: string
      total_amount: number
      amount_tax: number
      sending_status: string
    }
  }>
  updateInvoice: (
    invoiceId: number,
    params: CreateInvoiceParams,
  ) => Promise<{
    invoice: {
      id: number
      invoice_number: string
      total_amount: number
      amount_tax: number
      sending_status: string
    }
  }>
  getInvoicePdf: (companyId: number, invoiceId: number) => Promise<ArrayBuffer>
}

const FREEE_API_BASE = 'https://api.freee.co.jp'
const FREEE_IV_API_BASE = 'https://api.freee.co.jp/iv'

export interface CreateInvoiceParams {
  company_id: number
  template_id?: number
  billing_date: string // YYYY-MM-DD
  payment_date?: string // YYYY-MM-DD
  partner_id: number
  partner_title: '御中' | '様' | '(空白)'
  subject?: string
  invoice_note?: string
  memo?: string
  tax_entry_method: 'in' | 'out' // in: 内税, out: 外税
  tax_fraction: 'omit' | 'round' | 'round_up' // omit: 切り捨て, round: 四捨五入, round_up: 切り上げ
  withholding_tax_entry_method: 'in' | 'out' // in: 税込から計算, out: 税抜から計算
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

type RequestDeps = {
  getAccessToken: () => string
}

async function request<T>(
  url: string,
  deps: RequestDeps,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${deps.getAccessToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `API Error: ${response.status} ${response.statusText}\n${errorBody}`,
    )
  }

  return response.json() as Promise<T>
}

export function createFreeeClient(deps: RequestDeps): FreeeClient {
  return {
    getCompanies: () => request(`${FREEE_API_BASE}/api/1/companies`, deps),
    getPartners: (companyId: number) =>
      request(`${FREEE_API_BASE}/api/1/partners?company_id=${companyId}`, deps),
    getInvoices: (
      companyId: number,
      params?: { limit?: number; offset?: number; partner_ids?: string },
    ) => {
      const searchParams = new URLSearchParams({
        company_id: String(companyId),
      })
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))
      if (params?.partner_ids)
        searchParams.set('partner_ids', params.partner_ids)

      return request(`${FREEE_IV_API_BASE}/invoices?${searchParams}`, deps)
    },
    getInvoice: (companyId: number, invoiceId: number) =>
      request(
        `${FREEE_IV_API_BASE}/invoices/${invoiceId}?company_id=${companyId}`,
        deps,
      ),
    getInvoiceTemplates: (companyId: number) =>
      request(
        `${FREEE_IV_API_BASE}/invoices/templates?company_id=${companyId}`,
        deps,
      ),
    createInvoice: (params: CreateInvoiceParams) =>
      request(`${FREEE_IV_API_BASE}/invoices`, deps, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    updateInvoice: (invoiceId: number, params: CreateInvoiceParams) =>
      request(`${FREEE_IV_API_BASE}/invoices/${invoiceId}`, deps, {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    getInvoicePdf: async (companyId: number, invoiceId: number) => {
      const response = await fetch(
        `${FREEE_IV_API_BASE}/invoices/${invoiceId}.pdf?company_id=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${deps.getAccessToken()}`,
            Accept: 'application/pdf',
          },
        },
      )

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(
          `API Error: ${response.status} ${response.statusText}\n${errorBody}`,
        )
      }

      return response.arrayBuffer()
    },
  }
}
