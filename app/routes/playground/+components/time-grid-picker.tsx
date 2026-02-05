import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { formatTime, getTimeCategory, type TimeCategory } from './time-utils'

type IntervalOption = 10 | 15 | 30

interface TimeGridPickerProps {
  value: string
  onChange: (value: string) => void
  interval?: IntervalOption
  allow24Plus?: boolean
}

export function TimeGridPicker({
  value,
  onChange,
  interval: initialInterval = 30,
  allow24Plus = false,
}: TimeGridPickerProps) {
  const [interval, setInterval] = useState<IntervalOption>(initialInterval)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // 全時間のグリッドを生成
  const grid = useMemo(() => {
    const maxHour = allow24Plus ? 29 : 23
    const rows: string[][] = []
    for (let hour = 0; hour <= maxHour; hour++) {
      const row: string[] = []
      const intervalsPerHour = 60 / interval
      for (let i = 0; i < intervalsPerHour; i++) {
        row.push(formatTime(hour, i * interval))
      }
      rows.push(row)
    }
    return rows
  }, [interval, allow24Plus])

  // 初回マウント時に選択位置へスクロール
  // useEffect + rAF でペイント後に実行し、Forced Reflow を回避
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (selectedRef.current && scrollRef.current) {
        const container = scrollRef.current
        const selected = selectedRef.current

        // 選択要素をコンテナの中央に配置
        const containerHeight = container.clientHeight
        const selectedTop = selected.offsetTop
        const selectedHeight = selected.clientHeight

        container.scrollTop =
          selectedTop - containerHeight / 2 + selectedHeight / 2
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [])

  // 時間帯に応じた色を取得
  const getCategoryColor = (category: TimeCategory): string => {
    switch (category) {
      case 'early-morning':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
      case 'morning':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      case 'daytime':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      case 'evening':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
      case 'night':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* スクロール可能なグリッド */}
      <div ref={scrollRef} className="max-h-50 space-y-1 overflow-y-auto pr-1">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.map((time) => {
              const isSelected = time === value
              const category = getTimeCategory(time)
              const categoryColor = getCategoryColor(category)

              return (
                <Button
                  key={time}
                  ref={isSelected ? selectedRef : undefined}
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onChange(time)}
                  className={cn(
                    'h-8 px-2 font-mono text-xs tabular-nums transition-colors',
                    !isSelected && categoryColor,
                    isSelected && 'ring-2 ring-offset-1',
                  )}
                >
                  {time}
                </Button>
              )
            })}
          </div>
        ))}
      </div>

      {/* インターバル切り替え */}
      <div className="mt-1 flex w-full justify-end gap-1 border-t pt-1">
        {([30, 15, 10] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setInterval(opt)}
            className={cn(
              'rounded px-2 py-0.5 text-xs transition-colors',
              interval === opt
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {opt}分
          </button>
        ))}
      </div>
    </div>
  )
}
