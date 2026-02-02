import { describe, expect, it } from 'vitest'
import type { InvoiceClient } from './invoice-service'
import { createClientInvoice } from './invoice-service'

const client: InvoiceClient = {
  freeePartnerId: 10,
  invoiceSubjectTemplate: '案件 {year}-{month}',
  invoiceNote: 'note',
  billingType: 'time',
  hourlyRate: 2000,
}

describe('createClientInvoice', () => {
  it('creates invoice with correct amount for time billing', async () => {
    const deps = {
      getCompanyId: () => 1,
      getTemplateId: () => 2,
      getTotalHours: () => 3,
      getPreviousInvoice: async () => null,
      createInvoice: async () => ({
        invoice: {
          id: 99,
          invoice_number: 'INV-99',
          total_amount: 6600,
          amount_tax: 600,
          sending_status: 'unsent',
        },
      }),
      getInvoicePdf: async () => new ArrayBuffer(0),
    }

    const result = await createClientInvoice(client, 2025, 1, deps)

    expect(result.amount).toBe(6000)
    expect(result.invoice?.number).toBe('INV-99')
  })

  it('calculates fixed billing correctly', async () => {
    const fixedClient: InvoiceClient = {
      freeePartnerId: 10,
      invoiceSubjectTemplate: '月額費用 {year}-{month}',
      invoiceNote: 'note',
      billingType: 'fixed',
      monthlyFee: 100000,
      unitLabel: '式',
    }

    const deps = {
      getCompanyId: () => 1,
      getTemplateId: () => 2,
      getTotalHours: () => 0, // 固定の場合は稼働時間関係なし
      getPreviousInvoice: async () => null,
      createInvoice: async () => ({
        invoice: {
          id: 100,
          invoice_number: 'INV-100',
          total_amount: 110000,
          amount_tax: 10000,
          sending_status: 'unsent',
        },
      }),
      getInvoicePdf: async () => new ArrayBuffer(0),
    }

    const result = await createClientInvoice(fixedClient, 2025, 1, deps)

    expect(result.amount).toBe(100000)
    expect(result.totalHours).toBe(0)
    expect(result.invoice?.number).toBe('INV-100')
  })
})
