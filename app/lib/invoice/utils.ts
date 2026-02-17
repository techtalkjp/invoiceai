// 請求書件名を生成
export function generateSubject(
  client: { invoiceSubjectTemplate: string },
  year: number,
  month: number,
): string {
  return client.invoiceSubjectTemplate
    .replace('{year}', String(year))
    .replace('{month}', String(month))
}

// 請求日を計算（月末）
export function getBillingDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

// 支払条件タイプ
export type PaymentTerms =
  | 'next_month_end' // 翌月末払い
  | 'next_next_month_1st' // 翌々月1日払い
  | 'next_next_month_end' // 翌々月末払い

// 支払期日を計算
export function getPaymentDate(
  year: number,
  month: number,
  paymentTerms: PaymentTerms = 'next_month_end',
): string {
  let payYear = year
  let payMonth = month

  switch (paymentTerms) {
    case 'next_month_end': {
      // 翌月末
      payMonth += 1
      if (payMonth > 12) {
        payMonth = 1
        payYear++
      }
      const lastDay = new Date(payYear, payMonth, 0).getDate()
      return `${payYear}-${String(payMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
    case 'next_next_month_1st': {
      // 翌々月1日
      payMonth += 2
      if (payMonth > 12) {
        payMonth -= 12
        payYear++
      }
      return `${payYear}-${String(payMonth).padStart(2, '0')}-01`
    }
    case 'next_next_month_end': {
      // 翌々月末
      payMonth += 2
      if (payMonth > 12) {
        payMonth -= 12
        payYear++
      }
      const lastDay = new Date(payYear, payMonth, 0).getDate()
      return `${payYear}-${String(payMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
  }
}

export function getMonthSheetName(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
