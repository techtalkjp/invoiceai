import { parseSubmission, report } from '@conform-to/react/future'
import { coerceFormValue, formatResult } from '@conform-to/zod/v4/future'
import { Form, Link } from 'react-router'
import { z } from 'zod/v4'
import { ContentPanel } from '~/components/layout/content-panel'
import { PageHeader } from '~/components/layout/page-header'
import { PublicLayout } from '~/components/layout/public-layout'
import { MoneyInput } from '~/components/money/money-input'
import { PasswordInput } from '~/components/password-input'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { useForm } from '~/lib/form'
import type { Route } from './+types/index'

// --- 1. 基本 Input (signin 相当) ---
const loginSchema = coerceFormValue(
  z.object({
    email: z.email('有効なメールアドレスを入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上'),
  }),
)

// --- 2. Select + MoneyInput + Textarea (client-form 相当) ---
const clientSchema = coerceFormValue(
  z.object({
    name: z.string().min(1, 'クライアント名を入力してください'),
    billingType: z.enum(['fixed', 'time']),
    hourlyRate: z.number().int().min(0).optional(),
    monthlyFee: z.number().int().min(0).optional(),
    note: z.string().optional(),
  }),
)

// --- 3. refine / クロスフィールド (signup 相当) ---
const signupSchema = coerceFormValue(
  z
    .object({
      name: z.string().min(1, '名前を入力してください'),
      email: z.email('有効なメールアドレスを入力してください'),
      password: z.string().min(8, 'パスワードは8文字以上'),
      confirmPassword: z.string().min(1, 'パスワード確認を入力してください'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'パスワードが一致しません',
      path: ['confirmPassword'],
    }),
)

// --- 4. discriminatedUnion / intent (members 相当) ---
const addMemberSchema = z.object({
  intent: z.literal('addMember'),
  userId: z.string().min(1, 'ユーザーを選択してください'),
  role: z.enum(['owner', 'admin', 'member']),
})

const removeMemberSchema = z.object({
  intent: z.literal('removeMember'),
  memberId: z.string().min(1),
})

const memberSchema = coerceFormValue(
  z.discriminatedUnion('intent', [addMemberSchema, removeMemberSchema]),
)

// --- 5. Checkbox + Switch + PasswordInput ---
const settingsSchema = coerceFormValue(
  z
    .object({
      username: z.string().min(1, 'ユーザー名を入力してください'),
      newPassword: z.string().min(8, 'パスワードは8文字以上'),
      confirmPassword: z.string().min(1, 'パスワード確認を入力してください'),
      agreeToTerms: z.boolean({ error: '利用規約に同意してください' }),
      enableNotifications: z.boolean().optional(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'パスワードが一致しません',
      path: ['confirmPassword'],
    }),
)

// action: 全スキーマを intent で分岐
function validate(schema: z.ZodType, payload: Record<string, unknown>) {
  return formatResult(schema.safeParse(payload))
}

const schemas = {
  login: loginSchema,
  client: clientSchema,
  signup: signupSchema,
  member: memberSchema,
  settings: settingsSchema,
}

export function meta() {
  return [{ title: 'Forms Playground - InvoiceAI' }]
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const formType = formData.get('_formType') as keyof typeof schemas | null
  if (!formType || !(formType in schemas)) {
    return { formType: null, lastResult: null, raw: null }
  }

  const submission = parseSubmission(formData)
  const error = validate(schemas[formType], submission.payload)
  return {
    formType,
    lastResult: report(submission, { error }),
    raw: Object.fromEntries(formData),
  }
}

export default function FormsPlayground({ actionData }: Route.ComponentProps) {
  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-2xl gap-6 py-4 sm:py-8">
        <PageHeader
          title="Forms Playground"
          subtitle="各種フォームパターンのデモ"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/playground">← Playground</Link>
            </Button>
          }
        />

        <LoginForm
          lastResult={
            actionData?.formType === 'login' ? actionData.lastResult : undefined
          }
          raw={actionData?.formType === 'login' ? actionData.raw : undefined}
        />

        <ClientForm
          lastResult={
            actionData?.formType === 'client'
              ? actionData.lastResult
              : undefined
          }
          raw={actionData?.formType === 'client' ? actionData.raw : undefined}
        />

        <SignupForm
          lastResult={
            actionData?.formType === 'signup'
              ? actionData.lastResult
              : undefined
          }
          raw={actionData?.formType === 'signup' ? actionData.raw : undefined}
        />

        <MemberForm
          lastResult={
            actionData?.formType === 'member'
              ? actionData.lastResult
              : undefined
          }
          raw={actionData?.formType === 'member' ? actionData.raw : undefined}
        />

        <SettingsForm
          lastResult={
            actionData?.formType === 'settings'
              ? actionData.lastResult
              : undefined
          }
          raw={actionData?.formType === 'settings' ? actionData.raw : undefined}
        />
      </div>
    </PublicLayout>
  )
}

// --- FieldError 表示ヘルパー ---
function FieldError({ errors }: { errors: string[] | undefined }) {
  if (!errors?.length) return null
  return <div className="text-destructive text-sm">{errors.join(', ')}</div>
}

// --- 送信結果表示 ---
function SubmittedData({
  raw,
}: {
  raw: Record<string, unknown> | null | undefined
}) {
  if (!raw) return null
  return (
    <div className="rounded-md border p-4">
      <h4 className="mb-2 text-sm font-medium">送信データ:</h4>
      <pre className="text-muted-foreground text-xs">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </div>
  )
}

// --- 1. Login Form ---
function LoginForm({
  lastResult,
  raw,
}: {
  lastResult: ReturnType<typeof report> | null | undefined
  raw: Record<string, unknown> | null | undefined
}) {
  const { form, fields } = useForm(loginSchema, {
    lastResult: lastResult ?? undefined,
    defaultValue: { email: '', password: '' },
  })

  return (
    <ContentPanel className="p-6">
      <h3 className="mb-1 text-lg font-semibold">1. ログインフォーム</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        メール + パスワードの基本入力
      </p>
      <Form method="POST" {...form.props} className="space-y-4">
        <input type="hidden" name="_formType" value="login" />

        <div className="space-y-2">
          <Label htmlFor={fields.email.id}>メールアドレス</Label>
          <Input
            {...fields.email.inputProps}
            type="email"
            placeholder="you@example.com"
          />
          <FieldError errors={fields.email.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.password.id}>パスワード</Label>
          <PasswordInput
            {...fields.password.inputProps}
            placeholder="8文字以上"
          />
          <FieldError errors={fields.password.errors} />
        </div>

        <Button type="submit">ログイン</Button>
        <SubmittedData raw={raw} />
      </Form>
    </ContentPanel>
  )
}

// --- 2. Client Form ---
function ClientForm({
  lastResult,
  raw,
}: {
  lastResult: ReturnType<typeof report> | null | undefined
  raw: Record<string, unknown> | null | undefined
}) {
  const { form, fields } = useForm(clientSchema, {
    lastResult: lastResult ?? undefined,
    defaultValue: {
      name: '',
      billingType: 'time',
      hourlyRate: '0',
      monthlyFee: '0',
      note: '',
    },
  })

  return (
    <ContentPanel className="p-6">
      <h3 className="mb-1 text-lg font-semibold">
        2. クライアント登録フォーム
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">
        セレクト・金額入力・テキストエリアの組み合わせ
      </p>
      <Form method="POST" {...form.props} className="space-y-4">
        <input type="hidden" name="_formType" value="client" />

        <div className="space-y-2">
          <Label htmlFor={fields.name.id}>クライアント名</Label>
          <Input {...fields.name.inputProps} placeholder="株式会社サンプル" />
          <FieldError errors={fields.name.errors} />
        </div>

        <div className="space-y-2">
          <Label>請求タイプ</Label>
          <Select {...fields.billingType.selectProps}>
            <SelectTrigger {...fields.billingType.selectTriggerProps}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">タイムチャージ</SelectItem>
              <SelectItem value="fixed">固定月額</SelectItem>
            </SelectContent>
          </Select>
          <FieldError errors={fields.billingType.errors} />
        </div>

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
            <FieldError errors={fields.hourlyRate.errors} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fields.monthlyFee.id}>月額</Label>
            <MoneyInput
              {...fields.monthlyFee.moneyInputProps}
              suffix="/月"
              placeholder="100,000"
              step={10000}
              shiftStep={100000}
              calculator
            />
            <FieldError errors={fields.monthlyFee.errors} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.note.id}>備考</Label>
          <Textarea
            {...fields.note.textareaProps}
            placeholder="請求に関するメモ"
            rows={3}
          />
          <FieldError errors={fields.note.errors} />
        </div>

        <Button type="submit">保存</Button>
        <SubmittedData raw={raw} />
      </Form>
    </ContentPanel>
  )
}

// --- 3. Signup Form (refine) ---
function SignupForm({
  lastResult,
  raw,
}: {
  lastResult: ReturnType<typeof report> | null | undefined
  raw: Record<string, unknown> | null | undefined
}) {
  const { form, fields } = useForm(signupSchema, {
    lastResult: lastResult ?? undefined,
    defaultValue: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  return (
    <ContentPanel className="p-6">
      <h3 className="mb-1 text-lg font-semibold">3. 新規登録フォーム</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        パスワード確認の一致チェック付き
      </p>
      <Form method="POST" {...form.props} className="space-y-4">
        <input type="hidden" name="_formType" value="signup" />

        <div className="space-y-2">
          <Label htmlFor={fields.name.id}>名前</Label>
          <Input {...fields.name.inputProps} placeholder="山田太郎" />
          <FieldError errors={fields.name.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.email.id}>メールアドレス</Label>
          <Input
            {...fields.email.inputProps}
            type="email"
            placeholder="you@example.com"
          />
          <FieldError errors={fields.email.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.password.id}>パスワード</Label>
          <PasswordInput
            {...fields.password.inputProps}
            placeholder="8文字以上"
          />
          <FieldError errors={fields.password.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.confirmPassword.id}>パスワード確認</Label>
          <PasswordInput
            {...fields.confirmPassword.inputProps}
            placeholder="もう一度入力"
          />
          <FieldError errors={fields.confirmPassword.errors} />
        </div>

        <Button type="submit">登録</Button>
        <SubmittedData raw={raw} />
      </Form>
    </ContentPanel>
  )
}

// --- 4. Member Form (discriminatedUnion) ---
function MemberForm({
  lastResult,
  raw,
}: {
  lastResult: ReturnType<typeof report> | null | undefined
  raw: Record<string, unknown> | null | undefined
}) {
  // discriminatedUnion の場合、intent 単位のスキーマで useForm を使う
  const { form, fields } = useForm(addMemberSchema, {
    lastResult: lastResult ?? undefined,
    defaultValue: {
      intent: 'addMember',
      userId: '',
      role: 'member',
    },
  })

  const dummyUsers = [
    { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
    { id: 'user-3', name: 'Charlie', email: 'charlie@example.com' },
  ]

  return (
    <ContentPanel className="p-6">
      <h3 className="mb-1 text-lg font-semibold">4. メンバー追加フォーム</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        セレクトボックスとロール選択
      </p>
      <Form method="POST" {...form.props} className="space-y-4">
        <input type="hidden" name="_formType" value="member" />
        <input type="hidden" name="intent" value="addMember" />

        <div className="space-y-2">
          <Label>ユーザー</Label>
          <Select {...fields.userId.selectProps}>
            <SelectTrigger {...fields.userId.selectTriggerProps}>
              <SelectValue placeholder="ユーザーを選択" />
            </SelectTrigger>
            <SelectContent>
              {dummyUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={fields.userId.errors} />
        </div>

        <div className="space-y-2">
          <Label>ロール</Label>
          <Select {...fields.role.selectProps}>
            <SelectTrigger {...fields.role.selectTriggerProps}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">メンバー</SelectItem>
              <SelectItem value="admin">管理者</SelectItem>
              <SelectItem value="owner">オーナー</SelectItem>
            </SelectContent>
          </Select>
          <FieldError errors={fields.role.errors} />
        </div>

        <Button type="submit">メンバー追加</Button>
        <SubmittedData raw={raw} />
      </Form>
    </ContentPanel>
  )
}

// --- 5. Settings Form (Checkbox + Switch + PasswordInput) ---
function SettingsForm({
  lastResult,
  raw,
}: {
  lastResult: ReturnType<typeof report> | null | undefined
  raw: Record<string, unknown> | null | undefined
}) {
  const { form, fields } = useForm(settingsSchema, {
    lastResult: lastResult ?? undefined,
    defaultValue: {
      username: '',
      newPassword: '',
      confirmPassword: '',
      agreeToTerms: false,
      enableNotifications: true,
    },
  })

  return (
    <ContentPanel className="p-6">
      <h3 className="mb-1 text-lg font-semibold">5. 設定フォーム</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        チェックボックス・スイッチ・パスワード入力の組み合わせ
      </p>
      <Form method="POST" {...form.props} className="space-y-4">
        <input type="hidden" name="_formType" value="settings" />

        <div className="space-y-2">
          <Label htmlFor={fields.username.id}>ユーザー名</Label>
          <Input {...fields.username.inputProps} placeholder="username" />
          <FieldError errors={fields.username.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.newPassword.id}>新しいパスワード</Label>
          <PasswordInput
            {...fields.newPassword.passwordInputProps}
            placeholder="8文字以上"
          />
          <FieldError errors={fields.newPassword.errors} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.confirmPassword.id}>パスワード確認</Label>
          <PasswordInput
            {...fields.confirmPassword.passwordInputProps}
            placeholder="もう一度入力"
          />
          <FieldError errors={fields.confirmPassword.errors} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox {...fields.agreeToTerms.checkboxProps} />
          <Label htmlFor={fields.agreeToTerms.id}>利用規約に同意する</Label>
          <FieldError errors={fields.agreeToTerms.errors} />
        </div>

        <div className="flex items-center gap-2">
          <Switch {...fields.enableNotifications.switchProps} />
          <Label htmlFor={fields.enableNotifications.id}>
            通知を有効にする
          </Label>
        </div>

        <Button type="submit">設定を保存</Button>
        <SubmittedData raw={raw} />
      </Form>
    </ContentPanel>
  )
}
