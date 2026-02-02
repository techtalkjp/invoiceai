export type WorkEntry = {
  date: string
  hours: number
  description?: string
}

export type WorkHoursResult = {
  totalHours: number
  entries: WorkEntry[]
}

// パターンAの稼働時間を取得（ダイヤゴム、日本トレカセンター）
// 行1: タイトル + 稼働合計 XX 時間
export function parsePatternA(data: string[][]): WorkHoursResult {
  // 行1から合計時間を取得
  const row1 = data[0] || []
  let totalHours = 0

  // "稼働合計" を含むセルを探す
  for (const cell of row1) {
    const match = cell?.match(/稼働合計\s*([\d.]+)\s*時間/)
    const total = match?.[1]
    if (total) {
      totalHours = parseFloat(total)
      break
    }
  }

  // 明細を取得（行5以降、パターンAはデータ行が5行目から）
  const entries: WorkEntry[] = []
  for (let i = 4; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[0]) continue

    const date = row[0] // A列: 日付
    const hours = parseFloat(row[5] ?? '0') || 0 // F列: 稼働
    const description = row[6] // G列: 作業内容

    if (date && hours > 0) {
      if (description) {
        entries.push({ date, hours, description })
      } else {
        entries.push({ date, hours })
      }
    }
  }

  // 合計が見つからなかった場合、エントリから計算
  if (totalHours === 0 && entries.length > 0) {
    totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  }

  return { totalHours, entries }
}

// パターンBの稼働時間を取得（ActiveCore、IBM）
// 合計は下部にある
export function parsePatternB(data: string[][]): WorkHoursResult {
  let totalHours = 0

  // 合計行を探す
  for (const row of data) {
    if (row && row[4] === '合計') {
      totalHours = parseFloat(row[5] ?? '0') || 0
      break
    }
  }

  // データ行を取得（行5以降）
  const entries: WorkEntry[] = []
  for (let i = 4; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[0]) continue
    if (row[4] === '合計') break // 合計行で終了

    const date = row[0] // A列: 日付
    const hours = parseFloat(row[5] ?? '0') || 0 // F列: 稼働時間
    const description = row[6] // G列: 作業内容（ある場合）

    if (date && hours > 0) {
      if (description) {
        entries.push({ date, hours, description })
      } else {
        entries.push({ date, hours })
      }
    }
  }

  // 合計が見つからなかった場合、エントリから計算
  if (totalHours === 0) {
    totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  }

  return { totalHours, entries }
}
