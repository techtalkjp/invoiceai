import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { ArrowLeftIcon, ChevronRightIcon, RefreshCwIcon } from 'lucide-react'
import { Form, Link, useFetcher, useNavigation } from 'react-router'
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
import { Textarea } from '~/components/ui/textarea'
import {
  clientSchema,
  paymentTermsOptions,
  type ClientFormData,
} from '../+schema'

type SyncFetcherData = {
  success?: boolean
  invoiceSubjectTemplate?: string | null
  invoiceNote?: string | null
  error?: string
}

type ClientFormProps = {
  defaultValue?: Partial<ClientFormData>
  lastResult?: Parameters<typeof useForm>[0]['lastResult']
  backTo: string
  submitLabel: string
  canSync?: boolean
  orgSlug?: string
}

export function ClientForm({
  defaultValue,
  lastResult,
  backTo,
  submitLabel,
  canSync,
  orgSlug,
}: ClientFormProps) {
  const navigation = useNavigation()
  // クライアントIDごとにfetcherの状態を分離
  const fetcherKey = `sync-from-invoice-${defaultValue?.id ?? 'new'}`
  const fetcher = useFetcher<SyncFetcherData>({ key: fetcherKey })
  const isSubmitting = navigation.state === 'submitting'
  const isSyncing = fetcher.state === 'loading'

  // 同期結果から値を取得
  const syncedData = fetcher.data?.success
    ? {
        invoiceSubjectTemplate: fetcher.data.invoiceSubjectTemplate,
        invoiceNote: fetcher.data.invoiceNote,
      }
    : null
  const syncError = fetcher.data?.error

  const [form, fields] = useForm({
    lastResult,
    defaultValue: defaultValue ?? {
      billingType: 'time',
      hasWorkDescription: 1,
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: clientSchema }),
    shouldRevalidate: 'onBlur',
  })

  const billingType = fields.billingType.value ?? 'time'
  const isEditing = !!defaultValue?.id

  return (
    <>
      <CardHeader>
        {/* パンくずリスト */}
        <nav className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
          <Link to={backTo} className="hover:text-foreground transition-colors">
            クライアント
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">
            {isEditing ? '編集' : '新規作成'}
          </span>
        </nav>

        {/* 戻るボタン付きタイトル */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to={backTo}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle>
              {isEditing ? 'クライアントを編集' : 'クライアントを追加'}
            </CardTitle>
            <CardDescription>
              クライアント情報を入力してください
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form method="POST" {...getFormProps(form)} className="space-y-6">
          {defaultValue?.id && (
            <input type="hidden" name="id" value={defaultValue.id} />
          )}

          {/* 基本情報 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={fields.name.id}>クライアント名 *</Label>
              <Input
                {...getInputProps(fields.name, { type: 'text' })}
                placeholder="株式会社サンプル"
              />
              <div className="text-destructive text-sm">
                {fields.name.errors as React.ReactNode}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.billingType.id}>請求タイプ *</Label>
              <Select
                name={fields.billingType.name}
                defaultValue={fields.billingType.initialValue ?? 'time'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">タイムチャージ</SelectItem>
                  <SelectItem value="fixed">固定月額</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {billingType === 'time' ? (
              <div className="space-y-2">
                <Label htmlFor={fields.hourlyRate.id}>時間単価 (円)</Label>
                <Input
                  {...getInputProps(fields.hourlyRate, { type: 'number' })}
                  placeholder="10000"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={fields.monthlyFee.id}>月額 (円)</Label>
                <Input
                  {...getInputProps(fields.monthlyFee, { type: 'number' })}
                  placeholder="100000"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={fields.unitLabel.id}>単位ラベル</Label>
              <Input
                {...getInputProps(fields.unitLabel, { type: 'text' })}
                placeholder="式"
              />
            </div>
          </div>

          {/* freee連携 */}
          <div className="border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">freee連携</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fields.freeePartnerId.id}>freee取引先ID</Label>
                <Input
                  {...getInputProps(fields.freeePartnerId, { type: 'number' })}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={fields.freeePartnerName.id}>
                  freee取引先名
                </Label>
                <Input
                  {...getInputProps(fields.freeePartnerName, { type: 'text' })}
                  placeholder="株式会社サンプル"
                />
              </div>
            </div>
          </div>

          {/* 請求書テンプレート */}
          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium">請求書テンプレート</h4>
              {canSync && isEditing && orgSlug && defaultValue?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSyncing}
                  onClick={() => {
                    fetcher.load(
                      `/org/${orgSlug}/clients/api/sync-invoice?clientId=${defaultValue.id}`,
                    )
                  }}
                >
                  <RefreshCwIcon
                    className={`mr-1 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`}
                  />
                  {isSyncing ? '同期中...' : '請求書から同期'}
                </Button>
              )}
            </div>
            {syncedData && (
              <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                請求書から件名テンプレートと備考を同期しました。内容を確認して「更新」ボタンを押してください。
              </div>
            )}
            {syncError && (
              <div className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                {syncError}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={fields.invoiceSubjectTemplate.id}>
                  件名テンプレート
                </Label>
                <Input
                  {...getInputProps(fields.invoiceSubjectTemplate, {
                    type: 'text',
                  })}
                  key={`subject-${syncedData?.invoiceSubjectTemplate ?? 'default'}`}
                  defaultValue={
                    syncedData?.invoiceSubjectTemplate ??
                    fields.invoiceSubjectTemplate.initialValue ??
                    ''
                  }
                  placeholder="システム開発 {year}年{month}月"
                />
                <p className="text-muted-foreground text-xs">
                  {'{year}'} と {'{month}'} が置換されます
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={fields.paymentTerms.id}>支払条件</Label>
                <Select
                  name={fields.paymentTerms.name}
                  defaultValue={
                    fields.paymentTerms.initialValue ?? 'next_month_end'
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTermsOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={fields.invoiceNote.id}>備考</Label>
                <Textarea
                  {...getInputProps(fields.invoiceNote, { type: 'text' })}
                  key={`note-${syncedData?.invoiceNote ?? 'default'}`}
                  defaultValue={
                    syncedData?.invoiceNote ??
                    fields.invoiceNote.initialValue ??
                    ''
                  }
                  rows={3}
                  placeholder="* 当月末締翌月末払。&#10;* 振込手数料はご負担ください。"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" asChild>
              <Link to={backTo}>キャンセル</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : submitLabel}
            </Button>
          </div>
        </Form>
      </CardContent>
    </>
  )
}
