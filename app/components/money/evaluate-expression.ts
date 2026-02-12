/**
 * 安全な四則演算パーサー（再帰下降構文解析）
 *
 * eval() を使わず、四則演算 + 括弧を安全に評価する。
 * カンマ・¥記号・全角数字は前処理で正規化。
 * 結果は Math.round() で整数化（金額ドメイン）。
 *
 * evaluateExpression("5000*3+500")   => 15500
 * evaluateExpression("(1000+500)*2") => 3000
 * evaluateExpression("10,000*3")     => 30000
 * evaluateExpression("abc")          => null
 */
export function evaluateExpression(input: string): number | null {
  let s = input.replace(/[\s,¥￥]/g, '')
  s = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
  s = s.replace(/，/g, '').replace(/．/g, '.')

  if (s === '') return null
  if (/[^0-9+\-*/().]/.test(s)) return null

  let pos = 0

  function peek(): string {
    return s[pos] ?? ''
  }

  function consume(): string {
    return s[pos++] ?? ''
  }

  function parseExpr(): number | null {
    let left = parseTerm()
    if (left === null) return null
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const right = parseFactor()
      if (right === null) return null
      if (op === '/') {
        if (right === 0) return null
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  function parseFactor(): number | null {
    if (peek() === '-') {
      consume()
      const val = parseFactor()
      return val === null ? null : -val
    }
    if (peek() === '(') {
      consume()
      const val = parseExpr()
      if (val === null || peek() !== ')') return null
      consume()
      return val
    }
    return parseNumber()
  }

  function parseNumber(): number | null {
    const start = pos
    while (/[0-9.]/.test(peek())) consume()
    if (pos === start) return null
    const num = Number(s.slice(start, pos))
    return Number.isNaN(num) ? null : num
  }

  const result = parseExpr()
  if (pos !== s.length) return null
  if (result === null || !Number.isFinite(result)) return null
  return Math.round(result)
}
