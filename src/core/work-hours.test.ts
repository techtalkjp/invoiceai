import { describe, expect, it } from 'vitest'
import { parsePatternA, parsePatternB } from './work-hours'

describe('parsePatternA', () => {
  it('extracts total hours from header row', () => {
    const data = [
      ['タイトル', '稼働合計 12.5 時間'],
      [],
      [],
      [],
      ['2025-01-01', '', '', '', '', '2.5', '作業A'],
      ['2025-01-02', '', '', '', '', '3', '作業B'],
    ]

    const result = parsePatternA(data)
    expect(result.totalHours).toBe(12.5)
    expect(result.entries.length).toBe(2)
  })

  it('calculates total from entries when header total is missing', () => {
    const data = [
      ['タイトル'],
      [],
      [],
      [],
      ['2025-01-01', '', '', '', '', '2', '作業A'],
      ['2025-01-02', '', '', '', '', '3.5', '作業B'],
    ]

    const result = parsePatternA(data)
    expect(result.totalHours).toBe(5.5)
  })
})

describe('parsePatternB', () => {
  it('extracts total hours from total row', () => {
    const data = [
      ['日付', '', '', '', '', ''],
      [],
      [],
      [],
      ['2025-01-01', '', '', '', '', '4', '作業A'],
      ['2025-01-02', '', '', '', '', '3', '作業B'],
      ['', '', '', '', '合計', '7'],
    ]

    const result = parsePatternB(data)
    expect(result.totalHours).toBe(7)
    expect(result.entries.length).toBe(2)
  })

  it('calculates total when total row is missing', () => {
    const data = [
      ['日付', '', '', '', '', ''],
      [],
      [],
      [],
      ['2025-01-01', '', '', '', '', '4', '作業A'],
      ['2025-01-02', '', '', '', '', '3', '作業B'],
    ]

    const result = parsePatternB(data)
    expect(result.totalHours).toBe(7)
  })
})
