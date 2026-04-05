import { parseSubmission, report } from '@conform-to/react/future'
import { coerceFormValue, formatResult } from '@conform-to/zod/v4/future'
import {
  deleteProviderCredential,
  hasProviderCredential,
  saveProviderCredential,
} from '@shared/services/expense-billing/metered-provider'
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { Form, useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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
import { useForm } from '~/lib/form'
import {
  deleteExpenseGroup,
  deleteExpenseItem,
  upsertExpenseGroup,
  upsertExpenseItem,
} from './+mutations.server'
import { getExpenseGroups, getExpenseItems } from './+queries.server'
import {
  createGroupWithItemsSchema,
  expenseFormSchema,
  upsertItemSchema,
} from './+schema'
import type { Route } from './+types/expenses'

function safeParseJson(str: string | null): Record<string, string> | undefined {
  if (!str) return undefined
  try {
    return JSON.parse(str) as Record<string, string>
  } catch {
    return undefined
  }
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

  if (!result.success) {
    return { lastResult: report(submission, { error }) }
  }

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
          name: item.name,
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

      // metered の場合、formData から provider config を組み立て
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

function buildInvoiceLabel(name: string, currency: string): string {
  if (currency === 'JPY') {
    return `${name} {year}年{month}月`
  }
  const currLabel = currency === 'USD' ? 'ドル' : currency
  return `${name} {year}年{month}月 (月{amount_foreign}${currLabel}:${currLabel}円{rate}円換算)`
}

function useFetcherDialog(
  key: string,
  open: boolean,
  onOpenChange: (v: boolean) => void,
) {
  const fetcher = useFetcher({ key })
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && open) {
      onOpenChange(false)
    }
  }, [fetcher.state, fetcher.data, open, onOpenChange])
  return fetcher
}

function DeleteButton({
  intent,
  idName,
  idValue,
  iconSize = 'size-4',
}: {
  intent: string
  idName: string
  idValue: string
  iconSize?: string | undefined
}) {
  const fetcher = useFetcher({ key: `${intent}-${idValue}` })
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name={idName} value={idValue} />
      <Button variant="ghost" size="icon" type="submit">
        <TrashIcon className={iconSize} />
      </Button>
    </fetcher.Form>
  )
}

function GroupFormFields({
  defaultValue,
}: {
  defaultValue?:
    | {
        name?: string | undefined
        invoiceLabel?: string | undefined
        currency?: string | undefined
        taxRate?: number | undefined
        sortOrder?: number | undefined
      }
    | undefined
}) {
  const labelRef = useRef<HTMLInputElement>(null)

  function updateLabel() {
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
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="group-name">グループ名</Label>
          <Input
            id="group-name"
            name="name"
            defaultValue={defaultValue?.name}
            placeholder="サーバ通信費"
            required
            onBlur={updateLabel}
          />
        </div>
        <div>
          <Label htmlFor="group-currency">通貨</Label>
          <Select
            name="currency"
            defaultValue={defaultValue?.currency ?? 'USD'}
            onValueChange={() => setTimeout(updateLabel, 0)}
          >
            <SelectTrigger id="group-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="JPY">JPY</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="group-label">請求書テンプレート</Label>
        <Input
          ref={labelRef}
          id="group-label"
          name="invoiceLabel"
          defaultValue={defaultValue?.invoiceLabel}
          placeholder="自動生成されます"
          required
        />
        <p className="text-muted-foreground mt-1 text-xs">
          グループ名と通貨を入力すると自動生成。手動編集も可。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="group-tax">税率</Label>
          <Select
            name="taxRate"
            defaultValue={String(defaultValue?.taxRate ?? 10)}
          >
            <SelectTrigger id="group-tax">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10%（課税）</SelectItem>
              <SelectItem value="8">8%（軽減税率）</SelectItem>
              <SelectItem value="0">0%（非課税）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="group-sort">表示順</Label>
          <Input
            id="group-sort"
            name="sortOrder"
            type="number"
            defaultValue={defaultValue?.sortOrder ?? 0}
          />
        </div>
      </div>
    </>
  )
}

function EditGroupDialog({
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
  const fetcher = useFetcherDialog(`edit-group-${group.id}`, open, onOpenChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>グループ編集</DialogTitle>
        </DialogHeader>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="upsertGroup" />
          <input type="hidden" name="groupId" value={group.id} />
          <GroupFormFields defaultValue={group} />
          <Button type="submit" size="sm">
            保存
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

function ProviderConfigFields({
  defaultConfig,
}: {
  defaultConfig?: Record<string, string> | undefined
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">BigQuery プロジェクト</Label>
          <Input
            name="__bqProject"
            defaultValue={defaultConfig?.bigqueryProject ?? ''}
            placeholder="techtalk-380714"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">データセット</Label>
          <Input
            name="__bqDataset"
            defaultValue={defaultConfig?.bigqueryDataset ?? ''}
            placeholder="techtalk"
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">テーブル名</Label>
        <Input
          name="__bqTable"
          defaultValue={defaultConfig?.bigqueryTable ?? ''}
          placeholder="gcp_billing_export_v1_..."
          className="h-7 text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">GCP プロジェクトID</Label>
          <Input
            name="__gcpProjectId"
            defaultValue={defaultConfig?.projectId ?? ''}
            placeholder="dailove-search"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">サービスフィルタ（任意）</Label>
          <Input
            name="__serviceFilter"
            defaultValue={defaultConfig?.serviceFilter ?? ''}
            placeholder="Cloud AI API"
            className="h-7 text-xs"
          />
        </div>
      </div>
      <input type="hidden" name="providerConfig" value="" />
      <p className="text-muted-foreground text-[10px]">
        ※ BigQuery Billing Export のテーブル情報を入力してください
      </p>
    </div>
  )
}

function GcpCredentialUpload() {
  const fetcher = useFetcher({ key: 'gcp-credential' })
  const [jsonContent, setJsonContent] = useState('')

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="saveCredential" />
      <input type="hidden" name="provider" value="google_cloud_billing" />
      <div>
        <Label htmlFor="sa-json" className="text-xs">
          サービスアカウント JSON キー
        </Label>
        <textarea
          id="sa-json"
          name="credentialsJson"
          value={jsonContent}
          onChange={(e) => setJsonContent(e.target.value)}
          className="border-input bg-background h-32 w-full rounded-md border px-3 py-2 font-mono text-xs"
          placeholder="JSON キーをペーストするか、ファイルをドロップ"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!jsonContent.trim()}>
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                const text = await file.text()
                setJsonContent(text)
              }
            }
            input.click()
          }}
        >
          ファイルから読み込み
        </Button>
      </div>
    </fetcher.Form>
  )
}

function EditItemDialog({
  item,
  groups,
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
  groups: Array<{ id: string; name: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcherDialog(`edit-item-${item.id}`, open, onOpenChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>項目編集</DialogTitle>
        </DialogHeader>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="upsertItem" />
          <input type="hidden" name="itemId" value={item.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>項目名</Label>
              <Input name="name" defaultValue={item.name} required />
            </div>
            <div>
              <Label>所属グループ</Label>
              <Select name="groupId" defaultValue={item.groupId ?? '__none__'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">単独</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>種別</Label>
              <Select name="type" defaultValue={item.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定</SelectItem>
                  <SelectItem value="metered">従量</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>通貨</Label>
              <Select name="currency" defaultValue={item.currency}>
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
              <Label>月額（固定の場合）</Label>
              <Input
                name="monthlyAmount"
                defaultValue={item.monthlyAmount ?? ''}
              />
            </div>
          </div>
          {item.type === 'metered' && (
            <div className="bg-muted/50 space-y-2 rounded-md p-3">
              <Label className="text-xs font-semibold">
                従量課金プロバイダ設定
              </Label>
              <input type="hidden" name="provider" value="google_cloud" />
              <ProviderConfigFields
                defaultConfig={safeParseJson(item.providerConfig)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>税率（単独の場合）</Label>
              <Select name="taxRate" defaultValue={String(item.taxRate ?? 10)}>
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
            <div>
              <Label>表示順</Label>
              <Input
                name="sortOrder"
                type="number"
                defaultValue={item.sortOrder}
              />
            </div>
          </div>
          <Button type="submit" size="sm">
            保存
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

export default function ExpenseSettings({
  loaderData: { groups, items, hasGcpCredential },
  actionData,
}: Route.ComponentProps) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const { form: groupForm } = useForm(createGroupWithItemsSchema, {
    lastResult:
      actionData && 'lastResult' in actionData
        ? actionData.lastResult
        : undefined,
  })

  const { form: itemForm } = useForm(upsertItemSchema, {
    lastResult:
      actionData && 'lastResult' in actionData
        ? actionData.lastResult
        : undefined,
  })

  const [newItems, setNewItems] = useState<
    Array<{
      id: string
      name: string
      type: 'fixed' | 'metered'
      monthlyAmount: string
    }>
  >([])

  const newItemNameRef = useRef<HTMLInputElement>(null)
  const newItemAmountRef = useRef<HTMLInputElement>(null)
  const [newItemType, setNewItemType] = useState<'fixed' | 'metered'>('fixed')

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">経費グループ</h3>
        {groups.map((group) => {
          const groupItems = items.filter((i) => i.groupId === group.id)
          return (
            <div key={group.id} className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {group.currency} / {groupItems.length}項目 / 税率{' '}
                    {group.taxRate}%
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingGroupId(group.id)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <DeleteButton
                    intent="deleteGroup"
                    idName="groupId"
                    idValue={group.id}
                  />
                </div>
              </div>
              <EditGroupDialog
                group={group}
                open={editingGroupId === group.id}
                onOpenChange={(o) => !o && setEditingGroupId(null)}
              />

              <div className="ml-4 space-y-1">
                {groupItems.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>
                        {item.name}{' '}
                        <span className="text-muted-foreground">
                          {item.type === 'fixed'
                            ? `${item.currency} ${item.monthlyAmount}`
                            : `metered (${item.provider ?? '未設定'})`}
                        </span>
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingItemId(item.id)}
                        >
                          <PencilIcon className="size-3" />
                        </Button>
                        <DeleteButton
                          intent="deleteItem"
                          idName="itemId"
                          idValue={item.id}
                          iconSize="size-3"
                        />
                      </div>
                    </div>
                    <EditItemDialog
                      item={item}
                      groups={groups}
                      open={editingItemId === item.id}
                      onOpenChange={(o) => !o && setEditingItemId(null)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {items
          .filter((i) => !i.groupId)
          .map((item) => (
            <div key={item.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.currency} /{' '}
                    {item.type === 'fixed'
                      ? `${item.monthlyAmount}/月`
                      : `metered (${item.provider ?? '未設定'})`}{' '}
                    / 税率 {item.taxRate ?? 10}%
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingItemId(item.id)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <DeleteButton
                    intent="deleteItem"
                    idName="itemId"
                    idValue={item.id}
                  />
                </div>
              </div>
              <EditItemDialog
                item={item}
                groups={groups}
                open={editingItemId === item.id}
                onOpenChange={(o) => !o && setEditingItemId(null)}
              />
            </div>
          ))}
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <h4 className="text-sm font-semibold">グループ追加</h4>
        <Form
          method="post"
          {...groupForm.props}
          className="space-y-3"
          onSubmit={() => setNewItems([])}
        >
          <input type="hidden" name="intent" value="createGroupWithItems" />
          <GroupFormFields />

          {newItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">配下アイテム</Label>
              {newItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="hidden"
                    name={`items[${i}].name`}
                    value={item.name}
                  />
                  <input
                    type="hidden"
                    name={`items[${i}].type`}
                    value={item.type}
                  />
                  <input
                    type="hidden"
                    name={`items[${i}].monthlyAmount`}
                    value={item.monthlyAmount}
                  />
                  <span className="text-sm">
                    {item.name}
                    {item.type === 'fixed' && item.monthlyAmount
                      ? ` (${item.monthlyAmount})`
                      : ' (従量)'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() =>
                      setNewItems((prev) =>
                        prev.filter((p) => p.id !== item.id),
                      )
                    }
                  >
                    <TrashIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="new-item-name" className="text-xs">
                項目名
              </Label>
              <Input
                ref={newItemNameRef}
                id="new-item-name"
                placeholder="Vercel"
                className="h-8 text-sm"
              />
            </div>
            <div className="w-20">
              <Label htmlFor="new-item-type" className="text-xs">
                種別
              </Label>
              <Select
                defaultValue="fixed"
                onValueChange={(v) => setNewItemType(v as 'fixed' | 'metered')}
              >
                <SelectTrigger id="new-item-type" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定</SelectItem>
                  <SelectItem value="metered">従量</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Label htmlFor="new-item-amount" className="text-xs">
                月額
              </Label>
              <Input
                ref={newItemAmountRef}
                id="new-item-amount"
                placeholder="20.00"
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const name = newItemNameRef.current?.value?.trim()
                if (!name) return
                setNewItems((prev) => [
                  ...prev,
                  {
                    id: nanoid(),
                    name,
                    type: newItemType,
                    monthlyAmount: newItemAmountRef.current?.value ?? '',
                  },
                ])
                if (newItemNameRef.current) newItemNameRef.current.value = ''
                if (newItemAmountRef.current)
                  newItemAmountRef.current.value = ''
              }}
            >
              <PlusIcon className="size-3" />
              追加
            </Button>
          </div>

          <div className="text-destructive text-sm empty:hidden">
            {groupForm.errors}
          </div>
          <Button type="submit" size="sm">
            <PlusIcon className="size-4" />
            グループ{newItems.length > 0 ? `+ ${newItems.length}項目を` : 'を'}
            作成
          </Button>
        </Form>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <h4 className="text-sm font-semibold">経費項目追加</h4>
        <Form method="post" {...itemForm.props} className="space-y-3">
          <input type="hidden" name="intent" value="upsertItem" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="item-name">項目名</Label>
              <Input id="item-name" name="name" placeholder="Vercel" required />
            </div>
            <div>
              <Label htmlFor="item-group">所属グループ</Label>
              <Select name="groupId" defaultValue="__none__">
                <SelectTrigger id="item-group">
                  <SelectValue placeholder="単独（グループなし）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">単独</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="item-type">種別</Label>
              <Select name="type" defaultValue="fixed">
                <SelectTrigger id="item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定</SelectItem>
                  <SelectItem value="metered">従量</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="item-currency">通貨</Label>
              <Select name="currency" defaultValue="USD">
                <SelectTrigger id="item-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="item-amount">月額（固定の場合）</Label>
              <Input
                id="item-amount"
                name="monthlyAmount"
                placeholder="20.00"
              />
            </div>
          </div>
          <div className="text-destructive text-sm empty:hidden">
            {itemForm.errors}
          </div>
          <Button type="submit" size="sm">
            <PlusIcon className="size-4" />
            項目追加
          </Button>
        </Form>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <h4 className="text-sm font-semibold">GCP Billing 連携</h4>
        {hasGcpCredential ? (
          <div className="space-y-2">
            <p className="text-sm text-green-600">サービスアカウント設定済み</p>
            <Form method="post">
              <input type="hidden" name="intent" value="deleteCredential" />
              <input
                type="hidden"
                name="provider"
                value="google_cloud_billing"
              />
              <Button variant="outline" size="sm" type="submit">
                <TrashIcon className="size-3" />
                認証情報を削除
              </Button>
            </Form>
          </div>
        ) : (
          <GcpCredentialUpload />
        )}
        <p className="text-muted-foreground text-xs">
          従量課金（metered）アイテムで GCP Billing
          を利用するにはサービスアカウントの JSON キーが必要です。
        </p>
      </div>
    </div>
  )
}
