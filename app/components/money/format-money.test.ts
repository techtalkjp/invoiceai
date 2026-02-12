import { describe, expect, test } from 'vitest'
import { formatMoney } from './format-money'

describe('formatMoney', () => {
  test('3桁区切りカンマでフォーマット', () => {
    expect(formatMoney(0)).toBe('0')
    expect(formatMoney(100)).toBe('100')
    expect(formatMoney(1000)).toBe('1,000')
    expect(formatMoney(10000)).toBe('10,000')
    expect(formatMoney(100000)).toBe('100,000')
    expect(formatMoney(1000000)).toBe('1,000,000')
  })

  test('NaN は空文字を返す', () => {
    expect(formatMoney(Number.NaN)).toBe('')
  })

  test('負数もフォーマット', () => {
    expect(formatMoney(-1000)).toBe('-1,000')
  })
})
