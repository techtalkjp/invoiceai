import { describe, expect, it } from 'vitest'
import type { Client } from '../clients'
import {
  generateSubject,
  getBillingDate,
  getMonthSheetName,
  getPaymentDate,
} from './invoice-utils'

const sampleClient: Client = {
  id: 'sample',
  name: 'Sample',
  freeePartnerName: 'Sample Inc.',
  freeePartnerId: 1,
  hourlyRate: 1000,
  hasWorkDescription: true,
  invoiceSubjectTemplate: '案件 {year}-{month}',
  invoiceNote: '',
}

describe('invoice utils', () => {
  it('generates subject from template', () => {
    const subject = generateSubject(sampleClient, 2025, 1)
    expect(subject).toBe('案件 2025-1')
  })

  it('calculates billing date as month end', () => {
    expect(getBillingDate(2025, 2)).toBe('2025-02-28')
    expect(getBillingDate(2024, 2)).toBe('2024-02-29')
  })

  it('calculates payment date as next month end', () => {
    expect(getPaymentDate(2025, 1)).toBe('2025-02-28')
    expect(getPaymentDate(2025, 12)).toBe('2026-01-31')
  })

  it('formats month sheet name', () => {
    expect(getMonthSheetName(2025, 1)).toBe('2025-01')
  })
})
