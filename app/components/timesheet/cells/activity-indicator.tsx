import {
  GitCommitHorizontalIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
} from 'lucide-react'
import { memo } from 'react'
import { Badge } from '~/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import type { ActivityRecord } from '~/lib/activity-sources/types'
import { dayjs } from '~/utils/dayjs'
import { useActivitiesForDate } from '../store'

const EVENT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  commit: GitCommitHorizontalIcon,
  pr: GitPullRequestIcon,
  review: GitPullRequestIcon,
  issue_comment: MessageSquareIcon,
}

function getIconForItem(
  item: ActivityRecord,
): React.ComponentType<{ className?: string }> {
  if (item.eventType === 'pr') {
    if (item.metadata.action === 'merged') return GitMergeIcon
    if (item.metadata.action === 'closed') return GitPullRequestClosedIcon
  }
  return EVENT_ICONS[item.eventType] ?? MessageSquareIcon
}

function getPrActionLabel(item: ActivityRecord): string | null {
  if (item.eventType !== 'pr') return null
  return item.metadata.action
}

function repoShortName(repo: string | null): string {
  if (!repo) return ''
  const lastPart = repo.split('/').pop()
  return lastPart ?? repo
}

function formatTime(timestamp: string): string {
  const jst = dayjs(timestamp).tz('Asia/Tokyo')
  const hours = jst.hour()
  const minutes = jst.minute()
  // 30時制: 0:00-5:59 は 24:00-29:59 として表示
  const displayHours = hours < 6 ? hours + 24 : hours
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function sortByTimestamp(activities: ActivityRecord[]): ActivityRecord[] {
  return [...activities].sort((a, b) =>
    a.eventTimestamp.localeCompare(b.eventTimestamp),
  )
}

export const ActivityIndicator = memo(function ActivityIndicator({
  date,
}: {
  date: string
}) {
  const activities = useActivitiesForDate(date)
  if (!activities || activities.length === 0) return null

  const sorted = sortByTimestamp(activities)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation to prevent parent focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: click only used for stopPropagation
    <span
      className="inline-flex shrink-0"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] transition-colors"
          >
            <GitCommitHorizontalIcon className="size-3" />
            {activities.length}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-80 w-80 overflow-y-auto p-3"
        >
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-medium">
              GitHub アクティビティ ({activities.length})
            </div>
            <div className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-1.5 gap-y-0.5 text-[11px]">
              {sorted.map((item, i) => {
                const Icon = getIconForItem(item)
                const prAction = getPrActionLabel(item)
                return (
                  <div
                    key={`${item.eventTimestamp}-${i}`}
                    className="col-span-3 grid grid-cols-subgrid"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      {formatTime(item.eventTimestamp)}
                    </span>
                    <Icon className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0 leading-relaxed">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {item.title || repoShortName(item.repo)}
                        </a>
                      ) : (
                        <span>{item.title || repoShortName(item.repo)}</span>
                      )}
                      {prAction && (
                        <span className="text-muted-foreground ml-1">
                          ({prAction})
                        </span>
                      )}
                      {item.repo && (
                        <Badge
                          variant="secondary"
                          className="ml-1 px-1 py-0 text-[9px]"
                        >
                          {repoShortName(item.repo)}
                        </Badge>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  )
})
