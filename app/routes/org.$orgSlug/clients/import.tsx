import { CheckIcon, LoaderIcon } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Await, useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { useStableFetcher } from '~/hooks/use-stable-fetcher'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { importPartnersBulk } from './+mutations.server'
import { fetchFreeePartners, getClients } from './+queries.server'
import type { InvoicePartner } from './+schema'
import type { Route } from './+types/import'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  // クライアントは同期、freee取得は非同期
  const clients = await getClients(organization.id)
  const partnersPromise = fetchFreeePartners(
    organization.id,
    organization.freeeCompanyId,
  )

  // インポート済みのパートナーIDを取得
  const importedPartnerIds = clients
    .map((c) => c.freeePartnerId)
    .filter((id): id is number => id !== null)

  return { organization, partnersPromise, importedPartnerIds }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const formData = await request.formData()
  return importPartnersBulk(organization.id, formData)
}

export default function ImportPage({
  loaderData: { organization, partnersPromise, importedPartnerIds },
}: Route.ComponentProps) {
  const navigate = useNavigate()
  const fetcher = useStableFetcher()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const importedSet = new Set(importedPartnerIds)

  const isSubmitting = fetcher.state === 'submitting'

  return (
    <Card>
      <CardHeader>
        <CardTitle>freee から取引先を取込</CardTitle>
        <CardDescription>
          直近の請求書に登場する取引先をクライアントとしてインポートします。
          詳細設定は後から編集できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <LoaderIcon className="text-muted-foreground h-6 w-6 animate-spin" />
              <span className="text-muted-foreground ml-2">
                freee から取引先を読み込み中...
              </span>
            </div>
          }
        >
          <Await resolve={partnersPromise}>
            {(partners) => (
              <PartnerList
                partners={partners}
                importedSet={importedSet}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                isSubmitting={isSubmitting}
                onImport={async (selectedPartners) => {
                  await fetcher.submit(
                    {
                      intent: 'import-bulk',
                      partners: JSON.stringify(selectedPartners),
                    },
                    { method: 'POST' },
                  )
                  navigate(`/org/${organization.slug}/clients`)
                }}
                onCancel={() => navigate(`/org/${organization.slug}/clients`)}
              />
            )}
          </Await>
        </Suspense>
      </CardContent>
    </Card>
  )
}

function PartnerList({
  partners,
  importedSet,
  selectedIds,
  setSelectedIds,
  isSubmitting,
  onImport,
  onCancel,
}: {
  partners: InvoicePartner[]
  importedSet: Set<number>
  selectedIds: Set<number>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>
  isSubmitting: boolean
  onImport: (partners: { id: number; name: string }[]) => void
  onCancel: () => void
}) {
  const availablePartners = partners.filter((p) => !importedSet.has(p.id))

  const togglePartner = (id: number) => {
    if (importedSet.has(id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === availablePartners.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(availablePartners.map((p) => p.id)))
    }
  }

  const handleImport = () => {
    if (selectedIds.size === 0) return
    const selectedPartners = partners
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name }))
    onImport(selectedPartners)
  }

  const formatDate = (dateStr: string) => {
    const [year, month] = dateStr.split('-')
    return `${year}/${month}`
  }

  return (
    <>
      <div className="max-h-96 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    availablePartners.length > 0 &&
                    selectedIds.size === availablePartners.length
                  }
                  onCheckedChange={toggleAll}
                  disabled={availablePartners.length === 0}
                />
              </TableHead>
              <TableHead>取引先名</TableHead>
              <TableHead className="w-24 text-right">最終請求</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((partner) => {
              const isImported = importedSet.has(partner.id)
              return (
                <TableRow
                  key={partner.id}
                  className={isImported ? 'opacity-60' : 'cursor-pointer'}
                  onClick={() => togglePartner(partner.id)}
                >
                  <TableCell>
                    {isImported ? (
                      <CheckIcon className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <Checkbox
                        checked={selectedIds.has(partner.id)}
                        onCheckedChange={() => togglePartner(partner.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {partner.name}
                    {isImported && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (登録済)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {formatDate(partner.lastBillingDate)}
                  </TableCell>
                </TableRow>
              )
            })}
            {partners.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-muted-foreground text-center"
                >
                  取引先がありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          {selectedIds.size > 0 && `${selectedIds.size}件選択中`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting ? '取込中...' : `取込 (${selectedIds.size})`}
          </Button>
        </div>
      </div>
    </>
  )
}
