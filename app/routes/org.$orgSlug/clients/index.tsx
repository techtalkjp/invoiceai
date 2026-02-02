import {
  DownloadIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  Undo2Icon,
} from 'lucide-react'
import { Form, Link } from 'react-router'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useSmartNavigation } from '~/hooks/use-smart-navigation'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { deleteClient, restoreClient } from './+mutations.server'
import { getClients } from './+queries.server'
import type { Route } from './+types/index'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const clients = await getClients(organization.id)

  return { organization, clients, freeeCompanyId: organization.freeeCompanyId }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete') {
    const clientId = formData.get('clientId')
    if (typeof clientId === 'string') {
      await deleteClient(organization.id, clientId)
    }
    return { success: true }
  }

  if (intent === 'restore') {
    const clientId = formData.get('clientId')
    if (typeof clientId === 'string') {
      await restoreClient(organization.id, clientId)
    }
    return { success: true }
  }

  return { success: false }
}

export default function ClientsIndex({
  loaderData: { organization, clients, freeeCompanyId },
}: Route.ComponentProps) {
  const baseUrl = `/org/${organization.slug}/clients`

  // フィルタ・ページネーション状態を保存（編集後の戻り先用）
  useSmartNavigation({ autoSave: true, baseUrl })

  const activeClients = clients.filter((c) => c.isActive === 1)
  const inactiveClients = clients.filter((c) => c.isActive === 0)

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>クライアント管理</CardTitle>
            <CardDescription>
              請求書を発行するクライアントを管理します
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`${baseUrl}/import`}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                freeeから取込
              </Link>
            </Button>
            <Button asChild>
              <Link to={`${baseUrl}/new`}>
                <PlusIcon className="mr-2 h-4 w-4" />
                新規作成
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              有効
              <Badge variant="secondary" className="ml-1.5">
                {activeClients.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive">
              無効
              <Badge variant="secondary" className="ml-1.5">
                {inactiveClients.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeClients.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                クライアントが登録されていません
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>クライアント名</TableHead>
                    <TableHead>請求タイプ</TableHead>
                    <TableHead>単価/月額</TableHead>
                    <TableHead>freee取引先</TableHead>
                    <TableHead className="w-25">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell>
                        {client.billingType === 'time'
                          ? 'タイムチャージ'
                          : '固定'}
                      </TableCell>
                      <TableCell>
                        {client.billingType === 'time'
                          ? client.hourlyRate
                            ? `¥${client.hourlyRate.toLocaleString()}/h`
                            : '未設定'
                          : client.monthlyFee
                            ? `¥${client.monthlyFee.toLocaleString()}/月`
                            : '未設定'}
                      </TableCell>
                      <TableCell>
                        {client.freeePartnerId && freeeCompanyId ? (
                          <a
                            href={`https://secure.freee.co.jp/partners/${client.freeePartnerId}?company_id=${freeeCompanyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {client.freeePartnerName}
                            <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`${baseUrl}/${client.id}`}>
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Form method="POST" className="inline">
                            <input type="hidden" name="intent" value="delete" />
                            <input
                              type="hidden"
                              name="clientId"
                              value={client.id}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              type="submit"
                              className="text-destructive hover:text-destructive"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </Form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="inactive">
            {inactiveClients.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                無効なクライアントはありません
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>クライアント名</TableHead>
                    <TableHead>請求タイプ</TableHead>
                    <TableHead className="w-25">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell>
                        {client.billingType === 'time'
                          ? 'タイムチャージ'
                          : '固定'}
                      </TableCell>
                      <TableCell>
                        <Form method="POST" className="inline">
                          <input type="hidden" name="intent" value="restore" />
                          <input
                            type="hidden"
                            name="clientId"
                            value={client.id}
                          />
                          <Button variant="ghost" size="sm" type="submit">
                            <Undo2Icon className="h-4 w-4" />
                            復活
                          </Button>
                        </Form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  )
}
