import { splitHoursMinutes } from './time-utils'

/**
 * 稼働時間を「8<小さい>時間</小さい>30<小さい>分</小さい>」形式で表示する。
 * minutes: 合計分数。0以下なら何も表示しない。
 */
export function DurationDisplay({
  minutes,
  unitClassName = 'text-[0.75em] opacity-70',
}: {
  minutes: number
  unitClassName?: string | undefined
}) {
  if (minutes <= 0) return null
  const { hours, minutes: mins } = splitHoursMinutes(minutes)

  return (
    <span>
      {hours > 0 && (
        <>
          {hours}
          <span className={unitClassName}>時間</span>
        </>
      )}
      {mins > 0 && (
        <>
          {mins}
          <span className={unitClassName}>分</span>
        </>
      )}
    </span>
  )
}

/**
 * 小数時間 (e.g. 8.5) を分数に変換して DurationDisplay に渡すラッパー
 */
export function HoursDurationDisplay({
  hours,
  unitClassName,
}: {
  hours: number
  unitClassName?: string | undefined
}) {
  return (
    <DurationDisplay
      minutes={Math.round(hours * 60)}
      unitClassName={unitClassName}
    />
  )
}
