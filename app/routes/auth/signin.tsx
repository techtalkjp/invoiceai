import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
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
import { signIn } from '~/lib/auth-client'

export const formSchema = z.object({
  email: z.email({
    error: (issue) =>
      issue.input === undefined
        ? 'メールアドレスを入力してください'
        : '有効なメールアドレスを入力してください',
  }),
  password: z.string({ error: 'パスワードを入力してください' }),
})

export default function SignIn() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, { email, password }] = useForm({
    defaultValue: {
      email: '',
      password: '',
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
        const result = await signIn.email({
          email: submission.value.email,
          password: submission.value.password,
        })

        if (result.error) {
          setServerError(result.error.message ?? 'ログインに失敗しました')
          setIsLoading(false)
          return
        }

        navigate('/')
      } catch {
        setServerError('ログインに失敗しました')
        setIsLoading(false)
      }
    },
  })

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">ログイン</CardTitle>
          <CardDescription>
            メールアドレスとパスワードでログイン
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
                disabled={isLoading}
              />
              <div
                id={password.errorId}
                className="text-destructive text-sm empty:hidden"
              >
                {password.errors}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              アカウントをお持ちでないですか？{' '}
              <Link to="/auth/signup" className="text-primary hover:underline">
                登録する
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
