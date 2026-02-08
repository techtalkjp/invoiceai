import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { PublicLayout } from '~/components/layout/public-layout'
import { PasswordInput } from '~/components/password-input'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { signUp } from '~/lib/auth-client'
import { isFeatureEnabled } from '~/lib/feature-flags.server'
import type { Route } from './+types/signup'

export async function loader() {
  const signupEnabled = await isFeatureEnabled('signup_enabled')
  return { signupEnabled }
}

export const formSchema = z
  .object({
    name: z
      .string({ error: '名前を入力してください' })
      .min(1, { message: '名前を入力してください' }),
    email: z.email({
      error: (issue) =>
        issue.input === undefined
          ? 'メールアドレスを入力してください'
          : '有効なメールアドレスを入力してください',
    }),
    password: z
      .string({ error: 'パスワードを入力してください' })
      .min(8, { message: 'パスワードは8文字以上で入力してください' }),
    confirmPassword: z.string({
      error: 'パスワード確認を入力してください',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  })

export default function SignUp({ loaderData }: Route.ComponentProps) {
  const { signupEnabled } = loaderData
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, { name, email, password, confirmPassword }] = useForm({
    defaultValue: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    shouldRevalidate: 'onBlur',
    onSubmit: async (event, { submission }) => {
      event.preventDefault()
      if (submission?.status !== 'success') {
        return
      }

      setServerError(null)
      setIsLoading(true)

      try {
        const result = await signUp.email({
          name: submission.value.name,
          email: submission.value.email,
          password: submission.value.password,
        })

        if (result.error) {
          setServerError(result.error.message ?? '登録に失敗しました')
          setIsLoading(false)
          return
        }

        navigate('/')
      } catch {
        setServerError('登録に失敗しました')
        setIsLoading(false)
      }
    },
  })

  if (!signupEnabled) {
    return (
      <PublicLayout>
        <div className="flex min-h-[80vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">登録受付停止中</CardTitle>
              <CardDescription>
                現在、新規登録は受け付けていません。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/auth/signin">ログインはこちら</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">アカウント登録</CardTitle>
            <CardDescription>
              新しいアカウントを作成してください
            </CardDescription>
          </CardHeader>
          <form {...getFormProps(form)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {serverError}
                </div>
              )}
              {form.errors && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {form.errors}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={name.id}>名前</Label>
                <Input
                  {...getInputProps(name, { type: 'text' })}
                  placeholder="山田 太郎"
                  disabled={isLoading}
                />
                <div
                  id={name.errorId}
                  className="text-destructive text-sm empty:hidden"
                >
                  {name.errors}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={email.id}>メールアドレス</Label>
                <Input
                  {...getInputProps(email, { type: 'email' })}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
                <div
                  id={email.errorId}
                  className="text-destructive text-sm empty:hidden"
                >
                  {email.errors}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={password.id}>パスワード</Label>
                <PasswordInput
                  {...getInputProps(password, { type: 'password' })}
                  placeholder="8文字以上"
                  disabled={isLoading}
                />
                <div
                  id={password.errorId}
                  className="text-destructive text-sm empty:hidden"
                >
                  {password.errors}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={confirmPassword.id}>パスワード（確認）</Label>
                <PasswordInput
                  {...getInputProps(confirmPassword, { type: 'password' })}
                  placeholder="パスワードを再入力"
                  disabled={isLoading}
                />
                <div
                  id={confirmPassword.errorId}
                  className="text-destructive text-sm empty:hidden"
                >
                  {confirmPassword.errors}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '登録中...' : '登録する'}
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                すでにアカウントをお持ちですか？{' '}
                <Link
                  to="/auth/signin"
                  className="text-primary hover:underline"
                >
                  ログイン
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PublicLayout>
  )
}
