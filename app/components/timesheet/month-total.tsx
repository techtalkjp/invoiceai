import { DurationDisplay } from '~/components/duration-display'
import { calculateWorkDuration } from '~/components/time-utils'
import { useTimesheetStore } from './store'

interface MonthTotalDisplayProps {
  monthDates: string[]
}

// 月合計表示（自分だけが再レンダリング - monthData の変更で親を再レンダリングしない）
export function MonthTotalDisplay({ monthDates }: MonthTotalDisplayProps) {
  const monthTotal = useTimesheetStore((s) => {
    return monthDates.reduce((sum, date) => {
      const entry = s.monthData[date]
      if (!entry?.startTime || !entry?.endTime) return sum
      const duration = calculateWorkDuration(
        entry.startTime,
        entry.endTime,
        entry.breakMinutes,
      )
      return sum + duration.workMinutes
    }, 0)
  })

  return (
    <div className="text-muted-foreground text-sm">
      合計:{' '}
      <span className="font-bold">
        <DurationDisplay minutes={monthTotal} />
      </span>
    </div>
  )
}
