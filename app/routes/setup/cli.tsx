import { ArrowLeftIcon, CopyIcon, TerminalIcon } from 'lucide-react'
import { useState } from 'react'
import { Form, Link, redirect, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { getSetupState } from './+queries.server'
import { completeSetup } from './+services.server'
import type { Route } from './+types/cli'
import type { SetupContext } from './_layout'

export async function action({ request }: Route.ActionArgs) {
  const setup = await getSetupState(request)
  const formData = await request.formData()
  const intent = String(formData.get('intent') ?? '')

  if (intent === 'complete-setup') {
    await completeSetup({
      organizationId: setup.organizationId,
      userId: setup.userId,
    })
    if (setup.orgSlug) {
      throw redirect(`/org/${setup.orgSlug}`)
    }
    throw redirect('/')
  }

  throw redirect('/setup/cli')
}

export default function SetupCli() {
  const setup = useOutletContext<SetupContext>()
  const [copied, setCopied] = useState(false)
  const cliCommand = 'npx invoiceai setup'

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(cliCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="font-medium">ステップ 3: CLI 接続</p>
        <p className="text-muted-foreground text-sm">
          下のコマンドを実行すると、CLIの初期設定が始まります。
        </p>
        <p className="text-muted-foreground text-xs">
          現在の会社情報: {setup.workspaceName}
        </p>
      </div>

      <div className="rounded-xl bg-zinc-950 p-4 text-zinc-100">
        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
          <TerminalIcon className="h-3.5 w-3.5" />
          ターミナル
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="text-sm">{cliCommand}</code>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={copyCommand}
          >
            <CopyIcon className="mr-1 h-4 w-4" />
            {copied ? 'コピー済み' : 'コピー'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-full justify-start px-0 sm:w-auto"
        >
          <Link to="/setup/client">
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            戻る
          </Link>
        </Button>
        <Form method="POST">
          <input type="hidden" name="intent" value="complete-setup" />
          <Button size="lg" type="submit" className="w-full sm:w-auto">
            初期設定を完了してダッシュボードへ
          </Button>
        </Form>
      </div>
    </div>
  )
}
