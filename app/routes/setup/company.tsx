import { parseSubmission, report } from '@conform-to/react/future'
import { formatResult } from '@conform-to/zod/v4/future'
import {
  Form,
  data,
  redirect,
  useActionData,
  useOutletContext,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useForm } from '~/lib/form'
import { getSetupState } from './+queries.server'
import { workspaceSchema } from './+schema'
import { confirmWorkspaceName } from './+services.server'
import type { Route } from './+types/company'
import type { SetupContext } from './_layout'

export async function action({ request }: Route.ActionArgs) {
  const setup = await getSetupState(request)
  const formData = await request.formData()

  const submission = parseSubmission(formData)
  const result = workspaceSchema.safeParse(submission.payload)

  if (!result.success) {
    return data(
      {
        lastResult: report(submission, { error: formatResult(result) }),
      },
      { status: 400 },
    )
  }

  await confirmWorkspaceName({
    organizationId: setup.organizationId,
    userId: setup.userId,
    workspaceName: result.data.workspaceName,
  })
  throw redirect('/setup/client?updated=company')
}

export default function SetupCompany() {
  const setup = useOutletContext<SetupContext>()
  const actionData = useActionData<typeof action>()

  const { form, fields } = useForm(workspaceSchema, {
    key: 'setup-company-form',
    lastResult: actionData?.lastResult,
    defaultValue: {
      workspaceName: setup.workspaceName,
    },
  })

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="font-medium">ステップ 1: 会社情報の確認</p>
        <p className="text-muted-foreground text-sm">
          請求に使う会社情報を仮作成しました。会社名や屋号に合わせて変更できます。
        </p>
      </div>

      <Form method="POST" {...form.props} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={fields.workspaceName.id}>会社名・屋号</Label>
          <Input
            {...fields.workspaceName.inputProps}
            className="h-11"
            placeholder="株式会社サンプル"
          />
          <p className="text-destructive text-sm">
            {fields.workspaceName.errors}
          </p>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            この名前で次へ
          </Button>
        </div>
      </Form>
    </div>
  )
}
