import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BillingTypeBadge } from '~/components/billing-type-badge'
import { ContentPanel } from '~/components/content-panel'
import { ControlBar } from '~/components/control-bar'
import { PageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useSmartNavigation } from '~/hooks/use-smart-navigation'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import { buildInvoiceEmail } from '~/utils/email-template'
import {
  formatYearMonth,
  formatYearMonthLabel,
  getPreviousMonth,
  getRecentMonths,
  parseYearMonthId,
} from '~/utils/month'
import {
  getInvoicesByYearMonths,
  getWorkHoursByClientAndStaff,
} from './+queries.server'
import type { Route } from './+types/index'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const now = new Date()
  const prev = getPreviousMonth()
  const prevMonthId = formatYearMonth(prev.year, prev.month)
  const selectedMonthParam = url.searchParams.get('month')
  // 当月から過去12ヶ月を表示（月末に当月分の請求書を作ることもあるため）
  const months = getRecentMonths(12, now)
  const selectedMonth =
    months.find((m) => m.id === selectedMonthParam)?.id ?? prevMonthId

  // 組織のクライアント一覧を取得
  const clients = await db
    .selectFrom('client')
    .select(['id', 'name', 'billingType', 'monthlyFee', 'hourlyRate'])
    .where('organizationId', '=', organization.id)
    .where('isActive', '=', 1)
    .orderBy('name', 'asc')
    .execute()

  // 選択月の請求書情報を取得
  const invoices = await getInvoicesByYearMonths(organization.id, [
    selectedMonth,
  ])

  // クライアントごとにインデックス化
  const invoicesByClient: Record<
    string,
    { freeeInvoiceId: number; freeeInvoiceNumber: string | null }
  > = {}
  for (const inv of invoices) {
    if (inv.freeeInvoiceId == null) continue
    invoicesByClient[inv.clientId] = {
      freeeInvoiceId: inv.freeeInvoiceId,
      freeeInvoiceNumber: inv.freeeInvoiceNumber,
    }
  }

  // 選択された月のスタッフ別稼働時間を取得
  const { year: selectedYear, month: selectedMonthNum } =
    parseYearMonthId(selectedMonth)
  const timeBasedClientIds = clients
    .filter((c) => c.billingType === 'time')
    .map((c) => c.id)
  const workHoursByClient = await getWorkHoursByClientAndStaff(
    organization.id,
    timeBasedClientIds,
    selectedYear,
    selectedMonthNum,
  )

  // 進捗カウント
  const createdCount = clients.filter(
    (client) => invoicesByClient[client.id],
  ).length

  return {
    organization,
    clients,
    months,
    selectedMonth,
    prevMonthId,
    invoicesByClient,
    workHoursByClient,
    progress: { created: createdCount, total: clients.length },
  }
}

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied'>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={handleCopy}
    >
      {status === 'copied' ? (
        <CheckIcon className="h-3 w-3" />
      ) : (
        <CopyIcon className="h-3 w-3" />
      )}
    </Button>
  )
}

function EmailDialog({
  clientName,
  year,
  month,
}: {
  clientName: string
  year: number
  month: number
}) {
  const email = buildInvoiceEmail({ clientName, year, month })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          メール
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {clientName} - {formatYearMonthLabel(year, month)}{' '}
            メールテンプレート
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">件名</span>
              <CopyButton text={email.subject} />
            </div>
            <Textarea readOnly value={email.subject} className="min-h-12" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">本文</span>
              <CopyButton text={email.body} />
            </div>
            <Textarea readOnly value={email.body} className="min-h-40" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function MonthlyInvoices({
  loaderData: {
    organization,
    clients,
    months,
    selectedMonth,
    prevMonthId,
    invoicesByClient,
    workHoursByClient,
    progress,
  },
}: Route.ComponentProps) {
  const navigate = useNavigate()
  const orgSlug = organization.slug
  const baseUrl = `/org/${orgSlug}/invoices`
  useSmartNavigation({ autoSave: true, baseUrl })
  const { year, month } = parseYearMonthId(selectedMonth)
  const isPrevMonth = selectedMonth === prevMonthId

  function handleMonthChange(value: string) {
    navigate(`?month=${encodeURIComponent(value)}`)
  }

  if (clients.length === 0) {
    return (
      <div className="grid gap-4">
        <PageHeader
          title="月次請求"
          subtitle="クライアントが登録されていません。まず設定からクライアントを追加してください。"
        />
        <Button asChild>
          <Link to={`/org/${orgSlug}/settings`}>設定を開く</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="月次請求"
        subtitle="クライアントごとの請求書作成状況"
      />

      <ControlBar
        left={
          <>
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant={isPrevMonth ? 'default' : 'destructive'}>
              {isPrevMonth ? '前月' : '前月から変更'}
            </Badge>

            <Badge
              variant={
                progress.created === progress.total ? 'default' : 'outline'
              }
            >
              {progress.created}/{progress.total} 作成済み
            </Badge>
          </>
        }
      />

      <ContentPanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>クライアント</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>稼働時間</TableHead>
              <TableHead>タイムシート</TableHead>
              <TableHead>請求書</TableHead>
              <TableHead>メール</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const existingInvoice = invoicesByClient[client.id]
              const staffHours = workHoursByClient[client.id] ?? []
              const totalHours = staffHours.reduce(
                (sum, s) => sum + s.totalHours,
                0,
              )
              const invoiceLink = `/org/${orgSlug}/invoices/create?clientId=${encodeURIComponent(
                client.id,
              )}&yearMonth=${encodeURIComponent(selectedMonth)}`
              const timesheetPdfLink = `/org/${orgSlug}/invoices/timesheet-pdf/${encodeURIComponent(
                client.id,
              )}/${encodeURIComponent(selectedMonth)}`
              const freeeInvoiceLink = existingInvoice?.freeeInvoiceId
                ? `https://invoice.secure.freee.co.jp/reports/invoices/${existingInvoice.freeeInvoiceId}`
                : null

              return (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <BillingTypeBadge billingType={client.billingType} />
                  </TableCell>
                  <TableCell>
                    {client.billingType === 'time' ? (
                      <div className="text-sm">
                        <div className="font-medium">{totalHours}h</div>
                        {staffHours.length > 0 && (
                          <div className="text-muted-foreground text-xs">
                            {staffHours
                              .map((s) => `${s.userName} ${s.totalHours}h`)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.billingType === 'time' && totalHours > 0 && (
                      <Button asChild variant="outline" size="sm">
                        <a href={timesheetPdfLink} download>
                          PDF
                        </a>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {existingInvoice ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {existingInvoice.freeeInvoiceNumber ?? '作成済'}
                        </Badge>
                        {freeeInvoiceLink && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <a
                              href={freeeInvoiceLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="freeeで開く"
                            >
                              <ExternalLinkIcon className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button asChild variant="ghost" size="sm">
                          <Link to={invoiceLink}>編集</Link>
                        </Button>
                      </div>
                    ) : (
                      <Button asChild size="sm">
                        <Link to={invoiceLink}>作成</Link>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {existingInvoice && (
                      <EmailDialog
                        clientName={client.name}
                        year={year}
                        month={month}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ContentPanel>
    </div>
  )
}
