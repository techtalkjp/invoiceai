import { parseSubmission, report } from '@conform-to/react/future'
import { formatResult } from '@conform-to/zod/v4/future'
import { ArrowLeftIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useOutletContext,
} from 'react-router'
import { MoneyInput } from '~/components/money/money-input'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useForm } from '~/lib/form'
import { cn } from '~/lib/utils'
import { getSetupState } from './+queries.server'
import { clientSchema } from './+schema'
import {
  findDuplicateClientName,
  upsertPrimaryClient,
} from './+services.server'
import type { Route } from './+types/client'
import type { SetupContext } from './_layout'

export async function action({ request }: Route.ActionArgs) {
  const setup = await getSetupState(request)
  const primaryClientId = setup.primaryClient?.id ?? null
  const formData = await request.formData()
  const submission = parseSubmission(formData)
  const result = clientSchema.safeParse(submission.payload)

  if (!result.success) {
    return data(
      {
        lastResult: report(submission, { error: formatResult(result) }),
        errorMessage: null,
      },
      { status: 400 },
    )
  }

  const existing = await findDuplicateClientName({
    organizationId: setup.organizationId,
    primaryClientId,
    name: result.data.name,
  })

  if (existing) {
    return data(
      {
        lastResult: report(submission),
        errorMessage: '同じ名前のクライアントが既に存在します。',
      },
      { status: 400 },
    )
  }

  await upsertPrimaryClient({
    organizationId: setup.organizationId,
    primaryClientId,
    value: result.data,
  })

  throw redirect('/setup/cli')
}

export default function SetupClient() {
  const setup = useOutletContext<SetupContext>()
  const actionData = useActionData<typeof action>()

  const { form, fields } = useForm(clientSchema, {
    key: 'setup-client-form',
    lastResult: actionData?.lastResult,
    defaultValue: {
      name: setup.primaryClient?.name ?? '',
      billingType: setup.primaryClient?.billingType ?? 'time',
      hourlyRate:
        setup.primaryClient?.hourlyRate !== null &&
        setup.primaryClient?.hourlyRate !== undefined
          ? String(setup.primaryClient.hourlyRate)
          : '',
      monthlyFee:
        setup.primaryClient?.monthlyFee !== null &&
        setup.primaryClient?.monthlyFee !== undefined
          ? String(setup.primaryClient.monthlyFee)
          : '',
    },
  })

  const [billingType, setBillingType] = useState<string>(
    String(fields.billingType.defaultValue ?? 'time'),
  )

  return (
    <Form method="POST" {...form.props} className="grid gap-5">
      {setup.companyUpdated && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          会社情報を更新しました: {setup.workspaceName}
        </div>
      )}

      {actionData?.errorMessage && (
        <p className="text-destructive rounded-md bg-red-50 px-3 py-2 text-sm">
          {actionData.errorMessage}
        </p>
      )}

      <div className="grid gap-1">
        <p className="font-medium">ステップ 2: クライアント確認</p>
        <p className="text-muted-foreground text-sm">
          請求先として使う最初のクライアントを確認します。
        </p>
        <p className="text-muted-foreground text-xs">
          現在の会社情報: {setup.workspaceName}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={fields.name.id}>クライアント名</Label>
        <Input
          {...fields.name.inputProps}
          placeholder="株式会社サンプル"
          className="h-11"
        />
        <p className="text-destructive text-sm">{fields.name.errors}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={fields.billingType.id}>請求タイプ</Label>
        <input
          type="hidden"
          name={fields.billingType.name}
          id={fields.billingType.id}
          value={billingType}
        />
        <fieldset className="grid grid-cols-2 gap-2">
          <label>
            <input
              type="radio"
              className="sr-only"
              name={`${fields.billingType.name}-selector`}
              value="time"
              checked={billingType === 'time'}
              onChange={() => setBillingType('time')}
            />
            <span
              className={cn(
                'block rounded-md border px-3 py-3 text-left text-sm transition-colors',
                billingType === 'time'
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400',
              )}
            >
              タイムチャージ
            </span>
          </label>
          <label>
            <input
              type="radio"
              className="sr-only"
              name={`${fields.billingType.name}-selector`}
              value="fixed"
              checked={billingType === 'fixed'}
              onChange={() => setBillingType('fixed')}
            />
            <span
              className={cn(
                'block rounded-md border px-3 py-3 text-left text-sm transition-colors',
                billingType === 'fixed'
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400',
              )}
            >
              固定月額
            </span>
          </label>
        </fieldset>
      </div>

      {billingType === 'time' ? (
        <div className="grid gap-2">
          <Label htmlFor={fields.hourlyRate.id}>時間単価 (税抜・円)</Label>
          <MoneyInput
            {...fields.hourlyRate.moneyInputProps}
            placeholder="10,000"
            step={500}
            shiftStep={5000}
            calculator
          />
          <p className="text-muted-foreground text-xs">
            請求書作成時に消費税を加算する前の単価です。
          </p>
          <p className="text-destructive text-sm">{fields.hourlyRate.errors}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={fields.monthlyFee.id}>月額 (税抜・円)</Label>
          <MoneyInput
            {...fields.monthlyFee.moneyInputProps}
            placeholder="300,000"
            step={10000}
            shiftStep={100000}
            calculator
          />
          <p className="text-muted-foreground text-xs">
            請求書作成時に消費税を加算する前の金額です。
          </p>
          <p className="text-destructive text-sm">{fields.monthlyFee.errors}</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-full justify-start px-0 sm:w-auto"
        >
          <Link to="/setup/company">
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            戻る
          </Link>
        </Button>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {setup.primaryClient
            ? '内容を更新して次へ'
            : 'クライアントを作成して次へ'}
        </Button>
      </div>
    </Form>
  )
}
