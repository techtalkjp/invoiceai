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

      <TimesheetDemo />
    </div>
  )
}
