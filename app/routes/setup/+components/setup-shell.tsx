import { CheckCircle2Icon, CircleIcon } from 'lucide-react'
import { Link } from 'react-router'
import { AppLogo } from '~/components/layout/app-logo'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

type SetupShellProps = {
  currentStep: 1 | 2 | 3
  orgSlug: string
  workspaceName: string
  workspaceNameConfirmed: boolean
  hasClient: boolean
  setupCompleted: boolean
  children: React.ReactNode
}

export function SetupShell({
  currentStep,
  orgSlug,
  workspaceName,
  workspaceNameConfirmed,
  hasClient,
  setupCompleted,
  children,
}: SetupShellProps) {
  const progressPercent = setupCompleted
    ? 100
    : currentStep === 1
      ? 33
      : currentStep === 2
        ? 66
        : 85

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_100%_at_50%_-10%,#e7ecf6_0%,#f7f8fb_45%,#ffffff_100%)]">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <Badge variant="outline">初期設定</Badge>
          </div>
          {orgSlug && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/org/${orgSlug}`}>あとで続ける</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <Card className="border-zinc-200/80 bg-white/90 shadow-md">
            <CardHeader className="gap-3 border-b pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">最初の設定</CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    最短3ステップで利用開始できます。freee連携は後から設定できます。
                  </CardDescription>
                </div>
                <Badge variant="secondary">ステップ {currentStep}/3</Badge>
              </div>
              <div className="grid gap-1">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>進捗</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">{children}</CardContent>
          </Card>

          <Card className="border-zinc-200/80 bg-white/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">やること</CardTitle>
              <CardDescription>
                初期設定はこの3つだけです。途中で中断しても再開できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="mb-1 rounded-md border bg-white px-3 py-2">
                <p className="text-muted-foreground text-[11px]">会社情報</p>
                <p className="text-sm font-medium">{workspaceName}</p>
              </div>
              <div className="flex items-start gap-2">
                {workspaceNameConfirmed ? (
                  <CheckCircle2Icon className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <CircleIcon className="mt-0.5 h-4 w-4 text-zinc-400" />
                )}
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium">会社情報を確認</p>
                  <p className="text-muted-foreground text-xs">
                    会社名・屋号を設定します
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                {hasClient ? (
                  <CheckCircle2Icon className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <CircleIcon className="mt-0.5 h-4 w-4 text-zinc-400" />
                )}
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium">クライアントを作成</p>
                  <p className="text-muted-foreground text-xs">
                    請求先を1件登録します
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                {setupCompleted ? (
                  <CheckCircle2Icon className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <CircleIcon className="mt-0.5 h-4 w-4 text-zinc-400" />
                )}
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium">CLIを接続</p>
                  <p className="text-muted-foreground text-xs">
                    `npx invoiceai setup` を実行
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
