export type FreeeListingDeps = {
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
  getInvoiceTemplates: (companyId: number) => Promise<{
    templates: Array<{
      id: number
      name: string
    }>
  }>
  getInvoices: (
    companyId: number,
    params?: { limit?: number; offset?: number },
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
}

export function listCompanies(deps: FreeeListingDeps) {
  return deps.getCompanies()
}

export function listPartners(deps: FreeeListingDeps, companyId: number) {
  return deps.getPartners(companyId)
}

export function listTemplates(deps: FreeeListingDeps, companyId: number) {
  return deps.getInvoiceTemplates(companyId)
}

export async function listInvoices(
  deps: FreeeListingDeps,
  companyId: number,
  limit: number,
) {
  const allInvoices: Awaited<
    ReturnType<FreeeListingDeps['getInvoices']>
  >['invoices'] = []
  let offset = 0
  while (true) {
    const { invoices } = await deps.getInvoices(companyId, {
      limit: 100,
      offset,
    })
    allInvoices.push(...invoices)
    if (invoices.length < 100) break
    offset += 100
  }
  allInvoices.sort((a, b) => b.billing_date.localeCompare(a.billing_date))
  const display = allInvoices.slice(0, limit)
  return { display, total: allInvoices.length }
}

export function showInvoice(
  deps: FreeeListingDeps,
  companyId: number,
  invoiceId: number,
) {
  return deps.getInvoice(companyId, invoiceId)
}
