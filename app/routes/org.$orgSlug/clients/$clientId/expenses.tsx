import { PlusIcon, TrashIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
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
import type { Route } from './+types/expenses'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const [groups, items] = await Promise.all([
    getExpenseGroups(organization.id, clientId),
    getExpenseItems(organization.id, clientId),
  ])

  return { groups, items, organizationId: organization.id }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug, clientId } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const formData = await request.formData()
  const intent = formData.get('intent') as string

  switch (intent) {
    case 'createGroup': {
      await upsertExpenseGroup(organization.id, clientId, {
        name: String(formData.get('name') ?? ''),
        invoiceLabel: String(formData.get('invoiceLabel') ?? ''),
        currency: String(formData.get('currency') ?? 'USD'),
        taxRate: Number(formData.get('taxRate') ?? 10),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      })
      return { success: true }
    }
    case 'deleteGroup': {
      await deleteExpenseGroup(
        organization.id,
        clientId,
        String(formData.get('groupId')),
      )
      return { success: true }
    }
    case 'createItem': {
      await upsertExpenseItem(organization.id, clientId, {
        groupId: formData.get('groupId')
          ? String(formData.get('groupId'))
          : null,
        name: String(formData.get('name') ?? ''),
        type: String(formData.get('type') ?? 'fixed') as 'fixed' | 'metered',
        currency: String(formData.get('currency') ?? 'USD'),
        monthlyAmount: formData.get('monthlyAmount')
          ? String(formData.get('monthlyAmount'))
          : undefined,
        invoiceLabel: formData.get('invoiceLabel')
          ? String(formData.get('invoiceLabel'))
          : undefined,
        taxRate: formData.get('taxRate')
          ? Number(formData.get('taxRate'))
          : undefined,
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      })
      return { success: true }
    }
    case 'deleteItem': {
      await deleteExpenseItem(
        organization.id,
        clientId,
        String(formData.get('itemId')),
      )
      return { success: true }
    }
    default:
      return { success: false }
  }
}

export default function ExpenseSettings({
  loaderData: { groups, items },
}: Route.ComponentProps) {
  const groupFetcher = useFetcher({ key: 'expense-group' })
  const itemFetcher = useFetcher({ key: 'expense-item' })

  return (
    <div className="space-y-6">
      {/* グループ一覧 */}
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
                <groupFetcher.Form method="post">
                  <input type="hidden" name="intent" value="deleteGroup" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <Button variant="ghost" size="icon" type="submit">
                    <TrashIcon className="size-4" />
                  </Button>
                </groupFetcher.Form>
              </div>

              {/* グループ内アイテム */}
              <div className="ml-4 space-y-1">
                {groupItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {item.name}{' '}
                      <span className="text-muted-foreground">
                        {item.type === 'fixed'
                          ? `${item.currency} ${item.monthlyAmount}`
                          : `metered (${item.provider ?? '未設定'})`}
                      </span>
                    </span>
                    <itemFetcher.Form method="post">
                      <input type="hidden" name="intent" value="deleteItem" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <Button variant="ghost" size="icon" type="submit">
                        <TrashIcon className="size-3" />
                      </Button>
                    </itemFetcher.Form>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* 単独アイテム */}
        {items
          .filter((i) => !i.groupId)
          .map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border p-4"
            >
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
              <itemFetcher.Form method="post">
                <input type="hidden" name="intent" value="deleteItem" />
                <input type="hidden" name="itemId" value={item.id} />
                <Button variant="ghost" size="icon" type="submit">
                  <TrashIcon className="size-4" />
                </Button>
              </itemFetcher.Form>
            </div>
          ))}
      </div>

      {/* グループ追加フォーム */}
      <div className="space-y-3 rounded-md border p-4">
        <h4 className="text-sm font-semibold">グループ追加</h4>
        <groupFetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="createGroup" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="group-name">グループ名</Label>
              <Input
                id="group-name"
                name="name"
                placeholder="サーバ通信費"
                required
              />
            </div>
            <div>
              <Label htmlFor="group-currency">通貨</Label>
              <Select name="currency" defaultValue="USD">
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
              id="group-label"
              name="invoiceLabel"
              placeholder="サーバ通信費 {year}年{month}月 (月{amount_foreign}ドル:ドル円{rate}円換算)"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="group-tax">税率</Label>
              <Select name="taxRate" defaultValue="10">
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
                defaultValue="0"
              />
            </div>
          </div>
          <Button type="submit" size="sm">
            <PlusIcon className="size-4" />
            グループ追加
          </Button>
        </groupFetcher.Form>
      </div>

      {/* アイテム追加フォーム */}
      <div className="space-y-3 rounded-md border p-4">
        <h4 className="text-sm font-semibold">経費項目追加</h4>
        <itemFetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="createItem" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="item-name">項目名</Label>
              <Input id="item-name" name="name" placeholder="Vercel" required />
            </div>
            <div>
              <Label htmlFor="item-group">所属グループ</Label>
              <Select name="groupId" defaultValue="">
                <SelectTrigger id="item-group">
                  <SelectValue placeholder="単独（グループなし）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">単独</SelectItem>
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
          <Button type="submit" size="sm">
            <PlusIcon className="size-4" />
            項目追加
          </Button>
        </itemFetcher.Form>
      </div>
    </div>
  )
}
