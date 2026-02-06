import { MessageSquareIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { BreakGridPicker } from '~/components/break-grid-picker'
import { TimeGridPicker } from '~/components/time-grid-picker'
import { formatTime, parseTimeInput } from '~/components/time-utils'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '~/components/ui/drawer'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { TableCell } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useIsMobile } from '~/hooks/use-mobile'
import { cn } from '~/lib/utils'
import { calculateHours, type WorkEntryData } from '../+schema'

type Props = {
  clientId: string
  clientName: string
  workDate: string
  workDateLabel: string
  entry: WorkEntryData | undefined
  isWeekend: boolean
}

/**
 * 時間テキスト入力: あいまい入力をパースして HH:MM に変換
 */
function TimeInput({
  value,
  onChange,
  placeholder,
  baseTime,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  baseTime?: string | undefined
}) {
  const [draft, setDraft] = useState(value)

  // 外部から value が変わったら draft を同期
  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = () => {
    if (!draft.trim()) {
      onChange('')
      return
    }
    const parsed = parseTimeInput(draft, baseTime)
    if (parsed) {
      const formatted = formatTime(parsed.hours, parsed.minutes)
      setDraft(formatted)
      onChange(formatted)
    } else {
      // パース失敗 → 元に戻す
      setDraft(value)
    }
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      placeholder={placeholder}
      className="h-8 w-full font-mono text-sm tabular-nums"
    />
  )
}

/**
 * PC用コンパクトエディタ: テキスト入力ベース
 */
function CompactEditor({
  startTime,
  endTime,
  breakMinutes,
  description,
  onStartTimeChange,
  onEndTimeChange,
  onBreakMinutesChange,
  onDescriptionChange,
  hours,
}: {
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
  onStartTimeChange: (v: string) => void
  onEndTimeChange: (v: string) => void
  onBreakMinutesChange: (v: number) => void
  onDescriptionChange: (v: string) => void
  hours: number
}) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">開始</Label>
          <TimeInput
            value={startTime}
            onChange={onStartTimeChange}
            placeholder="9:00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">終了</Label>
          <TimeInput
            value={endTime}
            onChange={onEndTimeChange}
            placeholder="18:00"
            baseTime={startTime || undefined}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">休憩(分)</Label>
          <Input
            type="number"
            min={0}
            step={15}
            value={breakMinutes || ''}
            onChange={(e) => {
              const v = e.target.value
              onBreakMinutesChange(v === '' ? 0 : Number.parseInt(v, 10))
            }}
            placeholder="60"
            className="h-8 font-mono text-sm tabular-nums"
          />
        </div>
        <div className="flex items-end pb-0.5">
          {hours > 0 && (
            <span className="text-muted-foreground text-sm">
              稼働: <span className="font-medium">{hours.toFixed(1)}h</span>
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">備考</Label>
        <Textarea
          rows={1}
          placeholder="やったことを簡潔に"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="min-h-8 resize-none text-sm"
        />
      </div>
    </div>
  )
}

/**
 * モバイル用リッチエディタ: グリッドピッカーベース
 */
function RichEditor({
  startTime,
  endTime,
  breakMinutes,
  description,
  onStartTimeChange,
  onEndTimeChange,
  onBreakMinutesChange,
  onDescriptionChange,
  hours,
}: {
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
  onStartTimeChange: (v: string) => void
  onEndTimeChange: (v: string) => void
  onBreakMinutesChange: (v: number) => void
  onDescriptionChange: (v: string) => void
  hours: number
}) {
  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <Label>開始</Label>
        <TimeGridPicker value={startTime} onChange={onStartTimeChange} />
      </div>
      <div className="space-y-1">
        <Label>終了</Label>
        <TimeGridPicker
          value={endTime}
          onChange={onEndTimeChange}
          allow24Plus
        />
      </div>
      <div className="space-y-1">
        <Label>休憩</Label>
        <BreakGridPicker value={breakMinutes} onChange={onBreakMinutesChange} />
      </div>
      <div className="space-y-1">
        <Label>作業内容</Label>
        <Textarea
          rows={2}
          placeholder="やったことを簡潔に"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      {hours > 0 && (
        <div className="text-muted-foreground border-t pt-2 text-sm">
          稼働時間: <span className="font-medium">{hours.toFixed(1)}h</span>
        </div>
      )}
    </div>
  )
}

export function DayCell({
  clientId,
  clientName,
  workDate,
  workDateLabel,
  entry,
  isWeekend,
}: Props) {
  const fetcher = useFetcher()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [startTime, setStartTime] = useState(entry?.startTime ?? '')
  const [endTime, setEndTime] = useState(entry?.endTime ?? '')
  const [breakMinutes, setBreakMinutes] = useState(entry?.breakMinutes ?? 0)
  const [description, setDescription] = useState(entry?.description ?? '')

  // 閉じる前の値を保持して、変更有無を判定
  const openSnapshotRef = useRef({
    startTime: '',
    endTime: '',
    breakMinutes: 0,
    description: '',
  })

  // サーバーデータが変わったら反映
  useEffect(() => {
    setStartTime(entry?.startTime ?? '')
    setEndTime(entry?.endTime ?? '')
    setBreakMinutes(entry?.breakMinutes ?? 0)
    setDescription(entry?.description ?? '')
  }, [
    entry?.startTime,
    entry?.endTime,
    entry?.breakMinutes,
    entry?.description,
  ])

  // 自動保存: 閉じるときに変更があれば保存
  const saveIfChanged = useCallback(() => {
    const snap = openSnapshotRef.current
    const changed =
      startTime !== snap.startTime ||
      endTime !== snap.endTime ||
      breakMinutes !== snap.breakMinutes ||
      description !== snap.description

    if (changed) {
      fetcher.submit(
        {
          intent: 'saveEntry',
          clientId,
          workDate,
          startTime: startTime || '',
          endTime: endTime || '',
          breakMinutes: String(breakMinutes),
          description: description || '',
        },
        { method: 'POST' },
      )
    }
  }, [
    fetcher,
    clientId,
    workDate,
    startTime,
    endTime,
    breakMinutes,
    description,
  ])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        // 開くときにスナップショットを保存
        openSnapshotRef.current = {
          startTime,
          endTime,
          breakMinutes,
          description,
        }
      } else {
        // 閉じるときに自動保存
        saveIfChanged()
      }
      setIsOpen(open)
    },
    [startTime, endTime, breakMinutes, description, saveIfChanged],
  )

  const hours = calculateHours(
    startTime || undefined,
    endTime || undefined,
    breakMinutes,
  )
  const displayHours = entry?.hours ?? 0
  const hasDescription = !!entry?.description
  const hasTimeRange = !!entry?.startTime && !!entry?.endTime
  const isSaving = fetcher.state !== 'idle'

  const cellTrigger = (
    <div
      className={cn(
        'relative flex min-h-8 cursor-pointer flex-col items-center justify-center rounded border border-transparent px-1 transition-colors',
        'hover:border-border hover:bg-accent',
        displayHours === 0 && 'text-muted-foreground',
      )}
    >
      <span className="text-sm leading-tight font-medium">
        {displayHours > 0 ? displayHours.toFixed(1) : '-'}
      </span>
      {hasTimeRange && (
        <span className="text-muted-foreground hidden text-[10px] leading-tight md:block">
          {entry?.startTime}-{entry?.endTime}
        </span>
      )}
      {hasDescription && (
        <MessageSquareIcon className="text-muted-foreground absolute top-0.5 right-0.5 h-2.5 w-2.5" />
      )}
    </div>
  )

  const editorProps = {
    startTime,
    endTime,
    breakMinutes,
    description,
    onStartTimeChange: setStartTime,
    onEndTimeChange: setEndTime,
    onBreakMinutesChange: setBreakMinutes,
    onDescriptionChange: setDescription,
    hours,
  }

  return (
    <TableCell
      className={cn(
        'p-1 text-center',
        isWeekend && 'bg-muted/50',
        isSaving && 'opacity-50',
      )}
    >
      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: cell tap to open drawer */}
          <div onClick={() => handleOpenChange(true)}>{cellTrigger}</div>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {workDateLabel} · {clientName}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <RichEditor {...editorProps} />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{cellTrigger}</PopoverTrigger>
          <PopoverContent className="w-64" align="center">
            <div className="text-muted-foreground mb-2 text-xs font-medium">
              {workDateLabel} · {clientName}
            </div>
            <CompactEditor {...editorProps} />
          </PopoverContent>
        </Popover>
      )}
    </TableCell>
  )
}
