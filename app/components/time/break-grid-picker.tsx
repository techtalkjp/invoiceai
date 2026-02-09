import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface BreakGridPickerProps {
  value: number
  onChange: (value: number) => void
}

const MINUTE_OPTIONS = [
  { value: 0 },
  { value: 15 },
  { value: 30 },
  { value: 45 },
]

const HOUR_OPTIONS = [
  { value: 60 },
  { value: 120 },
  { value: 180 },
  { value: 240 },
  { value: 300 },
  { value: 360 },
  { value: 420 },
  { value: 480 },
]

function formatBreakLabel(minutes: number): React.ReactNode {
  if (minutes === 0) return '-'
  if (minutes < 60)
    return (
      <span>
        {minutes}
        <span className="text-[0.7em]">分</span>
      </span>
    )
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <span>
      {h}
      <span className="text-[0.7em]">時間</span>
      {m > 0 && (
        <>
          {m}
          <span className="text-[0.7em]">分</span>
        </>
      )}
    </span>
  )
}

const ALL_OPTIONS = [...MINUTE_OPTIONS, ...HOUR_OPTIONS].map((o) => o.value)

export function BreakGridPicker({ value, onChange }: BreakGridPickerProps) {
  const isCustomValue = value > 0 && !ALL_OPTIONS.includes(value)
  const [customInput, setCustomInput] = useState(
    isCustomValue ? String(value) : '',
  )

  const handleCustomSubmit = () => {
    const parsed = parseInt(customInput, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onChange(parsed)
      setCustomInput('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 0, 15, 30, 45分 */}
      <div className="grid grid-cols-4 gap-1">
        {MINUTE_OPTIONS.map((option) => {
          const isSelected = option.value === value
          return (
            <Button
              key={option.value}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(option.value)}
              className={cn(
                'h-8 px-2 text-base tabular-nums transition-colors',
                isSelected && 'ring-2 ring-offset-1',
              )}
            >
              {formatBreakLabel(option.value)}
            </Button>
          )
        })}
      </div>
      {/* 1〜8時間 */}
      <div className="grid grid-cols-4 gap-1">
        {HOUR_OPTIONS.map((option) => {
          const isSelected = option.value === value
          return (
            <Button
              key={option.value}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(option.value)}
              className={cn(
                'h-8 px-2 text-base tabular-nums transition-colors',
                isSelected && 'ring-2 ring-offset-1',
              )}
            >
              {formatBreakLabel(option.value)}
            </Button>
          )
        })}
      </div>
      {/* 自由入力 */}
      <div className="flex items-center gap-1 border-t pt-2">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCustomSubmit()
              }
            }}
            placeholder="自由入力"
            className={cn(
              'h-8 w-full rounded-md border pr-6 pl-2 text-base tabular-nums',
              'border-input bg-background',
              'focus:border-primary focus:outline-none',
            )}
          />
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">
            分
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCustomSubmit}
          className="h-8 px-2 text-xs"
        >
          設定
        </Button>
      </div>
      {/* カスタム値が設定されている場合表示 */}
      {isCustomValue && (
        <div className="text-muted-foreground text-center text-xs">
          現在: {formatBreakLabel(value)}
        </div>
      )}
    </div>
  )
}
