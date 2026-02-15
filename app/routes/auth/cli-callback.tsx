import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PublicLayout } from '~/components/layout/public-layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { authClient } from '~/lib/auth-client'

/**
 * CLI ログインコールバックページ
 *
 * フロー:
 * 1. CLI が localhost:PORT にサーバーを起動
 * 2. ブラウザで /auth/cli-callback?port=PORT を開く
 * 3. ログイン済みならセッショントークンを localhost に送信
 * 4. 未ログインなら /auth/signin?callbackURL=/auth/cli-callback?port=PORT へリダイレクト
 */
export default function CliCallback() {
  const [searchParams] = useSearchParams()
  const port = searchParams.get('port')
  const [status, setStatus] = useState<
    'checking' | 'sending' | 'done' | 'error'
  >('checking')
  const [errorMessage, setErrorMessage] = useState('')

  // セッション確認 → トークンを CLI に送信
  useEffect(() => {
    async function sendToken() {
      if (!port) {
        setStatus('error')
        setErrorMessage('port パラメータがありません')
        return
      }

      try {
        const session = await authClient.getSession()
        if (!session.data) {
          // 未ログイン → signin へリダイレクト
          const callbackURL = `/auth/cli-callback?port=${port}`
          window.location.href = `/auth/signin?callbackURL=${encodeURIComponent(callbackURL)}`
          return
        }

        setStatus('sending')

        // セッショントークンを CLI のローカルサーバーに送信
        const token = session.data.session.token
        const res = await fetch(`http://localhost:${port}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        if (res.ok) {
          setStatus('done')
        } else {
          setStatus('error')
          setErrorMessage('CLI へのトークン送信に失敗しました')
        }
      } catch {
        setStatus('error')
        setErrorMessage(
          'CLI へのトークン送信に失敗しました。CLI が起動していることを確認してください。',
        )
      }
    }

    sendToken()
  }, [port])

  return (
    <PublicLayout>
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">CLI ログイン</CardTitle>
            <CardDescription>
              {status === 'checking' && 'セッションを確認中...'}
              {status === 'sending' && 'CLI にトークンを送信中...'}
              {status === 'done' && 'ログイン完了'}
              {status === 'error' && 'エラー'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {status === 'done' && (
              <p className="text-muted-foreground">
                このページを閉じて、ターミナルに戻ってください。
              </p>
            )}
            {status === 'error' && (
              <p className="text-destructive text-sm">{errorMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  )
}
