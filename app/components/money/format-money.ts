/**
 * 数値を3桁区切りカンマでフォーマットする
 * formatMoney(10000) => "10,000"
 * formatMoney(0) => "0"
 * formatMoney(NaN) => ""
 */
export function formatMoney(value: number): string {
  if (Number.isNaN(value)) return ''
  return value.toLocaleString('ja-JP')
}
