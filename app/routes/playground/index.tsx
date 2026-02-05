import { Link, useLoaderData } from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import type { MonthData } from './+components/timesheet'
import { TimesheetDemo } from './+components/timesheet-demo'
import { monthDataSchema } from './+components/timesheet/schema'

const STORAGE_KEY = 'invoiceai-playground-timesheet'

// LocalStorage から全月データを読み込み
function loadFromStorage(): Record<string, MonthData> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    // 各月のデータをバリデーション
    const validated: Record<string, MonthData> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const result = monthDataSchema.safeParse(value)
      if (result.success) {
        validated[key] = result.data
      }
    }
    return validated
  } catch {
    return {}
  }
}

// LocalStorage に保存
function saveToStorage(allData: Record<string, MonthData>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData))
  } catch {
    // Storage full or disabled - ignore
  }
}

// clientAction 用のスキーマ
const actionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('setMonthData'),
    monthKey: z.string(),
    data: monthDataSchema,
  }),
  z.object({
    intent: z.literal('clearAll'),
  }),
])

// clientLoader: LocalStorage から全月データを読み込み
export function clientLoader() {
  const storedData = loadFromStorage()
  return { storedData }
}

// clientAction: データの永続化
export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const jsonData = formData.get('json')

  if (typeof jsonData !== 'string') {
    return { error: 'Invalid request' }
  }

  const parseResult = actionSchema.safeParse(JSON.parse(jsonData))
  if (!parseResult.success) {
    return { error: parseResult.error.issues }
  }

  const intent = parseResult.data
  const allData = loadFromStorage()

  switch (intent.intent) {
    case 'setMonthData': {
      allData[intent.monthKey] = intent.data
      saveToStorage(allData)
      return { success: true }
    }

    case 'clearAll': {
      saveToStorage({})
      return { success: true }
    }
  }
}

export function meta() {
  return [
    { title: 'Timesheet Playground - InvoiceAI' },
    { name: 'description', content: 'Timesheet component playground' },
  ]
}

export default function PlaygroundIndex() {
  const { storedData } = useLoaderData<typeof clientLoader>()

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-8">
        <div>
          <h1 className="text-xl font-bold sm:mb-2 sm:text-3xl">
            Timesheet Playground
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            月次タイムシートのデモ
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="sm:size-default">
          <Link to="/">← トップへ</Link>
        </Button>
      </div>

      <TimesheetDemo initialData={storedData} />
    </div>
  )
}
