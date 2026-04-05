import { parseSubmission, report } from '@conform-to/react/future'
import { coerceFormValue, formatResult } from '@conform-to/zod/v4/future'
import {
  deleteProviderCredential,
  hasProviderCredential,
  saveProviderCredential,
} from '@shared/services/expense-billing/metered-provider'
import {
  ChevronDownIcon,
  CloudIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ServerIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import {
  deleteExpenseGroup,
  deleteExpenseItem,
  upsertExpenseGroup,
  upsertExpenseItem,
} from './+mutations.server'
import { getExpenseGroups, getExpenseItems } from './+queries.server'
import { expenseFormSchema } from './+schema'
import type { Route } from './+types/expenses'

function safeParseJson(str: string | null): Record<string, string> | undefined {
  if (!str) return undefined
  try {
    return JSON.parse(str) as Record<string, string>
  } catch {
    return undefined
  }
}

function buildInvoiceLabel(name: string, currency: string): string {
  if (currency === 'JPY') return `${name} {year}年{month}月`
  const c = currency === 'USD' ? 'ドル' : currency
  return `${name} {year}年{month}月 (月{amount_foreign}${c}:${c}円{rate}円換算)`
}

function formatCurrency(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (currency === 'JPY') return `¥${n.toLocaleString()}`
  if (currency === 'USD')
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  return `${currency} ${amount}`
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)
  const [groups, items, hasGcpCredential] = await Promise.all([
    getExpenseGroups(organization.id, clientId),
    getExpenseItems(organization.id, clientId),
    hasProviderCredential(organization.id, 'google_cloud_billing'),
  ])
  return { groups, items, organizationId: organization.id, hasGcpCredential }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)
  const formData = await request.formData()
  const submission = parseSubmission(formData)
  const result = coerceFormValue(expenseFormSchema).safeParse(
    submission.payload,
  )
  const error = formatResult(result)
  if (!result.success) return { lastResult: report(submission, { error }) }

  const data = result.data
  switch (data.intent) {
    case 'createGroupWithItems': {
      const groupId = await upsertExpenseGroup(organization.id, clientId, {
        name: data.name,
        invoiceLabel: data.invoiceLabel,
        currency: data.currency,
        taxRate: data.taxRate,
        sortOrder: data.sortOrder,
      })
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i]
        if (!item) continue
        await upsertExpenseItem(organization.id, clientId, {
          groupId,
          name: item.name === '__inherit__' ? data.name : item.name,
          type: item.type,
          currency: data.currency,
          monthlyAmount: item.monthlyAmount,
          sortOrder: i,
        })
      }
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'upsertGroup': {
      await upsertExpenseGroup(organization.id, clientId, {
        id: data.groupId || undefined,
        name: data.name,
        invoiceLabel: data.invoiceLabel,
        currency: data.currency,
        taxRate: data.taxRate,
        sortOrder: data.sortOrder,
      })
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'deleteGroup': {
      await deleteExpenseGroup(organization.id, clientId, data.groupId)
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'upsertItem': {
      const groupId =
        data.groupId && data.groupId !== '__none__' ? data.groupId : null
      let providerConfig: string | undefined
      if (data.type === 'metered') {
        const bqProject = formData.get('__bqProject')
        const bqDataset = formData.get('__bqDataset')
        const bqTable = formData.get('__bqTable')
        const gcpProjectId = formData.get('__gcpProjectId')
        const serviceFilter = formData.get('__serviceFilter')
        if (bqProject && bqDataset && bqTable && gcpProjectId) {
          providerConfig = JSON.stringify({
            bigqueryProject: String(bqProject),
            bigqueryDataset: String(bqDataset),
            bigqueryTable: String(bqTable),
            projectId: String(gcpProjectId),
            ...(serviceFilter ? { serviceFilter: String(serviceFilter) } : {}),
          })
        }
      }
      await upsertExpenseItem(organization.id, clientId, {
        id: data.itemId || undefined,
        groupId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        monthlyAmount: data.monthlyAmount,
        provider: data.type === 'metered' ? 'google_cloud' : undefined,
        providerConfig,
        taxRate: data.taxRate,
        sortOrder: data.sortOrder,
      })
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'deleteItem': {
      await deleteExpenseItem(organization.id, clientId, data.itemId)
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'saveCredential': {
      await saveProviderCredential(
        organization.id,
        data.provider,
        data.credentialsJson,
      )
      return { lastResult: report(submission, { error }), success: true }
    }
    case 'deleteCredential': {
      await deleteProviderCredential(organization.id, data.provider)
      return { lastResult: report(submission, { error }), success: true }
    }
  }
}

function useFetcherDialog(
  key: string,
  open: boolean,
  onOpenChange: (v: boolean) => void,
) {
  const fetcher = useFetcher({ key })
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && open) onOpenChange(false)
  }, [fetcher.state, fetcher.data, open, onOpenChange])
  return fetcher
}

function ExpenseCard({
  group,
  items,
  onEdit,
  onDelete,
  onAddBreakdown,
  onEditItem,
  onDeleteItem,
}: {
  group: {
    id: string
    name: string
    currency: string
    taxRate: number
    invoiceLabel: string
    sortOrder: number
  }
  items: Array<{
    id: string
    name: string
    type: string
    currency: string
    monthlyAmount: string | null
    provider: string | null
    providerConfig: string | null
  }>
  onEdit: () => void
  onDelete: () => void
  onAddBreakdown: () => void
  onEditItem: (id: string) => void
  onDeleteItem: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasBreakdown = items.length > 1
  const singleItem = items.length === 1 ? items[0] : null
  const singleItemConfig = singleItem
    ? safeParseJson(singleItem.providerConfig)
    : undefined
  const totalAmount = items.reduce(
    (sum, i) => sum + Number(i.monthlyAmount ?? 0),
    0,
  )
  const isMetered = items.some((i) => i.type === 'metered')

  return (
    <div className="group bg-card rounded-lg border transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
              {isMetered ? (
                <CloudIcon className="text-muted-foreground size-4" />
              ) : (
                <ServerIcon className="text-muted-foreground size-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate leading-tight font-medium">
                {group.name}
              </h3>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <span>{group.currency}</span>
                <span>·</span>
                <span>税率 {group.taxRate}%</span>
                {hasBreakdown && (
                  <>
                    <span>·</span>
                    <span>{items.length}項目</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            {isMetered ? (
              <Badge variant="secondary" className="text-xs font-normal">
                自動取得
              </Badge>
            ) : (
              <span className="text-lg font-semibold tabular-nums">
                {formatCurrency(String(totalAmount), group.currency)}
              </span>
            )}
            {!isMetered && (
              <div className="text-muted-foreground text-xs">/月</div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>編集</DropdownMenuItem>
              {!hasBreakdown && (
                <DropdownMenuItem onClick={onAddBreakdown}>
                  内訳を追加
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasBreakdown && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="text-muted-foreground hover:bg-muted/50 flex w-full items-center gap-1 border-t px-4 py-2 text-xs transition-colors">
            <ChevronDownIcon
              className={`size-3 transition-transform ${expanded ? '' : '-rotate-90'}`}
            />
            内訳を{expanded ? '閉じる' : '見る'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 px-4 pb-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group/item hover:bg-muted/50 flex items-center justify-between rounded px-2 py-1 text-sm"
                >
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {item.type === 'metered'
                        ? '自動取得'
                        : formatCurrency(item.monthlyAmount, item.currency)}
                    </span>
                    <div className="flex gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => onEditItem(item.id)}
                      >
                        <MoreHorizontalIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-6"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="text-muted-foreground hover:border-primary hover:text-primary mt-1 flex w-full items-center justify-center gap-1 rounded border border-dashed py-1.5 text-xs transition-colors"
                onClick={onAddBreakdown}
              >
                <PlusIcon className="size-3" />
                内訳を追加
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {singleItem && singleItem.type === 'metered' && singleItem.provider && (
        <div className="text-muted-foreground border-t px-4 py-2 text-xs">
          {singleItem.provider === 'google_cloud' ? 'GCP' : singleItem.provider}
          {singleItemConfig?.projectId && ` · ${singleItemConfig.projectId}`}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  onAddFixed,
  onAddMetered,
}: {
  onAddFixed: () => void
  onAddMetered: () => void
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <ServerIcon className="text-muted-foreground size-6" />
      </div>
      <h3 className="mt-4 font-medium">経費はまだ登録されていません</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        毎月の固定費やクラウドサービスの利用料を登録すると、請求書に自動で反映されます。
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={onAddFixed}>
          <PlusIcon className="size-4" />
          固定費を追加
        </Button>
        <Button variant="outline" onClick={onAddMetered}>
          <CloudIcon className="size-4" />
          利用料を自動取得
        </Button>
      </div>
    </div>
  )
}

function AddExpenseDialog({
  open,
  onOpenChange,
  mode,
  hasGcpCredential,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'fixed' | 'metered'
  hasGcpCredential: boolean
}) {
  const fetcher = useFetcherDialog('add-expense', open, onOpenChange)
  const labelRef = useRef<HTMLInputElement>(null)
  const [credentialJson, setCredentialJson] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [meteredName, setMeteredName] = useState('')

  function handleOpenChange(v: boolean) {
    if (!v) {
      setStep(1)
      setMeteredName('')
      setCredentialJson('')
    }
    onOpenChange(v)
  }

  function autoLabel() {
    const form = labelRef.current?.closest('form')
    if (!form) return
    const name = (form.elements.namedItem('name') as HTMLInputElement)?.value
    const currency = (form.elements.namedItem('currency') as HTMLInputElement)
      ?.value
    if (name && currency && labelRef.current && !labelRef.current.value) {
      labelRef.current.value = buildInvoiceLabel(name, currency)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'fixed' ? '固定費を追加' : '利用料の自動取得'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'fixed'
              ? '毎月固定で発生する経費を登録します。'
              : step === 1
                ? '名前を入力してください。'
                : 'GCP Billing Export の接続設定を入力してください。'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'metered' && !hasGcpCredential ? (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="saveCredential" />
            <input type="hidden" name="provider" value="google_cloud_billing" />
            <div className="bg-muted/50 rounded-md p-4">
              <p className="text-sm font-medium">
                GCP サービスアカウントの設定
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                BigQuery Billing Export の読み取りに必要です。
              </p>
            </div>
            <div>
              <Label>サービスアカウント JSON</Label>
              <textarea
                name="credentialsJson"
                value={credentialJson}
                onChange={(e) => setCredentialJson(e.target.value)}
                className="border-input bg-background mt-1 h-28 w-full rounded-md border px-3 py-2 font-mono text-xs"
                placeholder="JSON キーをペースト"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!credentialJson.trim()}>
                設定して続ける
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.json'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) setCredentialJson(await file.text())
                  }
                  input.click()
                }}
              >
                <UploadIcon className="size-4" />
                ファイル
              </Button>
            </div>
          </fetcher.Form>
        ) : mode === 'metered' && step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-name">名前</Label>
              <Input
                id="add-name"
                value={meteredName}
                onChange={(e) => setMeteredName(e.target.value)}
                placeholder="Gemini API利用料"
              />
            </div>
            <Button
              className="w-full"
              disabled={!meteredName.trim()}
              onClick={() => setStep(2)}
            >
              次へ
            </Button>
          </div>
        ) : (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="createGroupWithItems" />
            {mode === 'metered' && (
              <input type="hidden" name="name" value={meteredName} />
            )}
            {mode === 'fixed' && (
              <div>
                <Label htmlFor="add-name">名前</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="サーバ通信費"
                  required
                  onBlur={autoLabel}
                />
              </div>
            )}

            {mode === 'fixed' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="add-amount">月額</Label>
                  <Input
                    id="add-amount"
                    name="items[0].monthlyAmount"
                    placeholder="45.00"
                    required
                  />
                  <input
                    type="hidden"
                    name="items[0].name"
                    value="__inherit__"
                  />
                  <input type="hidden" name="items[0].type" value="fixed" />
                </div>
                <div>
                  <Label>通貨</Label>
                  <Select
                    name="currency"
                    defaultValue="USD"
                    onValueChange={() => setTimeout(autoLabel, 0)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <input type="hidden" name="currency" value="JPY" />
                <input type="hidden" name="items[0].name" value="__inherit__" />
                <input type="hidden" name="items[0].type" value="metered" />
                <div className="bg-muted/50 space-y-3 rounded-md p-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    GCP Billing Export 設定
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">BigQuery プロジェクト</Label>
                      <Input
                        name="__bqProject"
                        placeholder="techtalk-380714"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">データセット</Label>
                      <Input
                        name="__bqDataset"
                        placeholder="techtalk"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">テーブル名</Label>
                    <Input
                      name="__bqTable"
                      placeholder="gcp_billing_export_v1_..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">GCP プロジェクトID</Label>
                      <Input
                        name="__gcpProjectId"
                        placeholder="dailove-search"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        サービスフィルタ（任意）
                      </Label>
                      <Input
                        name="__serviceFilter"
                        placeholder="Cloud AI API"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <input type="hidden" name="taxRate" value="10" />
            <input type="hidden" name="sortOrder" value="0" />
            <input ref={labelRef} type="hidden" name="invoiceLabel" value="" />

            <div className="flex gap-2">
              {mode === 'metered' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  戻る
                </Button>
              )}
              <Button type="submit" className="flex-1">
                追加
              </Button>
            </div>
          </fetcher.Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditExpenseDialog({
  group,
  open,
  onOpenChange,
}: {
  group: {
    id: string
    name: string
    invoiceLabel: string
    currency: string
    taxRate: number
    sortOrder: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcherDialog(
    `edit-expense-${group.id}`,
    open,
    onOpenChange,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>経費を編集</DialogTitle>
        </DialogHeader>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="upsertGroup" />
          <input type="hidden" name="groupId" value={group.id} />
          <div>
            <Label>名前</Label>
            <Input name="name" defaultValue={group.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>通貨</Label>
              <Select name="currency" defaultValue={group.currency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>税率</Label>
              <Select name="taxRate" defaultValue={String(group.taxRate)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="8">8%</SelectItem>
                  <SelectItem value="0">0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>請求書テンプレート</Label>
            <Input
              name="invoiceLabel"
              defaultValue={group.invoiceLabel}
              required
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {'{year}'}, {'{month}'}, {'{amount_foreign}'}, {'{rate}'}{' '}
              が使えます
            </p>
          </div>
          <input type="hidden" name="sortOrder" value={group.sortOrder} />
          <Button type="submit" className="w-full">
            保存
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

function AddBreakdownDialog({
  group,
  open,
  onOpenChange,
}: {
  group: { id: string; name: string; currency: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcherDialog(
    `add-breakdown-${group.id}`,
    open,
    onOpenChange,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>内訳を追加</DialogTitle>
          <DialogDescription>{group.name} の内訳項目</DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="upsertItem" />
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="type" value="fixed" />
          <input type="hidden" name="currency" value={group.currency} />
          <input type="hidden" name="sortOrder" value="0" />
          <div>
            <Label>名前</Label>
            <Input name="name" placeholder="Vercel" required />
          </div>
          <div>
            <Label>月額</Label>
            <Input name="monthlyAmount" placeholder="20.00" required />
          </div>
          <Button type="submit" className="w-full">
            追加
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

function useDeleteAction() {
  const fetcher = useFetcher({ key: 'delete-expense' })

  function deleteGroup(groupId: string) {
    if (!confirm('この経費を削除しますか？配下の内訳もすべて削除されます。'))
      return
    const formData = new FormData()
    formData.set('intent', 'deleteGroup')
    formData.set('groupId', groupId)
    fetcher.submit(formData, { method: 'post' })
  }

  function deleteItem(itemId: string) {
    if (!confirm('この内訳を削除しますか？')) return
    const formData = new FormData()
    formData.set('intent', 'deleteItem')
    formData.set('itemId', itemId)
    fetcher.submit(formData, { method: 'post' })
  }

  return { deleteGroup, deleteItem }
}

export default function ExpenseSettings({
  loaderData: { groups, items, hasGcpCredential },
}: Route.ComponentProps) {
  const [addMode, setAddMode] = useState<'fixed' | 'metered' | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [breakdownGroupId, setBreakdownGroupId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const { deleteGroup, deleteItem } = useDeleteAction()

  const itemsByGroup = useMemo(() => {
    const map = new Map<string | null, typeof items>()
    for (const item of items) {
      const key = item.groupId
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }, [items])

  const hasExpenses = groups.length > 0
  const editingGroup = groups.find((g) => g.id === editingGroupId)
  const breakdownGroup = groups.find((g) => g.id === breakdownGroupId)
  const editingItem = items.find((i) => i.id === editingItemId) ?? null

  return (
    <div className="space-y-4">
      {hasExpenses ? (
        <>
          <div className="space-y-3">
            {groups.map((group) => {
              const groupItems = itemsByGroup.get(group.id) ?? []
              return (
                <ExpenseCard
                  key={group.id}
                  group={group}
                  items={groupItems}
                  onEdit={() => setEditingGroupId(group.id)}
                  onDelete={() => deleteGroup(group.id)}
                  onAddBreakdown={() => setBreakdownGroupId(group.id)}
                  onEditItem={(id) => setEditingItemId(id)}
                  onDeleteItem={(id) => deleteItem(id)}
                />
              )
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMode('fixed')}
            >
              <PlusIcon className="size-4" />
              固定費を追加
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMode('metered')}
            >
              <CloudIcon className="size-4" />
              利用料を自動取得
            </Button>
          </div>

          {hasGcpCredential && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <div className="size-1.5 rounded-full bg-green-500" />
              GCP Billing 連携済み
            </div>
          )}
        </>
      ) : (
        <EmptyState
          onAddFixed={() => setAddMode('fixed')}
          onAddMetered={() => setAddMode('metered')}
        />
      )}

      <AddExpenseDialog
        open={addMode !== null}
        onOpenChange={(open) => !open && setAddMode(null)}
        mode={addMode ?? 'fixed'}
        hasGcpCredential={hasGcpCredential}
      />

      {editingGroup && (
        <EditExpenseDialog
          group={editingGroup}
          open={!!editingGroupId}
          onOpenChange={(open) => !open && setEditingGroupId(null)}
        />
      )}

      {breakdownGroup && (
        <AddBreakdownDialog
          group={breakdownGroup}
          open={!!breakdownGroupId}
          onOpenChange={(open) => !open && setBreakdownGroupId(null)}
        />
      )}

      {editingItem && (
        <EditItemDialog
          item={editingItem}
          open={!!editingItemId}
          onOpenChange={(open) => !open && setEditingItemId(null)}
        />
      )}
    </div>
  )
}

function EditItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: {
    id: string
    name: string
    groupId: string | null
    type: string
    currency: string
    monthlyAmount: string | null
    provider: string | null
    providerConfig: string | null
    taxRate: number | null
    sortOrder: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcherDialog(`edit-item-${item.id}`, open, onOpenChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>内訳を編集</DialogTitle>
        </DialogHeader>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="upsertItem" />
          <input type="hidden" name="itemId" value={item.id} />
          <input
            type="hidden"
            name="groupId"
            value={item.groupId ?? '__none__'}
          />
          <input type="hidden" name="type" value={item.type} />
          <input type="hidden" name="currency" value={item.currency} />
          <input type="hidden" name="sortOrder" value={item.sortOrder} />
          <div>
            <Label>名前</Label>
            <Input name="name" defaultValue={item.name} required />
          </div>
          {item.type === 'fixed' && (
            <div>
              <Label>月額</Label>
              <Input
                name="monthlyAmount"
                defaultValue={item.monthlyAmount ?? ''}
              />
            </div>
          )}
          {item.type === 'metered' && item.provider && (
            <div className="bg-muted/50 space-y-2 rounded-md p-3">
              <p className="text-muted-foreground text-xs font-medium">
                GCP Billing Export
              </p>
              <input type="hidden" name="provider" value="google_cloud" />
              {(() => {
                const config = safeParseJson(item.providerConfig)
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">プロジェクトID</Label>
                      <Input
                        name="__gcpProjectId"
                        defaultValue={config?.projectId ?? ''}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">サービスフィルタ</Label>
                      <Input
                        name="__serviceFilter"
                        defaultValue={config?.serviceFilter ?? ''}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">BQ プロジェクト</Label>
                      <Input
                        name="__bqProject"
                        defaultValue={config?.bigqueryProject ?? ''}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">BQ データセット</Label>
                      <Input
                        name="__bqDataset"
                        defaultValue={config?.bigqueryDataset ?? ''}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">BQ テーブル</Label>
                      <Input
                        name="__bqTable"
                        defaultValue={config?.bigqueryTable ?? ''}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          <Button type="submit" className="w-full">
            保存
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}
