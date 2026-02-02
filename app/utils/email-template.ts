export function buildInvoiceEmail({
  clientName,
  year,
  month,
}: {
  clientName: string
  year: number
  month: number
}) {
  const subject = `【請求書】${year}年${month}月分 ${clientName}`
  const body = [
    `${clientName} ご担当者様`,
    '',
    'いつもお世話になっております。',
    `${year}年${month}月分の請求書をお送りします。`,
    '添付のPDFをご確認ください。',
    '',
    '何卒よろしくお願いいたします。',
    '',
  ].join('\n')

  return { subject, body }
}
