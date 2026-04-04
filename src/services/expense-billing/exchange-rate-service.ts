import { nanoid } from 'nanoid'
import { db } from '~/lib/db/kysely'
import { nowISO } from '~/utils/date'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExchangeRateResult = {
  rate: string
  rateDate: string
  source: 'boj' | 'manual' | 'system'
  isManual: boolean
}

type BojApiResponse = {
  STATUS: number
  MESSAGEID: string
  MESSAGE: string
  RESULTSET: Array<{
    SERIES_CODE: string
    VALUES: {
      SURVEY_DATES: number[]
      VALUES: (number | null)[]
    }
  }>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 指定年月・通貨ペアの為替レートを取得する。
 * JPY の場合はレート1を返す（換算不要）。
 * 手動設定 > キャッシュ > 日銀API の優先順位。
 */
export async function getExchangeRate(
  yearMonth: string,
  currency: string,
): Promise<ExchangeRateResult> {
  // JPY は換算不要
  if (currency === 'JPY') {
    return {
      rate: '1',
      rateDate: `${yearMonth}-01`,
      source: 'system',
      isManual: false,
    }
  }

  const currencyPair = `${currency}/JPY`

  // DB キャッシュ検索（手動優先）
  const cached = await db
    .selectFrom('exchangeRate')
    .selectAll()
    .where('yearMonth', '=', yearMonth)
    .where('currencyPair', '=', currencyPair)
    .executeTakeFirst()

  if (cached) {
    return {
      rate: cached.rate,
      rateDate: cached.rateDate,
      source: cached.isManual ? 'manual' : (cached.source as 'boj'),
      isManual: !!cached.isManual,
    }
  }

  // 日銀 API から取得
  const fetched = await fetchBojRate(yearMonth)

  // DB に保存
  await db
    .insertInto('exchangeRate')
    .values({
      id: nanoid(),
      yearMonth,
      currencyPair,
      rate: String(fetched.rate),
      rateDate: fetched.rateDate,
      source: 'boj',
      isManual: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    })
    .onConflict((oc) =>
      oc.columns(['yearMonth', 'currencyPair']).doUpdateSet({
        rate: String(fetched.rate),
        rateDate: fetched.rateDate,
        source: 'boj',
        updatedAt: nowISO(),
      }),
    )
    .execute()

  return {
    rate: String(fetched.rate),
    rateDate: fetched.rateDate,
    source: 'boj',
    isManual: false,
  }
}

/**
 * 手動で為替レートを設定する。
 * 手動レートは API 再取得で上書きされない。
 */
export async function saveManualExchangeRate(input: {
  yearMonth: string
  currencyPair: string
  rate: string
  reason: string
}): Promise<void> {
  const now = nowISO()
  await db
    .insertInto('exchangeRate')
    .values({
      id: nanoid(),
      yearMonth: input.yearMonth,
      currencyPair: input.currencyPair,
      rate: input.rate,
      rateDate: `${input.yearMonth}-01`,
      source: 'manual',
      isManual: 1,
      overrideReason: input.reason,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['yearMonth', 'currencyPair']).doUpdateSet({
        rate: input.rate,
        source: 'manual',
        isManual: 1,
        overrideReason: input.reason,
        updatedAt: now,
      }),
    )
    .execute()
}

/**
 * 手動レートを解除し、API 取得値に戻す。
 */
export async function clearManualExchangeRate(
  yearMonth: string,
  currencyPair: string,
): Promise<void> {
  await db
    .deleteFrom('exchangeRate')
    .where('yearMonth', '=', yearMonth)
    .where('currencyPair', '=', currencyPair)
    .where('isManual', '=', 1)
    .execute()
}

// ---------------------------------------------------------------------------
// 日銀 API
// ---------------------------------------------------------------------------

const BOJ_API_URL = 'https://www.stat-search.boj.or.jp/api/v1/getDataCode'
const BOJ_SERIES_CODE = 'FXERD05' // USD/JPY 仲値 TTM 日次

async function fetchBojRate(
  yearMonth: string,
): Promise<{ rate: number; rateDate: string }> {
  const ym = yearMonth.replace('-', '')
  const url = `${BOJ_API_URL}?format=json&lang=en&db=FM08&code=${BOJ_SERIES_CODE}&startDate=${ym}&endDate=${ym}`

  const res = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip' },
  })

  if (!res.ok) {
    throw new Error(`BOJ API HTTP error: ${res.status}`)
  }

  const data = (await res.json()) as BojApiResponse

  if (data.STATUS !== 200) {
    throw new Error(`BOJ API error: ${data.MESSAGEID} ${data.MESSAGE}`)
  }

  const series = data.RESULTSET[0]
  if (!series) {
    throw new Error(`BOJ API: no result set for ${yearMonth}`)
  }

  const { SURVEY_DATES: dates, VALUES: values } = series.VALUES

  // 月末から逆順に走査し、最初の非null値が月末営業日のレート
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i]
    if (value != null) {
      const dateNum = dates[i]
      if (!dateNum) continue
      const dateStr = String(dateNum)
      const rateDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      return { rate: value, rateDate }
    }
  }

  throw new Error(
    `BOJ API: no valid rate found for ${yearMonth} (all values are null)`,
  )
}
