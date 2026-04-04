import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { calculateWorkDuration } from '~/components/time/time-utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

export function EntryPreviewList({
  entries,
}: {
  entries: Array<{
    workDate: string
    startTime: string
    endTime: string
    breakMinutes: number
    description: string
  }>
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="min-w-0">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground inline-flex w-auto items-center gap-1 text-xs transition-colors">
        <ChevronDownIcon
          className={`size-3 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        内訳を{isOpen ? '閉じる' : '見る'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-48 space-y-0.5 overflow-x-hidden overflow-y-auto">
          {entries.map((e) => {
            const d = new Date(e.workDate)
            const work =
              e.startTime && e.endTime
                ? calculateWorkDuration(e.startTime, e.endTime, e.breakMinutes)
                : null
            return (
              <div
                key={e.workDate}
                className="text-muted-foreground flex min-w-0 items-baseline gap-2 text-xs"
              >
                <span className="w-10 shrink-0 font-medium tabular-nums">
                  {d.getMonth() + 1}/{d.getDate()}
                </span>
                <span className="w-20 shrink-0 tabular-nums">
                  {e.startTime}–{e.endTime}
                </span>
                {work && work.workMinutes > 0 && (
                  <span className="w-10 shrink-0 text-right tabular-nums">
                    {Math.floor(work.workMinutes / 60)}h
                    {work.workMinutes % 60 > 0 && `${work.workMinutes % 60}m`}
                  </span>
                )}
                <span className="truncate">{e.description}</span>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
