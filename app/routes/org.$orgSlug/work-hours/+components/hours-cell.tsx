import { TableCell } from '~/components/ui/table'
import { cn } from '~/lib/utils'

type HoursCellProps = {
  hours: number
  className?: string
}

export function HoursCell({ hours, className }: HoursCellProps) {
  return (
    <TableCell className={cn('text-center font-medium', className)}>
      {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
    </TableCell>
  )
}
