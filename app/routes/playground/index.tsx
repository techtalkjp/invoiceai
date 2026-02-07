import { Link } from 'react-router'
import { PageHeader } from '~/components/page-header'
import { PublicLayout } from '~/components/public-layout'
import type { MonthData } from '~/components/timesheet'
import { monthDataSchema } from '~/components/timesheet/schema'
import { Button } from '~/components/ui/button'
import { TimesheetDemo } from './+components/timesheet-demo'
import type { Route } from './+types/index'

const STORAGE_KEY = 'invoiceai-playground-timesheet'

// LocalStorage から全月データを読み込み
function loadFromStorage(): Record<string, MonthData> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
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

// clientLoader: LocalStorage から全月データを読み込み
export function clientLoader() {
  const storedData = loadFromStorage()
  return { storedData }
}

export function meta() {
  return [
    { title: 'Timesheet Playground - InvoiceAI' },
    { name: 'description', content: 'Timesheet component playground' },
  ]
}

export default function PlaygroundIndex({
  loaderData: { storedData },
}: Route.ComponentProps) {
  return (
    <PublicLayout>
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
    </PublicLayout>
  )
}
