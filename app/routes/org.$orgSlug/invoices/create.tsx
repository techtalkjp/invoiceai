import { getFormProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import {
  getBillingDate,
  getPaymentDate,
  type PaymentTerms,
} from '@shared/core/invoice-utils'
import {
  getExpensePreview,
  type ExpensePreviewLine,
  type ExpensePreviewResult,
} from '@shared/services/expense-billing/expense-preview-service'
import {
  buildExpenseLineSnapshot,
  buildWorkLineSnapshot,
  markExpenseRecordsAdjusted,
  saveInvoiceLines,
} from '@shared/services/expense-billing/invoice-line-snapshot'
import {
  createClientInvoice,
  updateClientInvoice,
} from '@shared/services/invoice-service'
import { Form, Link, useActionData, useNavigation } from 'react-router'
import { BillingTypeBadge } from '~/components/billing-type-badge'
import { ContentPanel } from '~/components/layout/content-panel'
import { PageHeader } from '~/components/layout/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { requireOrgMember } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import { getFreeeClientForOrganization } from '~/utils/freee.server'
import {
  formatYearMonth,
  getNowInTimezone,
  getPreviousMonth,
  getRecentMonths,
  parseYearMonthId,
} from '~/utils/month'
import {
  getClientWorkHoursFromDb,
  getInvoiceByYearMonth,
  getPreviousMonthInvoice,
  saveInvoiceToDb,
} from './+queries.server'
import { invoiceCreateSchema } from './+schema'
import type { Route } from './+types/create'

export const handle = {
  breadcrumb: (data: { organization: { slug: string } }) => [
    { label: '月次請求', to: `/org/${data.organization.slug}/invoices` },
    { label: '請求書作成' },
  ],
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgMember(request, orgSlug)

  const url = new URL(request.url)
  const now = getNowInTimezone(organization.timezone)
  const prev = getPreviousMonth(now)
  const prevMonthId = formatYearMonth(prev.year, prev.month)
  const months = getRecentMonths(12, now)

  const yearMonthParam = url.searchParams.get('yearMonth')
  const clientIdParam = url.searchParams.get('clientId')

  const defaultYearMonth =
    months.find((m) => m.id === yearMonthParam)?.id ?? prevMonthId

  // 組織のクライアント一覧を取得
  const clients = await db
    .selectFrom('client')
    .select([
      'id',
      'name',
      'billingType',
      'monthlyFee',
      'hourlyRate',
      'unitLabel',
      'roundingMethod',
    ])
    .where('organizationId', '=', organization.id)
    .where('isActive', '=', 1)
    .orderBy('name', 'asc')
    .execute()

  const firstClient = clients[0]
  const defaultClientId =
    clients.find((c) => c.id === clientIdParam)?.id ?? firstClient?.id ?? ''

  // 既存請求書を取得（編集モード判定）
  let existingInvoice: Awaited<ReturnType<typeof getInvoiceByYearMonth>> = null
  if (clientIdParam && yearMonthParam) {
    const { year, month } = parseYearMonthId(yearMonthParam)
    existingInvoice = await getInvoiceByYearMonth(
      organization.id,
      clientIdParam,
      year,
      month,
    )
  }

  // 経費プレビューを取得
  let expensePreview: ExpensePreviewResult | null = null
  if (defaultClientId && defaultYearMonth) {
    const { year, month } = parseYearMonthId(defaultYearMonth)
    const selectedClient = clients.find((c) => c.id === defaultClientId)

    expensePreview = await getExpensePreview({
      organizationId: organization.id,
      clientId: defaultClientId,
      yearMonth: formatYearMonth(year, month),
      roundingMethod:
        (selectedClient?.roundingMethod as 'round' | 'floor' | 'ceil') ??
        'round',
    })
  }

  return {
    organization,
    clients,
    months,
    defaultYearMonth,
    defaultClientId,
    prevMonthId,
    existingInvoice,
    expensePreview,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgMember(request, orgSlug)

  const submission = parseWithZod(await request.formData(), {
    schema: invoiceCreateSchema,
  })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const input = submission.value

  // クライアントを取得
  const client = await db
    .selectFrom('client')
    .selectAll()
    .where('id', '=', input.clientId)
    .where('organizationId', '=', organization.id)
    .executeTakeFirst()

  if (!client) {
    return {
      lastResult: submission.reply({
        formErrors: [`クライアント "${input.clientId}" が見つかりません`],
      }),
    }
  }

  if (!organization.freeeCompanyId) {
    return {
      lastResult: submission.reply({
        formErrors: ['freee 会社IDが設定されていません'],
      }),
    }
  }

  const freeeCompanyId = organization.freeeCompanyId

  // billing type に応じたバリデーション
  if (client.billingType === 'time' && !client.hourlyRate) {
    return {
      lastResult: submission.reply({
        formErrors: ['クライアントの時間単価が設定されていません'],
      }),
    }
  }
  if (client.billingType === 'fixed' && !client.monthlyFee) {
    return {
      lastResult: submission.reply({
        formErrors: ['クライアントの月額が設定されていません'],
      }),
    }
  }
  if (!client.freeePartnerId) {
    return {
      lastResult: submission.reply({
        formErrors: ['クライアントの freee 取引先IDが設定されていません'],
      }),
    }
  }

  try {
    const freee = await getFreeeClientForOrganization(organization.id)

    // DB から稼働時間を取得（時間制の場合のみ使用）
    const { totalHours } = await getClientWorkHoursFromDb(
      organization.id,
      client.id,
      input.yearMonth.year,
      input.yearMonth.month,
    )

    // InvoiceClient 型に変換
    const clientConfig = {
      freeePartnerId: client.freeePartnerId,
      invoiceSubjectTemplate:
        client.invoiceSubjectTemplate ?? `${client.name} {year}年{month}月`,
      invoiceNote: client.invoiceNote ?? '',
      billingType: client.billingType as 'time' | 'fixed',
      ...(client.hourlyRate != null && { hourlyRate: client.hourlyRate }),
      ...(client.monthlyFee != null && { monthlyFee: client.monthlyFee }),
      unitLabel: client.unitLabel ?? '式',
      paymentTerms: (client.paymentTerms as PaymentTerms) ?? 'next_month_end',
    }

    const freeeInvoiceId = input.freeeInvoiceId
    const isUpdate = freeeInvoiceId != null

    // 共通の deps（PDF は今回使わないので除外）
    const baseDeps = {
      getCompanyId: () => freeeCompanyId,
      getTemplateId: () => organization.freeeTemplateId,
      getTotalHours: () => totalHours,
      getPreviousInvoice: async () => {
        if (!client.freeePartnerId) return null
        const prev = await getPreviousMonthInvoice(
          organization.id,
          freeeCompanyId,
          client.freeePartnerId,
          input.yearMonth.year,
          input.yearMonth.month,
        )
        if (!prev) return null
        return {
          subject: prev.subject,
          invoice_note: prev.invoice_note,
          memo: prev.memo,
          tax_entry_method: prev.tax_entry_method,
          partner_title: prev.partner_title,
          withholding_tax_entry_method: prev.withholding_tax_entry_method,
        }
      },
    }

    // 新規作成 or 更新
    const result = isUpdate
      ? await updateClientInvoice(
          freeeInvoiceId,
          clientConfig,
          input.yearMonth.year,
          input.yearMonth.month,
          {
            ...baseDeps,
            createInvoice: freee.createInvoice,
            updateInvoice: freee.updateInvoice,
          },
        )
      : await createClientInvoice(
          clientConfig,
          input.yearMonth.year,
          input.yearMonth.month,
          {
            ...baseDeps,
            createInvoice: freee.createInvoice,
          },
        )

    // DB に保存
    if (result.invoice) {
      const { year, month } = input.yearMonth
      const yearMonth = formatYearMonth(year, month)
      const subject =
        client.invoiceSubjectTemplate
          ?.replace('{year}', String(year))
          .replace('{month}', String(month)) ??
        `${client.name} ${year}年${month}月`

      const invoiceRecord = await saveInvoiceToDb({
        organizationId: organization.id,
        clientId: client.id,
        year,
        month,
        freeeInvoiceId: result.invoice.id,
        freeeInvoiceNumber: result.invoice.number,
        billingType: client.billingType as 'time' | 'fixed',
        hourlyRate: client.hourlyRate,
        monthlyFee: client.monthlyFee,
        subject,
        ...(client.invoiceNote && { note: client.invoiceNote }),
        billingDate: getBillingDate(year, month),
        paymentDate: getPaymentDate(
          year,
          month,
          client.paymentTerms as PaymentTerms,
        ),
        amountExcludingTax: result.amount,
        amountTax: result.invoice.amountTax,
        totalAmount: result.invoice.totalAmount,
        status: result.invoice.sendingStatus,
      })

      // invoice_line に凍結保存（稼働行 + 経費行）
      if (invoiceRecord) {
        const invoiceId = invoiceRecord.id
        const snapshotLines = []

        // 稼働行
        snapshotLines.push(
          buildWorkLineSnapshot({
            invoiceId,
            description: `${subject}分`,
            quantity: client.billingType === 'time' ? result.totalHours : 1,
            unit:
              client.billingType === 'time'
                ? '時間'
                : (client.unitLabel ?? '式'),
            unitPrice:
              client.billingType === 'time'
                ? (client.hourlyRate ?? 0)
                : (client.monthlyFee ?? 0),
            taxRate: 10,
          }),
        )

        // 経費行
        const expensePreview = await getExpensePreview({
          organizationId: organization.id,
          clientId: client.id,
          yearMonth,
          roundingMethod:
            (client.roundingMethod as 'round' | 'floor' | 'ceil') ?? 'round',
        })

        for (const line of expensePreview.lines) {
          snapshotLines.push(buildExpenseLineSnapshot({ invoiceId, line }))
        }

        await saveInvoiceLines(snapshotLines)

        // 差額調整の expense_record をマーク
        const adjustmentLines = expensePreview.lines.filter(
          (l) => l.expenseKind === 'adjustment',
        )
        if (adjustmentLines.length > 0) {
          await markExpenseRecordsAdjusted(invoiceId, adjustmentLines)
        }
      }
    }

    return {
      ok: true,
      isUpdate,
      invoice: result.invoice,
      amount: result.amount,
      totalHours: result.totalHours,
      billingType: client.billingType,
    }
  } catch (error) {
    console.error('Invoice creation error:', error)
    const message =
      error instanceof Error ? error.message : '請求書の処理に失敗しました'
    return {
      lastResult: submission.reply({
        formErrors: [message],
      }),
    }
  }
}

export default function InvoiceCreate({
  loaderData: {
    clients,
    months,
    defaultYearMonth,
    defaultClientId,
    prevMonthId,
    existingInvoice,
    expensePreview,
  },
  params: { orgSlug },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const isEditMode = existingInvoice != null
  const [form, fields] = useForm({
    lastResult:
      actionData && 'lastResult' in actionData
        ? actionData.lastResult
        : undefined,
    defaultValue: {
      clientId: defaultClientId,
      yearMonth: defaultYearMonth,
      freeeInvoiceId: existingInvoice?.freeeInvoiceId?.toString(),
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: invoiceCreateSchema }),
    shouldRevalidate: 'onBlur',
  })

  const selectedMonth = fields.yearMonth.value ?? defaultYearMonth
  const isPrevMonth = selectedMonth === prevMonthId
  const selectedClientId = fields.clientId.value ?? defaultClientId
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  if (clients.length === 0) {
    return (
      <div className="grid gap-4">
        <PageHeader
          title="請求書作成"
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
        title={isEditMode ? '請求書編集' : '請求書作成'}
        subtitle={
          isEditMode
            ? '既存の請求書を更新します。'
            : '対象クライアントと月を指定して請求書を作成します。'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={isPrevMonth ? 'default' : 'outline'}>
              {isPrevMonth ? '前月' : '前月から変更'}
            </Badge>
            {!isPrevMonth && (
              <span className="text-destructive">
                対象年月の取り違えに注意してください
              </span>
            )}
            {isEditMode && existingInvoice?.freeeInvoiceId && (
              <a
                href={`https://invoice.secure.freee.co.jp/reports/invoices/${existingInvoice.freeeInvoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                freee で確認 ↗
              </a>
            )}
          </div>
        }
      />
      <ContentPanel className="p-6">
        <Form
          method="post"
          {...getFormProps(form)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="grid gap-2">
            <Label htmlFor={fields.clientId.id}>クライアント</Label>
            <Select
              key={fields.clientId.key}
              name={fields.clientId.name}
              defaultValue={defaultClientId}
            >
              <SelectTrigger id={fields.clientId.id} className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <span className="flex items-center gap-2">
                        {client.name}
                        <BillingTypeBadge billingType={client.billingType} />
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="text-destructive text-sm empty:hidden">
              {fields.clientId.errors}
            </div>
            {selectedClient && (
              <div className="text-muted-foreground text-sm">
                {selectedClient.billingType === 'time'
                  ? `時間単価: ¥${selectedClient.hourlyRate?.toLocaleString() ?? '未設定'}/h`
                  : `月額: ¥${selectedClient.monthlyFee?.toLocaleString() ?? '未設定'}`}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={fields.yearMonth.id}>対象月</Label>
            <Select
              key={fields.yearMonth.key}
              name={fields.yearMonth.name}
              defaultValue={defaultYearMonth}
            >
              <SelectTrigger id={fields.yearMonth.id} className="w-full">
                <SelectValue placeholder="対象月を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {months.map((monthItem) => (
                    <SelectItem key={monthItem.id} value={monthItem.id}>
                      {monthItem.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="text-destructive text-sm empty:hidden">
              {fields.yearMonth.errors}
            </div>
          </div>
          {form.errors && (
            <div className="bg-destructive/10 text-destructive col-span-full rounded-md p-3 text-sm">
              {form.errors}
            </div>
          )}
          {isEditMode && existingInvoice?.freeeInvoiceId && (
            <input
              type="hidden"
              name="freeeInvoiceId"
              value={existingInvoice.freeeInvoiceId}
            />
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? '更新中...'
                  : '作成中...'
                : isEditMode
                  ? '更新'
                  : '作成'}
            </Button>
          </div>
        </Form>
      </ContentPanel>
      {/* 経費プレビュー */}
      {expensePreview && expensePreview.lines.length > 0 && (
        <ContentPanel className="space-y-3 p-6">
          <h3 className="text-sm font-semibold">経費明細プレビュー</h3>
          {Object.entries(expensePreview.exchangeRates).length > 0 && (
            <div className="text-muted-foreground text-xs">
              {Object.entries(expensePreview.exchangeRates).map(
                ([pair, info]: [
                  string,
                  { rate: string; rateDate: string; source: string },
                ]) => (
                  <span key={pair}>
                    {pair}: {info.rate} 円（
                    {info.source === 'manual'
                      ? '手動設定'
                      : `日銀TTM ${info.rateDate}`}
                    ）
                  </span>
                ),
              )}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">摘要</th>
                <th className="py-1 text-right">外貨</th>
                <th className="py-1 text-right">金額（円）</th>
              </tr>
            </thead>
            <tbody>
              {(expensePreview.lines as ExpensePreviewLine[]).map(
                (line: ExpensePreviewLine, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">
                      {line.description}
                      {line.isProvisional && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          （暫定値）
                        </span>
                      )}
                      {line.expenseKind === 'adjustment' && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          差額調整
                        </Badge>
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {line.currency !== 'JPY'
                        ? `${line.currency} ${line.amountForeign}`
                        : ''}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      ¥{line.amountJpy.toLocaleString()}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {expensePreview.errors.length > 0 && (
            <div className="text-destructive text-xs">
              {(expensePreview.errors as Array<{ error: string }>).map(
                (e: { error: string }, i: number) => (
                  <div key={i}>{e.error}</div>
                ),
              )}
            </div>
          )}
        </ContentPanel>
      )}

      {actionData && 'ok' in actionData && actionData.ok && (
        <ContentPanel className="space-y-1 p-6">
          <div className="text-lg font-semibold">
            {actionData.isUpdate ? '更新完了' : '作成完了'}
          </div>
          {actionData.billingType === 'time' && (
            <p className="text-sm">稼働時間: {actionData.totalHours} 時間</p>
          )}
          <p className="text-sm">
            金額: ¥{actionData.amount.toLocaleString()}（税抜）
          </p>
          {actionData.invoice && (
            <>
              <p className="text-sm">請求書番号: {actionData.invoice.number}</p>
              <p className="text-sm">
                <a
                  href={`https://invoice.secure.freee.co.jp/reports/invoices/${actionData.invoice.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  freee で確認 ↗
                </a>
              </p>
            </>
          )}
        </ContentPanel>
      )}
    </div>
  )
}
