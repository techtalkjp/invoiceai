import { Link, useLoaderData } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '~/components/page-header'
import type { MonthData } from '~/components/timesheet'
import { monthDataSchema } from '~/components/timesheet/schema'
import { Button } from '~/components/ui/button'
import { TimesheetDemo } from './+components/timesheet-demo'

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
    <div className="mx-auto grid max-w-4xl gap-4 py-4 sm:py-8">
      <PageHeader
        title="Timesheet Playground"
        subtitle="月次タイムシートのデモ"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">← トップへ</Link>
          </Button>
        }
      />

      <TimesheetDemo initialData={storedData} />
    </div>
  )
}
