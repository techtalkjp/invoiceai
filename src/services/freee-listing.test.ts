import { describe, expect, it } from 'vitest'
import { listInvoices } from './freee-listing'

describe('listInvoices', () => {
  it('paginates, sorts by billing_date desc, and limits results', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      company_id: 1,
      invoice_number: `INV-${i + 1}`,
      billing_date:
        i === 0 ? '2025-01-01' : i === 1 ? '2025-02-01' : '2024-12-01',
      payment_date: null,
      total_amount: 1000,
      sending_status: 'unsent',
      payment_status: 'unpaid',
      partner_id: 1,
      partner_name: 'Partner A',
      subject: null,
    }))

    const deps = {
      getCompanies: async () => ({ companies: [] }),
      getPartners: async () => ({ partners: [] }),
      getInvoiceTemplates: async () => ({ templates: [] }),
      getInvoice: async () => ({
        invoice: {
          id: 1,
          company_id: 1,
          invoice_number: 'INV-1',
          billing_date: '2025-01-01',
          payment_date: null,
          total_amount: 1000,
          amount_excluding_tax: 1000,
          amount_tax: 0,
          sending_status: 'unsent',
          payment_status: 'unpaid',
          partner_id: 1,
          partner_name: 'Partner',
          partner_display_name: 'Partner',
          partner_title: '御中',
          subject: null,
          invoice_note: null,
          memo: null,
          tax_entry_method: 'out',
          lines: [],
        },
      }),
      // biome-ignore lint/suspicious/useAwait: returns Promise implicitly
      getInvoices: async (
        _companyId: number,
        params?: { limit?: number; offset?: number },
      ) => {
        const offset = params?.offset ?? 0
        if (offset === 0) {
          return {
            invoices: firstPage,
          }
        }
        return {
          invoices: [
            {
              id: 101,
              company_id: 1,
              invoice_number: 'INV-101',
              billing_date: '2024-12-31',
              payment_date: null,
              total_amount: 3000,
              sending_status: 'sent',
              payment_status: 'paid',
              partner_id: 3,
              partner_name: 'Partner C',
              subject: 'S3',
            },
          ],
        }
      },
    }

    const { display, total } = await listInvoices(deps, 1, 2)
    expect(total).toBe(101)
    expect(display.map((i) => i.invoice_number)).toEqual(['INV-2', 'INV-1'])
  })
})
