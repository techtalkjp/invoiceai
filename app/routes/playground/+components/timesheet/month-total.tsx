import { calculateWorkDuration } from '../time-utils'
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
        {Math.floor(monthTotal / 60)}
        <span className="text-[0.8em]">時間</span>
        {monthTotal % 60 > 0 && (
          <>
            {monthTotal % 60}
            <span className="text-[0.8em]">分</span>
          </>
        )}
      </span>
    </div>
  )
}
