// タイムチャージ型クライアント設定

export interface Client {
  id: string
  name: string
  freeePartnerName: string
  freeePartnerId: number
  hourlyRate: number
  hasWorkDescription: boolean
  invoiceSubjectTemplate: string
  invoiceNote: string
  // 追加明細（ダイヤゴムのサーバ費など）
  additionalItems?: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
  }>
}

export const clients: Client[] = [
  {
    id: 'diya-gomu',
    name: 'ダイヤゴム',
    freeePartnerName: 'ダイヤゴム株式会社',
    freeePartnerId: 34342747,
    hourlyRate: 20000,
    hasWorkDescription: true,
    invoiceSubjectTemplate: 'ホゴスルシステム開発・保守 {year}年{month}月',
    invoiceNote: `* 当月末締翌月末払。
* 振込手数料はご負担ください。
* 出張旅費等は実費精算させていただきます。`,
    // サーバ費などは手動で追加が必要な場合あり
  },
  {
    id: 'activecore',
    name: 'ActiveCore',
    freeePartnerName: '株式会社アクティブコア',
    freeePartnerId: 61507692,
    hourlyRate: 10000,
    hasWorkDescription: false,
    invoiceSubjectTemplate: 'LLM関連サービス企画開発業務 {year}年{month}月',
    invoiceNote: `* 当月末締翌月末払。
* 振込手数料はご負担ください。
* 出張旅費等は実費精算させていただきます。`,
  },
  {
    id: 'toreca',
    name: '日本トレカセンター',
    freeePartnerName: '株式会社日本トレカセンター',
    freeePartnerId: 105735748,
    hourlyRate: 15000,
    hasWorkDescription: true,
    invoiceSubjectTemplate: '業務委託費用 {year}年{month}月分',
    invoiceNote: `* 当月末締翌月末払。
* 振込手数料はご負担ください。
* 出張旅費等は実費精算させていただきます。`,
  },
  {
    id: 'ibm-mosa',
    name: 'IBM (MOSA)',
    freeePartnerName: 'MOSAアーキテクト株式会社',
    freeePartnerId: 105735815,
    hourlyRate: 24000,
    hasWorkDescription: true,
    invoiceSubjectTemplate: 'システム構築支援{year}年{month}月分',
    invoiceNote: `* 毎月末日締翌々月１日現金払い
* 振込手数料はご負担ください。
* 出張旅費等は実費精算させていただきます。`,
  },
]

export function getClient(id: string): Client | undefined {
  return clients.find((c) => c.id === id)
}

export function getClientByPartnerName(name: string): Client | undefined {
  return clients.find((c) => c.freeePartnerName === name)
}
