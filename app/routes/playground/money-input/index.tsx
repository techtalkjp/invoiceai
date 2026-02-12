import { parseSubmission, report } from '@conform-to/react/future'
import { coerceFormValue, formatResult } from '@conform-to/zod/v4/future'
import { useState } from 'react'
import { Form, Link } from 'react-router'
import { z } from 'zod/v4'
import { ContentPanel } from '~/components/layout/content-panel'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import { MoneyInput } from '~/components/money/money-input'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useForm } from '~/lib/form'
import type { Route } from './+types/index'

const demoSchema = z.object({
  hourlyRate: z.coerce.number().int().min(0),
  monthlyFee: z.coerce.number().int().min(0),
  customAmount: z.coerce.number().int().min(0).max(10000000),
  clientName: z.string().min(1, 'クライアント名を入力してください'),
})

export function meta() {
  return [{ title: 'MoneyInput Playground - InvoiceAI' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const submission = parseSubmission(formData)
  const result = coerceFormValue(demoSchema).safeParse(submission.payload)
  const error = formatResult(result)
  return {
    lastResult: report(submission, { error }),
    raw: Object.fromEntries(formData),
  }
}

export default function MoneyInputPlayground({
  actionData,
}: Route.ComponentProps) {
  const { form, fields } = useForm(demoSchema, {
    lastResult: actionData?.lastResult,
    defaultValue: {
      hourlyRate: '5000',
      monthlyFee: '500000',
      customAmount: '0',
      clientName: 'テスト株式会社',
    },
  })

  const [standaloneValue] = useState('25000')

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-2xl gap-6 py-4 sm:py-8">
        <PageHeader
          title="MoneyInput Playground"
          subtitle="金額入力コンポーネントのデモ"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/playground">← Playground</Link>
            </Button>
          }
        />

        {/* フォーム統合デモ */}
        <ContentPanel className="p-6">
          <h3 className="mb-4 text-lg font-semibold">フォーム統合デモ</h3>
          <Form method="POST" {...form.props} className="space-y-6">
            {/* inputProps のデモ */}
            <div className="space-y-2">
              <Label htmlFor={fields.clientName.id}>クライアント名</Label>
              <Input
                {...fields.clientName.inputProps}
                placeholder="株式会社サンプル"
              />
              <div className="text-destructive text-sm">
                {fields.clientName.errors}
              </div>
            </div>

            {/* moneyInputProps のデモ */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.hourlyRate.id}>時間単価</Label>
                <MoneyInput
                  {...fields.hourlyRate.moneyInputProps}
                  suffix="/ 時間"
                  placeholder="10,000"
                  step={500}
                  shiftStep={5000}
                  calculator
                />
                <div className="text-destructive text-sm">
                  {fields.hourlyRate.errors}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fields.monthlyFee.id}>月額</Label>
                <MoneyInput
                  {...fields.monthlyFee.moneyInputProps}
                  suffix="/ 月"
                  placeholder="100,000"
                  step={10000}
                  shiftStep={100000}
                  calculator
                />
                <div className="text-destructive text-sm">
                  {fields.monthlyFee.errors}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.customAmount.id}>
                カスタム金額（上限1,000万円）
              </Label>
              <MoneyInput
                {...fields.customAmount.moneyInputProps}
                placeholder="0"
                step={1000}
                shiftStep={100000}
                max={10000000}
                calculator
              />
              <div className="text-destructive text-sm">
                {fields.customAmount.errors}
              </div>
              <p className="text-muted-foreground text-xs">
                max=10,000,000 を設定。↑/↓で超えないことを確認
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit">送信してみる</Button>
              <Button type="reset" variant="outline">
                リセット
              </Button>
            </div>

            {actionData?.raw && (
              <div className="rounded-md border p-4">
                <h4 className="mb-2 text-sm font-medium">
                  送信されたフォームデータ:
                </h4>
                <pre className="text-muted-foreground text-xs">
                  {JSON.stringify(actionData.raw, null, 2)}
                </pre>
              </div>
            )}
          </Form>
        </ContentPanel>

        {/* スタンドアロン（controlled） */}
        <ContentPanel className="p-6">
          <h3 className="mb-4 text-lg font-semibold">単体で使う</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>controlled value</Label>
              <MoneyInput
                defaultValue={standaloneValue}
                suffix="/ 日"
                placeholder="0"
                step={5000}
                shiftStep={50000}
                calculator
              />
              <p className="text-muted-foreground text-xs">
                初期値: {standaloneValue}
              </p>
            </div>

            <div className="space-y-2">
              <Label>プレフィックスなし</Label>
              <MoneyInput prefix="" placeholder="0" step={100} calculator />
            </div>

            <div className="space-y-2">
              <Label>disabled</Label>
              <MoneyInput
                defaultValue="50000"
                suffix="/ 月"
                disabled
                calculator
              />
            </div>
          </div>
        </ContentPanel>

        {/* 電卓付き MoneyInput */}
        <ContentPanel className="p-6">
          <h3 className="mb-4 text-lg font-semibold">電卓付き</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>calculator=true</Label>
              <MoneyInput
                defaultValue="5000"
                calculator
                suffix="/ 日"
                placeholder="0"
                step={1000}
              />
              <p className="text-muted-foreground text-xs">
                電卓アイコンをクリックしてミニ電卓を開く。数式入力可能 (例:
                5000*3+500)
              </p>
            </div>

            <div className="space-y-2">
              <Label>calculator + max制限</Label>
              <MoneyInput
                defaultValue="0"
                calculator
                placeholder="0"
                step={1000}
                shiftStep={100000}
                max={10000000}
              />
              <p className="text-muted-foreground text-xs">
                max=10,000,000。電卓の結果も max で制限される
              </p>
            </div>
          </div>
        </ContentPanel>

        {/* 使い方ガイド */}
        <ContentPanel className="p-6">
          <h3 className="mb-4 text-lg font-semibold">使い方</h3>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              <strong>ショートカット入力:</strong> "10k" → 10,000 / "1.5m" →
              1,500,000 / "5w" → 50,000（万）
            </p>
            <p>
              <strong>↑/↓ キー:</strong> step 単位で増減（デフォルト: 1,000）
            </p>
            <p>
              <strong>Shift + ↑/↓:</strong> shiftStep 単位で増減（デフォルト:
              10,000）
            </p>
            <p>
              <strong>Enter:</strong> 確定
            </p>
            <p>
              <strong>Escape:</strong> 編集取消
            </p>
            <p>
              <strong>フォーカス時:</strong> 生の数値を表示 + 全選択
            </p>
            <p>
              <strong>フォーカスアウト時:</strong> 3桁区切りカンマ表示
            </p>
            <p>
              <strong>ペースト:</strong> "¥10,000" や "１０，０００"
              もパース可能
            </p>
            <p>
              <strong>電卓:</strong> calculator prop
              を指定すると電卓アイコンが表示。四則演算+括弧の数式入力が可能 (例:
              5000*3+500)
            </p>
          </div>
        </ContentPanel>
      </div>
    </PublicLayout>
  )
}
