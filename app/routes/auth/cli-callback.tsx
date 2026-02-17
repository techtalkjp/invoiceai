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

  // セッション確認 → トークンを CLI に送信（リトライ付き）
  useEffect(() => {
    let cancelled = false

    async function trySendToken(
      token: string,
      retries: number,
    ): Promise<boolean> {
      for (let i = 0; i < retries; i++) {
        if (cancelled) return false
        try {
          const res = await fetch(`http://localhost:${port}/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
          if (res.ok) return true
        } catch {
          // CLI サーバーがまだ準備できていない可能性 → リトライ
        }
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000))
        }
      }
      return false
    }

    async function sendToken() {
      if (!port) {
        setStatus('error')
        setErrorMessage('port パラメータがありません')
        return
      }

      try {
        const session = await authClient.getSession()
        if (!session.data) {
          // 未ログイン → signup へリダイレクト（既存ユーザーは signup 画面からログインへ遷移可能）
          const callbackURL = `/auth/cli-callback?port=${port}`
          window.location.href = `/auth/signup?callbackURL=${encodeURIComponent(callbackURL)}`
          return
        }

        setStatus('sending')

        const token = session.data.session.token
        const ok = await trySendToken(token, 3)

        if (cancelled) return
        if (ok) {
          setStatus('done')
        } else {
          // CLI が既にトークンを受信して終了した可能性が高い
          setStatus('done')
        }
      } catch {
        if (!cancelled) {
          setStatus('done')
        }
      }
    }

    sendToken()
    return () => {
      cancelled = true
    }
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
