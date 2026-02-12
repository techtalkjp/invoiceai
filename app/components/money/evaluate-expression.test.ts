import { describe, expect, test } from 'vitest'
import { evaluateExpression } from './evaluate-expression'

describe('evaluateExpression', () => {
  test('基本的な四則演算', () => {
    expect(evaluateExpression('1+2')).toBe(3)
    expect(evaluateExpression('10-3')).toBe(7)
    expect(evaluateExpression('5*3')).toBe(15)
    expect(evaluateExpression('10/3')).toBe(3)
  })

  test('演算子の優先順位', () => {
    expect(evaluateExpression('2+3*4')).toBe(14)
    expect(evaluateExpression('10-2*3')).toBe(4)
    expect(evaluateExpression('2*3+4*5')).toBe(26)
  })

  test('括弧', () => {
    expect(evaluateExpression('(2+3)*4')).toBe(20)
    expect(evaluateExpression('(1000+500)*2')).toBe(3000)
    expect(evaluateExpression('((2+3))*4')).toBe(20)
  })

  test('金額スタイルの入力', () => {
    expect(evaluateExpression('5000*3+500')).toBe(15500)
    expect(evaluateExpression('10,000*3')).toBe(30000)
    expect(evaluateExpression('¥5000+¥3000')).toBe(8000)
  })

  test('単項マイナス', () => {
    expect(evaluateExpression('-100+200')).toBe(100)
    expect(evaluateExpression('-(100+200)')).toBe(-300)
  })

  test('ゼロ除算は null', () => {
    expect(evaluateExpression('100/0')).toBe(null)
  })

  test('無効な入力は null', () => {
    expect(evaluateExpression('')).toBe(null)
    expect(evaluateExpression('abc')).toBe(null)
    expect(evaluateExpression('1++2')).toBe(null)
    expect(evaluateExpression('(1+2')).toBe(null)
    expect(evaluateExpression('1+2)')).toBe(null)
  })

  test('空白を含む入力', () => {
    expect(evaluateExpression(' 100 + 200 ')).toBe(300)
  })

  test('全角数字', () => {
    expect(evaluateExpression('１０００+２０００')).toBe(3000)
  })

  test('小数は丸める', () => {
    expect(evaluateExpression('10000/3')).toBe(3333)
    expect(evaluateExpression('100*1.5')).toBe(150)
  })

  test('単一の数値', () => {
    expect(evaluateExpression('42')).toBe(42)
    expect(evaluateExpression('10,000')).toBe(10000)
  })
})
