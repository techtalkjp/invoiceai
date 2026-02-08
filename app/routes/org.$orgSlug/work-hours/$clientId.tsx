import { parseWithZod } from '@conform-to/zod/v4'
import { PageHeader } from '~/components/layout/page-header'
import { getMonthDates } from '~/components/timesheet'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { parseWorkHoursText } from './+ai-parse.server'
import { toServerEntries } from './+components/data-mapping'
import { TextImportDialog } from './+components/text-import-dialog'
import { WorkHoursTimesheet } from './+components/work-hours-timesheet'
import { saveEntries, saveEntry, syncMonthEntries } from './+mutations.server'
import { getClientMonthEntries } from './+queries.server'
import { formSchema } from './+schema'
import type { Route } from './+types/$clientId'

// saveMonthData は楽観的更新（store が正）なので revalidation 不要
export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: {
  formData?: FormData
  defaultShouldRevalidate: boolean
}) {
  if (formData?.get('intent') === 'saveMonthData') {
    return false
  }
  return defaultShouldRevalidate
}

export const handle = {
  breadcrumb: (data: {
    organization: { slug: string }
    clientEntry: { clientName: string }
  }) => [
    {
      label: '稼働時間',
      to: `/org/${data.organization.slug}/work-hours`,
    },
    { label: data.clientEntry.clientName },
  ],
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')

  const now = new Date()
  const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam
    ? Number.parseInt(monthParam, 10)
    : now.getMonth() + 1

  const clientEntry = await getClientMonthEntries(
    organization.id,
    user.id,
    clientId,
    year,
    month,
  )

  if (!clientEntry) {
    throw new Response('クライアントが見つかりません', { status: 404 })
  }

  const monthDates = getMonthDates(year, month)

  return {
    organization,
    user: { name: user.name },
    year,
    month,
    monthDates,
    clientEntry,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization, user } = await requireOrgMember(request, orgSlug)

  const formData = await request.formData()

  // saveMonthData は FormData で直接送信される（conform 経由ではない）
  const intent = formData.get('intent')
  if (intent === 'saveMonthData') {
    const clientId = formData.get('clientId') as string
    const yearMonth = (formData.get('yearMonth') as string) || undefined
    const monthDataJson = formData.get('monthData') as string
    try {
      const monthData = JSON.parse(monthDataJson) as Record<
        string,
        {
          startTime: string
          endTime: string
          breakMinutes: number
          description: string
        }
      >
      const entries = toServerEntries(clientId, monthData)
      await syncMonthEntries(
        organization.id,
        user.id,
        clientId,
        entries,
        yearMonth,
      )
      return { success: true }
    } catch {
      return { success: false, error: '保存に失敗しました' }
    }
  }

  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), success: false }
  }

  if (submission.value.intent === 'saveEntry') {
    const {
      clientId,
      workDate,
      startTime,
      endTime,
      breakMinutes,
      description,
    } = submission.value
    await saveEntry(organization.id, user.id, {
      clientId,
      workDate,
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      breakMinutes,
      ...(description !== undefined && { description }),
    })
    return { lastResult: submission.reply(), success: true }
  }

  if (submission.value.intent === 'parseText') {
    const { text, year, month } = submission.value
    try {
      const result = await parseWorkHoursText(text, year, month)
      return {
        entries: result.entries,
        parseErrors: result.parseErrors,
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'AI解析に失敗しました',
        success: false,
      }
    }
  }

  if (submission.value.intent === 'saveEntries') {
    const { entries: entriesJson } = submission.value
    try {
      const entries = JSON.parse(entriesJson) as Array<{
        clientId: string
        workDate: string
        startTime?: string
        endTime?: string
        breakMinutes?: number
        description?: string
      }>
      await saveEntries(organization.id, user.id, entries)
      return { lastResult: submission.reply(), success: true }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '保存に失敗しました',
        success: false,
      }
    }
  }

  return { lastResult: submission.reply(), success: false }
}

export default function ClientWorkHours({
  loaderData: { organization, user, year, month, clientEntry },
  params: { orgSlug, clientId },
}: Route.ComponentProps) {
  return (
    <div className="grid gap-4">
      <PageHeader
        title={clientEntry.clientName}
        subtitle="セルをクリックして編集 · Tab/Enterで移動"
        actions={
          <TextImportDialog clientId={clientId} year={year} month={month} />
        }
      />

      <WorkHoursTimesheet
        clientId={clientId}
        clientEntry={clientEntry}
        year={year}
        month={month}
        organizationName={organization.name}
        clientName={clientEntry.clientName}
        staffName={user.name}
        buildUrl={(y, m) =>
          `/org/${orgSlug}/work-hours/${clientId}?year=${y}&month=${m}`
        }
      />
    </div>
  )
}
