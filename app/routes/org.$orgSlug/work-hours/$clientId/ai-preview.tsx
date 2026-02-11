import { parseWithZod } from '@conform-to/zod/v4'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  InfoIcon,
  SaveIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Form,
  Link,
  isRouteErrorResponse,
  redirect,
  useParams,
} from 'react-router'
import { ContentPanel } from '~/components/layout/content-panel'
import { ControlBar } from '~/components/layout/control-bar'
import { PageHeader } from '~/components/layout/page-header'
import { DurationDisplay } from '~/components/time/duration-display'
import {
  DAY_LABELS,
  getHolidayName,
  isSaturday,
  isSunday,
} from '~/components/timesheet/utils'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  deleteClientSourceMapping,
  getActivitiesByMonth,
  getActivitySource,
  getClientSourceMappings,
  saveClientSourceMapping,
} from '~/lib/activity-sources/activity-queries.server'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { formatYearMonthLabel } from '~/utils/month'
import { saveEntries } from '../+mutations.server'
import { getMonthEntries, getTimeBasedClients } from '../+queries.server'
import { calculateHours, saveAiSuggestionsSchema } from '../+schema'
import { suggestWorkEntriesFromActivities } from '../+work-entry-suggest.server'
import { RepoMappingPanel } from './+components/repo-mapping-panel'
import type { Route } from './+types/ai-preview'

export const handle = {
  breadcrumb: (data?: {
    organization?: { slug?: string }
    clientName?: string
    clientId?: string
  }) => {
    const slug = data?.organization?.slug
    if (!slug) return [{ label: '候補生成' }]
    return [
      { label: '稼働時間', to: `/org/${slug}/work-hours` },
      ...(data.clientName && data.clientId
        ? [
            {
              label: data.clientName,
              to: `/org/${slug}/work-hours/${data.clientId}`,
            },
          ]
        : []),
      { label: '候補生成' },
    ]
  },
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const year = Number(url.searchParams.get('year'))
  const month = Number(url.searchParams.get('month'))

  if (!year || !month) {
    throw new Response('パラメータが不足しています', { status: 400 })
  }

  const [clients, source, mappings, allActivities, monthEntries] =
    await Promise.all([
      getTimeBasedClients(organization.id),
      getActivitySource(organization.id, user.id, 'github'),
      getClientSourceMappings([clientId], 'github'),
      getActivitiesByMonth(organization.id, user.id, year, month),
      getMonthEntries(organization.id, user.id, year, month),
    ])

  const client = clients.find((c) => c.id === clientId)
  if (!client) {
    throw new Response('クライアントが見つかりません', { status: 404 })
  }

  const mappedRepos = new Set(mappings.map((m) => m.sourceIdentifier))
  const activities =
    mappedRepos.size > 0
      ? allActivities.filter((a) => a.repo && mappedRepos.has(a.repo))
      : []

  const suggestion =
    activities.length > 0 ? suggestWorkEntriesFromActivities(activities) : null

  return {
    organization,
    year,
    month,
    clientId,
    clientName: client.name,
    hasGitHubPat: !!source,
    mappings,
    suggestion,
    monthEntries,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug, clientId } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const formData = await request.formData()
  const intent = formData.get('intent')

  // マッピング操作（conform 外）
  if (intent === 'addMapping') {
    const repoFullName = formData.get('repoFullName') as string
    if (repoFullName) {
      await saveClientSourceMapping(clientId, 'github', repoFullName)
    }
    return { mappingUpdated: true }
  }

  if (intent === 'removeMapping') {
    const sourceIdentifier = formData.get('sourceIdentifier') as string
    if (sourceIdentifier) {
      await deleteClientSourceMapping(clientId, 'github', sourceIdentifier)
    }
    return { mappingUpdated: true }
  }

  // 候補保存（conform）
  const submission = parseWithZod(formData, {
    schema: saveAiSuggestionsSchema,
  })

  if (submission.status !== 'success') {
    return { error: 'バリデーションエラー' }
  }

  const { entries: entriesJson } = submission.value
  const year = formData.get('year')
  const month = formData.get('month')

  try {
    const entries = JSON.parse(entriesJson) as Array<{
      workDate: string
      startTime: string
      endTime: string
      breakMinutes: number
      description: string
    }>
    await saveEntries(
      organization.id,
      user.id,
      entries.map((e) => ({
        clientId,
        workDate: e.workDate,
        startTime: e.startTime,
        endTime: e.endTime,
        breakMinutes: e.breakMinutes,
        description: e.description,
      })),
    )
  } catch {
    return { error: '保存に失敗しました' }
  }

  return redirect(
    `/org/${orgSlug}/work-hours/${clientId}?year=${year ?? ''}&month=${month ?? ''}`,
  )
}

type PreviewEntry = {
  workDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  description: string
  selected: boolean
  hasConflict: boolean
  hours: number
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDate()
  const dow = DAY_LABELS[date.getDay()]
  return `${day}(${dow})`
}

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

function minutesToTime(minutes: number): string {
  const clamped = Math.min(Math.max(0, minutes), 23 * 60 + 59)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function AiPreview({
  loaderData: {
    year,
    month,
    clientId,
    clientName,
    hasGitHubPat,
    mappings,
    suggestion,
    monthEntries,
  },
  params: { orgSlug },
}: Route.ComponentProps) {
  const backUrl = `/org/${orgSlug}/work-hours/${clientId}?year=${year}&month=${month}`
  const settingsUrl = `/org/${orgSlug}/settings/integrations`
  const subtitle = `${clientName} - ${formatYearMonthLabel(year, month)}`

  // PAT未設定
  if (!hasGitHubPat) {
    return (
      <div className="grid gap-4">
        <PageHeader title="候補生成" subtitle={subtitle} />
        <ContentPanel>
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <InfoIcon className="text-muted-foreground size-10" />
            <h2 className="text-lg font-semibold">GitHub 連携が未設定です</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              候補生成には GitHub Personal Access Token
              の設定が必要です。外部連携設定で PAT を登録してください。
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to={settingsUrl}>
                  <ExternalLinkIcon className="mr-1 size-4" />
                  外部連携設定を開く
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={backUrl}>
                  <ArrowLeftIcon className="mr-1 size-4" />
                  戻る
                </Link>
              </Button>
            </div>
          </div>
        </ContentPanel>
      </div>
    )
  }

  // マッピングなし → その場で設定
  if (mappings.length === 0) {
    return (
      <div className="grid gap-4">
        <PageHeader title="候補生成" subtitle={subtitle} />
        <ContentPanel>
          <div className="flex flex-col items-center gap-4 px-6 py-12">
            <GitBranchIcon className="text-muted-foreground size-10" />
            <h2 className="text-lg font-semibold">
              リポジトリの紐付けが必要です
            </h2>
            <p className="text-muted-foreground max-w-md text-center text-sm">
              このクライアントに対応する GitHub
              リポジトリを追加してください。紐付け後、ページを再読み込みすると候補が生成されます。
            </p>
            <div className="w-full max-w-lg">
              <RepoMappingPanel
                orgSlug={orgSlug}
                clientId={clientId}
                mappings={mappings}
              />
            </div>
            <Button variant="outline" asChild>
              <Link to={backUrl}>
                <ArrowLeftIcon className="mr-1 size-4" />
                戻る
              </Link>
            </Button>
          </div>
        </ContentPanel>
      </div>
    )
  }

  // マッピングあり + アクティビティなし
  if (!suggestion) {
    return (
      <div className="grid gap-4">
        <PageHeader title="候補生成" subtitle={subtitle} />
        <ContentPanel>
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <InfoIcon className="text-muted-foreground size-10" />
            <h2 className="text-lg font-semibold">
              アクティビティがありません
            </h2>
            <p className="text-muted-foreground max-w-md text-sm">
              この月の紐付け済みリポジトリにアクティビティが見つかりませんでした。
              外部連携設定でアクティビティを同期するか、紐付けを確認してください。
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to={settingsUrl}>
                  <ExternalLinkIcon className="mr-1 size-4" />
                  外部連携設定を開く
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={backUrl}>
                  <ArrowLeftIcon className="mr-1 size-4" />
                  戻る
                </Link>
              </Button>
            </div>
            <div className="text-muted-foreground mt-2 text-xs">
              紐付け済み: {mappings.map((m) => m.sourceIdentifier).join(', ')}
            </div>
          </div>
        </ContentPanel>
      </div>
    )
  }

  // 正常: 候補プレビュー
  return (
    <SuggestionPreview
      orgSlug={orgSlug}
      year={year}
      month={month}
      clientId={clientId}
      clientName={clientName}
      suggestion={suggestion}
      monthEntries={monthEntries}
      mappings={mappings}
      backUrl={backUrl}
    />
  )
}

function SuggestionPreview({
  orgSlug,
  year,
  month,
  clientId,
  clientName,
  suggestion,
  monthEntries,
  mappings,
  backUrl,
}: {
  orgSlug: string
  year: number
  month: number
  clientId: string
  clientName: string
  suggestion: {
    entries: Array<{
      workDate: string
      startTime: string
      endTime: string
      breakMinutes: number
      description: string
    }>
    reasoning: string
  }
  monthEntries: Array<{
    clientId: string
    entries: Record<
      string,
      {
        startTime?: string | undefined
        endTime?: string | undefined
        hours: number
      }
    >
  }>
  mappings: Array<{ clientId: string; sourceIdentifier: string }>
  backUrl: string
}) {
  const clientMonthEntry = monthEntries.find((e) => e.clientId === clientId)

  const initialEntries = useMemo((): PreviewEntry[] => {
    return suggestion.entries.map((entry) => {
      const existing = clientMonthEntry?.entries[entry.workDate]
      const hasConflict =
        existing !== undefined &&
        (existing.startTime !== undefined ||
          existing.endTime !== undefined ||
          existing.hours > 0)
      return {
        ...entry,
        selected: true,
        hasConflict,
        hours: calculateHours(
          entry.startTime,
          entry.endTime,
          entry.breakMinutes,
        ),
      }
    })
  }, [suggestion.entries, clientMonthEntry])

  const [entries, setEntries] = useState<PreviewEntry[]>(initialEntries)
  const [targetHours, setTargetHours] = useState('')

  const selectedEntries = entries.filter((e) => e.selected)
  const totalMinutes = Math.round(
    selectedEntries.reduce((sum, e) => sum + e.hours, 0) * 60,
  )
  const conflictCount = selectedEntries.filter((e) => e.hasConflict).length
  const targetHoursNum = targetHours ? Number.parseFloat(targetHours) : 0

  const handleToggleAll = (checked: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: !!checked })))
  }

  const handleToggleEntry = (index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)),
    )
  }

  const handleEntryChange = (
    index: number,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e
        const updated = { ...e, [field]: value }
        updated.hours = calculateHours(
          updated.startTime,
          updated.endTime,
          updated.breakMinutes,
        )
        return updated
      }),
    )
  }

  const handleAutoAdjust = () => {
    if (!targetHoursNum || selectedEntries.length === 0) return

    const currentTotalMinutes = Math.round(
      selectedEntries.reduce((sum, e) => sum + e.hours, 0) * 60,
    )
    if (currentTotalMinutes === 0) return

    const targetTotalMinutes = targetHoursNum * 60
    const ratio = targetTotalMinutes / currentTotalMinutes

    setEntries((prev) =>
      prev.map((entry) => {
        if (!entry.selected) return entry

        const startMin = timeToMinutes(entry.startTime)
        const endMin = timeToMinutes(entry.endTime)
        const workMinutes = endMin - startMin - entry.breakMinutes
        const newWorkMinutes = Math.round(workMinutes * ratio)
        const newEndMin = startMin + newWorkMinutes + entry.breakMinutes
        const newEndTime = minutesToTime(newEndMin)
        const newHours = calculateHours(
          entry.startTime,
          newEndTime,
          entry.breakMinutes,
        )

        return { ...entry, endTime: newEndTime, hours: newHours }
      }),
    )
  }

  const allSelected = entries.length > 0 && entries.every((e) => e.selected)

  return (
    <div className="grid gap-4">
      <PageHeader
        title="候補生成"
        subtitle={`${clientName} - ${formatYearMonthLabel(year, month)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <SparklesIcon className="size-3" />
              {suggestion.entries.length}件提案
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <SettingsIcon className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>リポジトリ紐付け設定</DialogTitle>
                </DialogHeader>
                <RepoMappingPanel
                  orgSlug={orgSlug}
                  clientId={clientId}
                  mappings={mappings}
                />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <ContentPanel
        toolbar={
          <ControlBar
            left={
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">
                  合計:{' '}
                  <span className="text-foreground font-medium">
                    <DurationDisplay minutes={totalMinutes} />
                  </span>
                </span>
                {selectedEntries.length < entries.length && (
                  <span className="text-muted-foreground text-sm">
                    ({selectedEntries.length}/{entries.length}件選択)
                  </span>
                )}
                {conflictCount > 0 && (
                  <Badge variant="outline" className="text-yellow-600">
                    {conflictCount}件上書き
                  </Badge>
                )}
              </div>
            }
            right={
              <div className="flex items-center gap-2">
                <Label htmlFor="target-hours" className="text-sm">
                  目標
                </Label>
                <Input
                  id="target-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="160"
                  className="h-8 w-20 text-xs"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                />
                <span className="text-muted-foreground text-xs">h</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={!targetHoursNum || selectedEntries.length === 0}
                  onClick={handleAutoAdjust}
                >
                  <SlidersHorizontalIcon className="mr-1 size-3.5" />
                  自動調整
                </Button>
                {targetHoursNum > 0 && (
                  <span className="text-muted-foreground text-xs">
                    ({(totalMinutes / 60).toFixed(1)}/{targetHoursNum}h)
                  </span>
                )}
              </div>
            }
          />
        }
      >
        {suggestion.reasoning && (
          <div className="border-b bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <strong>AI分析:</strong> {suggestion.reasoning}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      handleToggleAll(checked === true)
                    }
                  />
                </TableHead>
                <TableHead className="w-20">日付</TableHead>
                <TableHead className="w-24">開始</TableHead>
                <TableHead className="w-24">終了</TableHead>
                <TableHead className="w-16 text-center">休憩</TableHead>
                <TableHead className="w-16 text-right">時間</TableHead>
                <TableHead>作業内容</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => {
                const holiday = getHolidayName(entry.workDate)
                const isWeekend =
                  isSaturday(entry.workDate) || isSunday(entry.workDate)
                return (
                  <TableRow
                    key={entry.workDate}
                    className={
                      entry.hasConflict
                        ? 'bg-yellow-50 dark:bg-yellow-950/20'
                        : isWeekend || holiday
                          ? 'bg-muted/50'
                          : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={entry.selected}
                        onCheckedChange={() => handleToggleEntry(index)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatDate(entry.workDate)}
                      {holiday && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {holiday}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 w-full text-xs"
                        value={entry.startTime}
                        onChange={(e) =>
                          handleEntryChange(index, 'startTime', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 w-full text-xs"
                        value={entry.endTime}
                        onChange={(e) =>
                          handleEntryChange(index, 'endTime', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {entry.breakMinutes}m
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {entry.hours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-xs">
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      {entry.hasConflict && (
                        <Badge
                          variant="outline"
                          className="text-xs text-yellow-600"
                        >
                          上書き
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button variant="outline" asChild>
            <Link to={backUrl}>
              <ArrowLeftIcon className="mr-1 size-4" />
              キャンセル
            </Link>
          </Button>

          <Form method="POST">
            <input type="hidden" name="intent" value="saveAiSuggestions" />
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <input
              type="hidden"
              name="entries"
              value={JSON.stringify(
                selectedEntries.map((e) => ({
                  workDate: e.workDate,
                  startTime: e.startTime,
                  endTime: e.endTime,
                  breakMinutes: e.breakMinutes,
                  description: e.description,
                })),
              )}
            />
            <Button type="submit" disabled={selectedEntries.length === 0}>
              <SaveIcon className="mr-1 size-4" />
              {selectedEntries.length}件を保存
            </Button>
          </Form>
        </div>
      </ContentPanel>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { orgSlug, clientId } = useParams()
  const backUrl = `/org/${orgSlug}/work-hours/${clientId}`

  let title = 'エラーが発生しました'
  let message = '予期しないエラーが発生しました。'

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = '見つかりません'
      message =
        typeof error.data === 'string' ? error.data : 'リソースが見つかりません'
    } else if (error.status === 400) {
      title = 'パラメータエラー'
      message =
        typeof error.data === 'string'
          ? error.data
          : 'リクエストパラメータに問題があります'
    }
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="候補生成" />
      <ContentPanel>
        <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <AlertTriangleIcon className="text-muted-foreground size-10" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground max-w-md text-sm">{message}</p>
          <Button variant="outline" asChild>
            <Link to={backUrl}>
              <ArrowLeftIcon className="mr-1 size-4" />
              稼働時間に戻る
            </Link>
          </Button>
        </div>
      </ContentPanel>
    </div>
  )
}
