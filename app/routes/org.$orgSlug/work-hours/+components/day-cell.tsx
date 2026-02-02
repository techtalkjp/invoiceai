import { MessageSquareIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { TableCell } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { cn } from '~/lib/utils'
import { calculateHours, type WorkEntryData } from '../+schema'

type Props = {
  clientId: string
  workDate: string
  entry: WorkEntryData | undefined
  isWeekend: boolean
}

export function DayCell({ clientId, workDate, entry, isWeekend }: Props) {
  const fetcher = useFetcher()
  const [isOpen, setIsOpen] = useState(false)
  const [startTime, setStartTime] = useState(entry?.startTime ?? '')
  const [endTime, setEndTime] = useState(entry?.endTime ?? '')
  const [breakMinutes, setBreakMinutes] = useState(
    entry?.breakMinutes?.toString() ?? '0',
  )
  const [description, setDescription] = useState(entry?.description ?? '')
  const startInputRef = useRef<HTMLInputElement>(null)

  // データが変わったら反映
  useEffect(() => {
    setStartTime(entry?.startTime ?? '')
    setEndTime(entry?.endTime ?? '')
    setBreakMinutes(entry?.breakMinutes?.toString() ?? '0')
    setDescription(entry?.description ?? '')
  }, [
    entry?.startTime,
    entry?.endTime,
    entry?.breakMinutes,
    entry?.description,
  ])

  // ポップオーバーが開いたらフォーカス
  useEffect(() => {
    if (isOpen && startInputRef.current) {
      startInputRef.current.focus()
    }
  }, [isOpen])

  const handleSave = () => {
    fetcher.submit(
      {
        intent: 'saveEntry',
        clientId,
        workDate,
        startTime: startTime || '',
        endTime: endTime || '',
        breakMinutes: breakMinutes || '0',
        description: description || '',
      },
      { method: 'POST' },
    )
    setIsOpen(false)
  }

  const handleClear = () => {
    setStartTime('')
    setEndTime('')
    setBreakMinutes('0')
    setDescription('')
    fetcher.submit(
      {
        intent: 'saveEntry',
        clientId,
        workDate,
        startTime: '',
        endTime: '',
        breakMinutes: '0',
        description: '',
      },
      { method: 'POST' },
    )
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setStartTime(entry?.startTime ?? '')
      setEndTime(entry?.endTime ?? '')
      setBreakMinutes(entry?.breakMinutes?.toString() ?? '0')
      setDescription(entry?.description ?? '')
      setIsOpen(false)
    }
  }

  const hours = calculateHours(
    startTime || undefined,
    endTime || undefined,
    Number(breakMinutes) || 0,
  )
  const displayHours = entry?.hours ?? 0
  const hasDescription = !!entry?.description
  const isSaving = fetcher.state !== 'idle'

  return (
    <TableCell
      className={cn(
        'p-1 text-center',
        isWeekend && 'bg-muted/50',
        isSaving && 'opacity-50',
      )}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              'relative flex h-8 w-14 cursor-pointer items-center justify-center rounded border border-transparent transition-colors',
              'hover:border-border hover:bg-accent',
              displayHours === 0 && 'text-muted-foreground',
            )}
          >
            {displayHours > 0 ? displayHours.toFixed(1) : '-'}
            {hasDescription && (
              <MessageSquareIcon className="text-muted-foreground absolute top-0.5 right-0.5 h-3 w-3" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="center">
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor={`start-${workDate}-${clientId}`}>開始時間</Label>
              <Input
                ref={startInputRef}
                id={`start-${workDate}-${clientId}`}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`end-${workDate}-${clientId}`}>終了時間</Label>
              <Input
                id={`end-${workDate}-${clientId}`}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`break-${workDate}-${clientId}`}>
                休憩（分）
              </Label>
              <Input
                id={`break-${workDate}-${clientId}`}
                type="number"
                min="0"
                step="15"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`desc-${workDate}-${clientId}`}>作業内容</Label>
              <Textarea
                id={`desc-${workDate}-${clientId}`}
                rows={2}
                placeholder="やったことを簡潔に"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="border-t pt-2">
              <div className="text-muted-foreground text-sm">
                稼働時間:{' '}
                <span className="font-medium">{hours.toFixed(1)}h</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1">
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                クリア
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TableCell>
  )
}
