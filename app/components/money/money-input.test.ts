import { describe, expect, test } from 'vitest'
import { clampMoney, parseMoneyInput } from './money-input'

describe('parseMoneyInput', () => {
  test('プレーン数値', () => {
    expect(parseMoneyInput('0')).toBe(0)
    expect(parseMoneyInput('100')).toBe(100)
    expect(parseMoneyInput('10000')).toBe(10000)
  })

  test('カンマ付き数値', () => {
    expect(parseMoneyInput('10,000')).toBe(10000)
    expect(parseMoneyInput('1,000,000')).toBe(1000000)
  })

  test('k/K ショートカット（千）', () => {
    expect(parseMoneyInput('10k')).toBe(10000)
    expect(parseMoneyInput('10K')).toBe(10000)
    expect(parseMoneyInput('1.5k')).toBe(1500)
    expect(parseMoneyInput('100k')).toBe(100000)
  })

  test('m/M ショートカット（百万）', () => {
    expect(parseMoneyInput('1m')).toBe(1000000)
    expect(parseMoneyInput('1M')).toBe(1000000)
    expect(parseMoneyInput('1.5m')).toBe(1500000)
  })

  test('¥記号付き', () => {
    expect(parseMoneyInput('¥10000')).toBe(10000)
    expect(parseMoneyInput('￥10,000')).toBe(10000)
  })

  test('全角数字', () => {
    expect(parseMoneyInput('１０，０００')).toBe(10000)
    expect(parseMoneyInput('１０ｋ')).toBe(null) // 全角k は非対応
  })

  test('空白を含む入力', () => {
    expect(parseMoneyInput(' 10000 ')).toBe(10000)
    expect(parseMoneyInput('10 000')).toBe(10000)
  })

  test('空文字・無効な入力は null', () => {
    expect(parseMoneyInput('')).toBe(null)
    expect(parseMoneyInput('   ')).toBe(null)
    expect(parseMoneyInput('abc')).toBe(null)
    expect(parseMoneyInput('hello')).toBe(null)
  })

  test('小数は丸める', () => {
    expect(parseMoneyInput('10000.7')).toBe(10001)
    expect(parseMoneyInput('10000.3')).toBe(10000)
  })

  test('負数', () => {
    expect(parseMoneyInput('-1000')).toBe(-1000)
    expect(parseMoneyInput('-1.5k')).toBe(-1500)
  })
})

describe('clampMoney', () => {
  test('範囲内の値はそのまま', () => {
    expect(clampMoney(5000, 0, 10000)).toBe(5000)
  })

  test('min 以下は min に制限', () => {
    expect(clampMoney(-100, 0)).toBe(0)
  })

  test('max 以上は max に制限', () => {
    expect(clampMoney(20000, 0, 10000)).toBe(10000)
  })

  test('制限なしの場合はそのまま', () => {
    expect(clampMoney(99999)).toBe(99999)
    expect(clampMoney(-100)).toBe(-100)
  })
})
