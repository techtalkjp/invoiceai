import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { Input } from '~/components/ui/input'
import { TableCell } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

type EditableCellProps = {
  clientId: string
  workDate: string
  field: 'startTime' | 'endTime' | 'breakHours' | 'description'
  value: string
  type?: 'time' | 'number' | 'text'
  placeholder?: string
  suffix?: string
  className?: string
  currentEntry?: {
    startTime: string | undefined
    endTime: string | undefined
    breakMinutes: number
    description: string | undefined
  }
}

export function EditableCell({
  clientId,
  workDate,
  field,
  value,
  type = 'text',
  placeholder,
  suffix,
  className,
  currentEntry,
}: EditableCellProps) {
  const fetcher = useFetcher({ key: `edit-${workDate}-${field}` })
  const [editValue, setEditValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    if (editValue === value) return

    const formData: Record<string, string> = {
      intent: 'saveEntry',
      clientId,
      workDate,
      startTime: currentEntry?.startTime ?? '',
      endTime: currentEntry?.endTime ?? '',
      breakMinutes: String(currentEntry?.breakMinutes ?? 0),
      description: currentEntry?.description ?? '',
    }

    // 編集したフィールドを上書き
    if (field === 'breakHours') {
      // 時間を分に変換してDBに保存
      const hours = Number.parseFloat(editValue) || 0
      formData.breakMinutes = String(Math.round(hours * 60))
    } else {
      formData[field] = editValue
    }

    fetcher.submit(formData, { method: 'POST' })
  }

  const handleBlur = () => {
    setIsFocused(false)
    handleSave()
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
      // 次の行の同じフィールドにフォーカスを移す
      const currentInput = e.currentTarget as HTMLElement
      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input, textarea',
        ),
      ).filter((el) => !el.disabled && el.tabIndex !== -1)
      const currentIndex = allInputs.indexOf(
        currentInput as HTMLInputElement | HTMLTextAreaElement,
      )
      // 4列分スキップして次の行へ（開始、終了、休憩、作業内容）
      const nextIndex = currentIndex + 4
      if (nextIndex < allInputs.length) {
        allInputs[nextIndex]?.focus()
      }
    }
    if (e.key === 'Escape') {
      setEditValue(value)
      ;(e.currentTarget as HTMLElement).blur()
    }
  }

  const isSaving = fetcher.state !== 'idle'

  const inputClassName = cn(
    'h-7 border-transparent bg-transparent px-2 py-1 text-sm transition-colors',
    'hover:border-border hover:bg-accent/50',
    'focus:border-primary focus:bg-background',
    isSaving && 'opacity-50',
    field === 'description' ? 'text-left' : 'text-center',
  )

  // 休憩時間のstep（0.5h単位）
  const numberStep = field === 'breakHours' ? 0.5 : 15

  if (field === 'description') {
    // 3行を超えるかチェック（改行数で判定）
    const lineCount = (editValue.match(/\n/g) || []).length + 1
    const hasOverflow = lineCount > 3

    // フォーカス時は編集用Textarea、非フォーカス時は表示用
    if (isFocused) {
      return (
        <TableCell className={cn('p-0.5', className)}>
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={3}
            className={cn(inputClassName, 'min-h-18 resize-none')}
          />
        </TableCell>
      )
    }

    // 非フォーカス時: 3行まで表示、超えたらTooltip
    const displayContent = (
      <button
        type="button"
        className={cn(
          'min-h-7 w-full cursor-pointer rounded border border-transparent px-2 py-1 text-left text-sm whitespace-pre-wrap',
          'line-clamp-3',
          'hover:border-border hover:bg-accent/50',
          !editValue && 'text-muted-foreground',
          isSaving && 'opacity-50',
        )}
        onClick={() => setIsFocused(true)}
      >
        {editValue || '-'}
      </button>
    )

    if (hasOverflow && editValue) {
      return (
        <TableCell className={cn('p-0.5', className)}>
          <Tooltip>
            <TooltipTrigger asChild>{displayContent}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-md whitespace-pre-wrap">
              {editValue}
            </TooltipContent>
          </Tooltip>
        </TableCell>
      )
    }

    return (
      <TableCell className={cn('p-0.5', className)}>{displayContent}</TableCell>
    )
  }

  // time inputはフォーカス時のみtime表示（アイコンを消すため）
  const inputType = type === 'time' && !isFocused ? 'text' : type

  return (
    <TableCell className={cn('p-0.5', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type={inputType}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={isFocused ? '' : '-'}
          min={type === 'number' ? 0 : undefined}
          step={type === 'number' ? numberStep : undefined}
          className={cn(
            inputClassName,
            suffix && 'pr-6',
            !editValue && !isFocused && 'text-muted-foreground',
          )}
        />
        {suffix && (editValue || isFocused) && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </TableCell>
  )
}
