import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, redirect, useActionData } from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { requireOrgAdmin } from '~/lib/auth-helpers.server'
import { db } from '~/lib/db/kysely'
import type { Route } from './+types/general'

const formSchema = z.object({
  name: z.string().min(1, '組織名を入力してください'),
  slug: z
    .string()
    .min(1, 'スラッグを入力してください')
    .regex(/^[a-z0-9-]+$/, '小文字英数字とハイフンのみ使用できます'),
})

export async function loader({ request, params }: Route.LoaderArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)
  return { organization }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { orgSlug } = params
  const { organization } = await requireOrgAdmin(request, orgSlug)

  const submission = parseWithZod(await request.formData(), {
    schema: formSchema,
  })
  if (submission.status !== 'success') {
    return { lastResult: submission.reply() }
  }

  const { name, slug } = submission.value

  // スラッグの重複チェック（自分以外）
  if (slug !== organization.slug) {
    const existing = await db
      .selectFrom('organization')
      .select('id')
      .where('slug', '=', slug)
      .where('id', '!=', organization.id)
      .executeTakeFirst()

    if (existing) {
      return {
        lastResult: submission.reply({
          fieldErrors: { slug: ['このスラッグは既に使用されています'] },
        }),
      }
    }
  }

  const now = new Date().toISOString()
  await db
    .updateTable('organization')
    .set({ name, slug, updatedAt: now })
    .where('id', '=', organization.id)
    .execute()

  // スラッグが変わった場合は新しいURLにリダイレクト
  if (slug !== organization.slug) {
    return redirect(`/org/${slug}/settings/general`)
  }

  return { lastResult: submission.reply(), success: true }
}

export default function GeneralSettings({
  loaderData: { organization },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>()
  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    defaultValue: {
      name: organization.name,
      slug: organization.slug ?? '',
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <CardHeader>
        <CardTitle>基本設定</CardTitle>
        <CardDescription>組織の基本情報を変更します</CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fields.name.id}>組織名</Label>
            <Input {...getInputProps(fields.name, { type: 'text' })} />
            <div className="text-destructive text-sm">{fields.name.errors}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={fields.slug.id}>スラッグ</Label>
            <Input {...getInputProps(fields.slug, { type: 'text' })} />
            <p className="text-muted-foreground text-xs">
              URLに使用されます（例: /org/{fields.slug.value || 'your-org'}）
            </p>
            <div className="text-destructive text-sm">{fields.slug.errors}</div>
          </div>

          {actionData?.success && (
            <p className="text-sm text-emerald-600">設定を保存しました</p>
          )}

          <div className="flex justify-end">
            <Button type="submit">保存</Button>
          </div>
        </Form>
      </CardContent>
    </>
  )
}
