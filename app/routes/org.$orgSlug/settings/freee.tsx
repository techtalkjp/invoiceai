import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import {
  buildFreeeAuthUrl,
  requestFreeeTokenWithCode,
} from '@shared/services/freee-oauth'
import { CheckCircle2Icon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'
import { Form, useActionData } from 'react-router'
import { z } from 'zod'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
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
import { db } from '~/lib/db/kysely'
import {
  getProviderToken,
  saveProviderToken,
} from '~/lib/provider-token.server'
import {
  getFreeeClientForOrganization,
  listCompanies,
  loadFreeeAuthEnv,
} from '~/utils/freee.server'
import type { Route } from './+types/freee'

const FREEE_TOKEN_URL = 'https://accounts.secure.freee.co.jp/public_api/token'
const FREEE_AUTH_URL =
  'https://accounts.secure.freee.co.jp/public_api/authorize'
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

const authCodeSchema = z.object({
  intent: z.literal('authenticate'),
  code: z.string({ error: '認可コードを入力してください' }).min(1),
})

const fetchCompaniesSchema = z.object({
  intent: z.literal('fetchCompanies'),
})

const setCompanySchema = z.object({
  intent: z.literal('setCompany'),
  freeeCompanyId: z.coerce.number().int().positive(),
})

const formSchema = z.discriminatedUnion('intent', [
  authCodeSchema,
  fetchCompaniesSchema,
  setCompanySchema,
])

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const env = loadFreeeAuthEnv()
  const authUrl = buildFreeeAuthUrl(
    FREEE_AUTH_URL,
    env.FREEE_API_CLIENT_ID,
    REDIRECT_URI,
  )

  const token = await getProviderToken(organization.id, 'freee')
  const hasToken = !!token

  return { organization, authUrl, hasToken }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })

  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { intent } = submission.value

  if (intent === 'authenticate') {
    const env = loadFreeeAuthEnv()

    try {
      const data = await requestFreeeTokenWithCode(
        {
          tokenUrl: FREEE_TOKEN_URL,
          clientId: env.FREEE_API_CLIENT_ID,
          clientSecret: env.FREEE_API_CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
        },
        submission.value.code,
      )

      await saveProviderToken(organization.id, 'freee', {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null,
        scope: data.scope ?? null,
      })

      return { lastResult: submission.reply(), authenticated: true }
    } catch (error) {
      console.error('freee token exchange error:', error)
      return {
        lastResult: submission.reply({
          formErrors: ['トークン取得に失敗しました'],
        }),
      }
    }
  }

  if (intent === 'fetchCompanies') {
    try {
      const freee = await getFreeeClientForOrganization(organization.id)
      const { companies } = await listCompanies({
        getCompanies: freee.getCompanies,
        getInvoices: freee.getInvoices,
        getInvoice: freee.getInvoice,
        getInvoiceTemplates: freee.getInvoiceTemplates,
        getPartners: freee.getPartners,
      })

      return { lastResult: submission.reply(), companies }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'freee API エラー'
      return {
        lastResult: submission.reply({ formErrors: [message] }),
      }
    }
  }

  if (intent === 'setCompany') {
    const { freeeCompanyId } = submission.value
    const now = new Date().toISOString()

    await db
      .updateTable('organization')
      .set({ freeeCompanyId, updatedAt: now })
      .where('id', '=', organization.id)
      .execute()

    return { lastResult: submission.reply(), companySet: true }
  }

  return { lastResult: submission.reply() }
}

export default function FreeeSettings({
  loaderData: { organization, authUrl, hasToken },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()

  const companies =
    actionData && 'companies' in actionData ? actionData.companies : null
  const isAuthenticated =
    hasToken ||
    (actionData && 'authenticated' in actionData && actionData.authenticated)

  return (
    <>
      <CardHeader>
        <CardTitle>freee 連携設定</CardTitle>
        <CardDescription>
          freee API と連携して請求書を管理します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ステップ1: freee認証 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                1
              </span>
            )}
            <h4 className="font-medium">freee 認証</h4>
            {isAuthenticated && (
              <Badge variant="outline" className="text-emerald-600">
                認証済み
              </Badge>
            )}
          </div>
          {!isAuthenticated && (
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                freee
                の認可ページでログインし、表示された認可コードを入力してください。
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={authUrl} target="_blank" rel="noopener noreferrer">
                  freee 認可ページを開く
                  <ExternalLinkIcon className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <AuthCodeForm />
            </div>
          )}
        </div>

        {/* ステップ2: 会社選択 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {organization.freeeCompanyId ? (
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                2
              </span>
            )}
            <h4 className="font-medium">会社を選択</h4>
            {organization.freeeCompanyId && (
              <Badge variant="outline" className="text-emerald-600">
                設定済み (ID: {organization.freeeCompanyId})
              </Badge>
            )}
          </div>
          {isAuthenticated ? (
            <div className="ml-7 space-y-3">
              <p className="text-muted-foreground text-sm">
                freee
                に登録されている会社一覧から、この組織で使用する会社を選択します。
              </p>
              <Form method="POST">
                <input type="hidden" name="intent" value="fetchCompanies" />
                <Button type="submit" variant="outline" size="sm">
                  <RefreshCwIcon className="mr-2 h-4 w-4" />
                  会社一覧を取得
                </Button>
              </Form>

              {actionData?.lastResult?.error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {String(actionData.lastResult.error.form ?? '')}
                </div>
              )}

              {companies && companies.length > 0 && (
                <Form method="POST" className="flex items-end gap-2">
                  <input type="hidden" name="intent" value="setCompany" />
                  <div className="flex-1">
                    <Select name="freeeCompanyId">
                      <SelectTrigger>
                        <SelectValue placeholder="会社を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem
                            key={company.id}
                            value={company.id.toString()}
                          >
                            {company.display_name} (ID: {company.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="sm">
                    設定
                  </Button>
                </Form>
              )}

              {companies && companies.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  会社が見つかりませんでした
                </p>
              )}

              {actionData &&
                'companySet' in actionData &&
                actionData.companySet && (
                  <p className="text-sm text-emerald-600">会社を設定しました</p>
                )}
            </div>
          ) : (
            <p className="text-muted-foreground ml-7 text-sm">
              まず freee 認証を完了してください
            </p>
          )}
        </div>
      </CardContent>
    </>
  )
}

function AuthCodeForm() {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: authCodeSchema }),
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...getFormProps(form)} className="space-y-2">
      <input type="hidden" name="intent" value="authenticate" />
      <div className="space-y-1">
        <Label htmlFor={fields.code.id}>認可コード</Label>
        <div className="flex gap-2">
          <Input
            {...getInputProps(fields.code, { type: 'text' })}
            placeholder="認可コードを入力"
            className="flex-1"
          />
          <Button type="submit" size="sm">
            認証
          </Button>
        </div>
        <div className="text-destructive text-sm">{fields.code.errors}</div>
      </div>
      {form.errors && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {form.errors}
        </div>
      )}
    </Form>
  )
}
