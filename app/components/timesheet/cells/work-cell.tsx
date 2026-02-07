import { memo } from 'react'
import { calculateWorkDuration } from '~/components/time-utils'
import { TableCell } from '~/components/ui/table'
import { useEntryField } from '../store'

interface TimesheetWorkCellProps {
  date: string
}

export const TimesheetWorkCell = memo(function TimesheetWorkCell({
  date,
}: TimesheetWorkCellProps) {
  const startTime = useEntryField(date, 'startTime')
  const endTime = useEntryField(date, 'endTime')
  const breakMinutes = useEntryField(date, 'breakMinutes') ?? 0

  let workDisplay: React.ReactNode = null
  if (startTime && endTime) {
    const duration = calculateWorkDuration(startTime, endTime, breakMinutes)
    if (duration.workMinutes > 0) {
      const hours = Math.floor(duration.workMinutes / 60)
      const mins = duration.workMinutes % 60
      workDisplay = (
        <>
          {hours}
          <span className="text-[0.7em]">時間</span>
          {mins > 0 && (
            <>
              {mins}
              <span className="text-[0.7em]">分</span>
            </>
          )}
        </>
      )
    }
  }

  return (
    <TableCell className="text-muted-foreground text-center">
      {workDisplay}
    </TableCell>
  )
})
