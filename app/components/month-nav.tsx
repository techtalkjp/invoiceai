import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'

interface MonthNavProps {
  label: string
  prevUrl: string
  nextUrl: string
}

export function MonthNav({ label, prevUrl, nextUrl }: MonthNavProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" asChild>
        <Link to={prevUrl}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
      </Button>
      <span className="min-w-32 text-center text-lg font-medium">{label}</span>
      <Button variant="outline" size="icon" asChild>
        <Link to={nextUrl}>
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
