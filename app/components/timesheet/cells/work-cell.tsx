import { memo } from 'react'
import { calculateWorkDuration } from '~/components/time-utils'
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
        <span className="whitespace-nowrap">
          {hours}
          <span className="text-[0.7em]">時間</span>
          {mins > 0 && (
            <>
              {mins}
              <span className="text-[0.7em]">分</span>
            </>
          )}
        </span>
      )
    }
  }

  return (
    <div className="px-0.5 py-1 text-center md:px-1">
      <div className="text-muted-foreground h-7 rounded-md border border-transparent text-sm leading-7">
        {workDisplay}
      </div>
    </div>
  )
})
