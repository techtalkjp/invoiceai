import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import { TimesheetDemo } from './+components/timesheet-demo'

export function meta() {
  return [
    { title: 'Timesheet Playground - InvoiceAI' },
    { name: 'description', content: 'Timesheet component playground' },
  ]
}

export default function PlaygroundIndex() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Timesheet Playground</h1>
          <p className="text-muted-foreground">月次タイムシートのデモ</p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/">← トップへ</Link>
        </Button>
      </div>

      <TimesheetDemo />
    </div>
  )
}
