import {
  forwardRef,
  useCallback,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import { formatTime, parseTimeInput } from '~/components/time-utils'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

export interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  onConfirm?: () => void
  placeholder?: string
  className?: string
  baseTime?: string | undefined // 相対時間計算の基準（+1h など）
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  function TimeInput(
    {
      value,
      onChange,
      onConfirm,
      placeholder,
      className,
      baseTime,
      onNavigate,
    },
    ref,
  ) {
    const [editingValue, setEditingValue] = useState<string | null>(null)
    const inputValue = editingValue ?? value

    // 入力値のパースと反映
    const handleConfirm = useCallback(() => {
      const parsed = parseTimeInput(inputValue, baseTime || value)
      if (parsed) {
        const formatted = formatTime(parsed.hours, parsed.minutes)
        onChange(formatted)
      }
      // 編集終了（成功時は onChange で親が value を更新、失敗時は元の value に戻る）
      setEditingValue(null)
      onConfirm?.()
    }, [inputValue, baseTime, value, onChange, onConfirm])

    // Shift+矢印キーで時間を15分単位で調整
    const adjustTime = useCallback(
      (deltaMinutes: number) => {
        const parsed = parseTimeInput(inputValue, baseTime)
        if (parsed) {
          let totalMinutes = parsed.hours * 60 + parsed.minutes + deltaMinutes
          if (totalMinutes < 0) totalMinutes = 0
          const newHours = Math.floor(totalMinutes / 60)
          const newMinutes = totalMinutes % 60
          const formatted = formatTime(newHours, newMinutes)
          setEditingValue(formatted)
          onChange(formatted)
        }
      },
      [inputValue, baseTime, onChange],
    )

    // キーボードイベント
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        const input = e.target as HTMLInputElement
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0
        const atEnd =
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length

        if (e.key === 'Enter') {
          e.preventDefault()
          handleConfirm()
          onNavigate?.('down')
        } else if (e.key === 'Escape') {
          setEditingValue(null)
          input.blur()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (e.shiftKey) {
            adjustTime(15)
          } else {
            handleConfirm()
            onNavigate?.('up')
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (e.shiftKey) {
            adjustTime(-15)
          } else {
            handleConfirm()
            onNavigate?.('down')
          }
        } else if (e.key === 'ArrowLeft' && atStart) {
          e.preventDefault()
          handleConfirm()
          onNavigate?.('left')
        } else if (e.key === 'ArrowRight' && atEnd) {
          e.preventDefault()
          handleConfirm()
          onNavigate?.('right')
        } else if (e.key === 'Tab') {
          e.preventDefault()
          handleConfirm()
          onNavigate?.(e.shiftKey ? 'left' : 'right')
        }
      },
      [handleConfirm, adjustTime, onNavigate],
    )

    // フォーカス時: 編集用の draft を開始
    const handleFocus = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setEditingValue(value)
        // 全選択
        e.target.select()
      },
      [value],
    )

    // ブラー時
    const handleBlur = useCallback(() => {
      handleConfirm()
    }, [handleConfirm])

    // 2桁の有効な時間が入力されたらコロンを自動補完
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value

        // "XX:" からバックスペースで "XX" になった場合、"X" に戻す
        // （自動補完されたコロンを削除したら、時間の2桁目も一緒に削除）
        if (
          /^\d{2}$/.test(newValue) &&
          inputValue.endsWith(':') &&
          newValue.length < inputValue.length
        ) {
          setEditingValue(newValue.slice(0, 1))
          return
        }

        // 2桁の数字で、有効な時間（0-29）の場合にコロンを自動追加
        // ただし、既にコロンが含まれている場合や、バックスペースで削除中の場合は除く
        if (
          /^\d{2}$/.test(newValue) &&
          !inputValue.includes(':') &&
          newValue.length > inputValue.length
        ) {
          const hour = parseInt(newValue, 10)
          // 0-29時間の範囲（24時超えサポート）
          if (hour >= 0 && hour <= 29) {
            setEditingValue(`${newValue}:`)
            return
          }
        }

        // 既に完全な時間形式（XX:XX）の場合、数字入力で全置換開始
        if (
          /^\d{1,2}:\d{2}$/.test(inputValue) &&
          newValue.length > inputValue.length
        ) {
          // 追加された文字（最後の1文字）を取得
          const addedChar = newValue.slice(-1)
          // 数字なら、その数字で新規入力開始
          if (/^\d$/.test(addedChar)) {
            setEditingValue(addedChar)
            return
          }
          // 数字以外（+など）ならそのまま許可
          if (/^[+-]$/.test(addedChar)) {
            setEditingValue(addedChar)
            return
          }
          // それ以外は無視
          return
        }

        setEditingValue(newValue)
      },
      [inputValue],
    )

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          'font-mono tabular-nums placeholder:text-center',
          'focus-visible:border-input focus-visible:ring-0',
          className,
        )}
        autoComplete="off"
      />
    )
  },
)
