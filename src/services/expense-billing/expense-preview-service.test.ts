import { describe, expect, it } from 'vitest'
import { applyRounding } from './expense-preview-service'

describe('applyRounding', () => {
  it('rounds USD amount with exchange rate (round)', () => {
    // $45.00 * 149.53 = 6728.85 → 6729
    expect(applyRounding('45.00', '149.53', 'round')).toBe(6729)
  })

  it('floors USD amount with exchange rate (floor)', () => {
    // $45.00 * 149.53 = 6728.85 → 6728
    expect(applyRounding('45.00', '149.53', 'floor')).toBe(6728)
  })

  it('ceils USD amount with exchange rate (ceil)', () => {
    // $45.00 * 149.53 = 6728.85 → 6729
    expect(applyRounding('45.00', '149.53', 'ceil')).toBe(6729)
  })

  it('handles JPY (no exchange rate, pass-through)', () => {
    // JPY: ¥9 → 9
    expect(applyRounding('9', null, 'round')).toBe(9)
  })

  it('handles JPY decimal amounts', () => {
    // ¥9.45 → round → 9
    expect(applyRounding('9.45', null, 'round')).toBe(9)
    // ¥9.45 → ceil → 10
    expect(applyRounding('9.45', null, 'ceil')).toBe(10)
    // ¥9.45 → floor → 9
    expect(applyRounding('9.45', null, 'floor')).toBe(9)
  })

  it('handles small USD amounts', () => {
    // $0.06 * 149.53 = 8.9718 → round → 9
    expect(applyRounding('0.06', '149.53', 'round')).toBe(9)
  })

  it('handles zero amounts', () => {
    expect(applyRounding('0', '149.53', 'round')).toBe(0)
    expect(applyRounding('0', null, 'round')).toBe(0)
  })

  it('handles exact half for rounding', () => {
    // $10.00 * 100.50 = 1005.00 → exactly 1005
    expect(applyRounding('10.00', '100.50', 'round')).toBe(1005)
  })

  it('uses decimal precision (no floating point errors)', () => {
    // This would fail with naive floating point:
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    // With decimal.js: 0.3 exactly
    expect(applyRounding('0.10', '3.00', 'round')).toBe(0)
    expect(applyRounding('1.10', '3.00', 'round')).toBe(3)
  })
})
