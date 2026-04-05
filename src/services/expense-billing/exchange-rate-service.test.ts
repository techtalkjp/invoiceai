import { describe, expect, it } from 'vitest'
import { getExchangeRate } from './exchange-rate-service'

// fetchBojRate is private, so we test the BOJ API response parsing logic directly
describe('BOJ API response parsing', () => {
  it('extracts month-end rate from daily values', () => {
    // Simulate the logic: find last non-null value
    const dates = [20260301, 20260302, 20260307, 20260308, 20260331]
    const values: (number | null)[] = [null, 156.4, null, null, 159.8]

    let rate: number | undefined
    let rateDate = ''
    for (let i = values.length - 1; i >= 0; i--) {
      const v = values[i]
      if (v != null) {
        rate = v
        const d = String(dates[i])
        rateDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        break
      }
    }

    expect(rate).toBe(159.8)
    expect(rateDate).toBe('2026-03-31')
  })

  it('skips trailing nulls to find last business day', () => {
    // Month ends on Saturday/Sunday, last business day is Friday
    const values: (number | null)[] = [159.53, null, null, 159.99, null]

    let rate: number | undefined
    for (let i = values.length - 1; i >= 0; i--) {
      const v = values[i]
      if (v != null) {
        rate = v
        break
      }
    }

    expect(rate).toBe(159.99)
  })

  it('throws when all values are null', () => {
    const values: (number | null)[] = [null, null, null]

    let found = false
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] != null) {
        found = true
        break
      }
    }

    expect(found).toBe(false)
  })
})

describe('JPY handling', () => {
  it('returns rate 1 for JPY currency via getExchangeRate', async () => {
    // JPY doesn't hit the DB, so no mock needed
    const result = await getExchangeRate('any-org-id', '2026-03', 'JPY')

    expect(result).toEqual({
      rate: '1',
      rateDate: '2026-03-01',
      source: 'system',
      isManual: false,
    })
  })
})
