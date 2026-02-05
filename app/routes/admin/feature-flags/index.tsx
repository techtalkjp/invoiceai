import { parseWithZod } from '@conform-to/zod/v4'
import { FlagIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { z } from 'zod'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  type FeatureFlagKey,
  getFeatureFlags,
  setFeatureFlag,
} from '~/lib/feature-flags.server'
import { formatDate } from '~/utils/date'
import type { Route } from './+types/index'

const actionSchema = z.object({
  key: z.string(),
  enabled: z.string().transform((v) => v === 'true'),
})

export async function loader() {
  const flags = await getFeatureFlags()
  return { flags }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })

  if (submission.status !== 'success') {
    return { error: 'Invalid request' }
  }

  const { key, enabled } = submission.value
  await setFeatureFlag(key as FeatureFlagKey, enabled)

  return { success: true }
}

const flagDescriptions: Record<string, string> = {
  signup_enabled: '新規ユーザー登録の許可/不許可を制御します',
}

export default function FeatureFlagsPage({
  loaderData: { flags },
}: Route.ComponentProps) {
  const fetcher = useFetcher()

  const handleToggle = (key: string, currentValue: number) => {
    const newValue = currentValue !== 1
    fetcher.submit({ key, enabled: String(newValue) }, { method: 'post' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
        <p className="text-muted-foreground">
          アプリケーションの機能を制御するフラグを管理します
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlagIcon className="h-5 w-5" />
            フラグ一覧
          </CardTitle>
          <CardDescription>
            各フラグのON/OFFを切り替えて機能を制御できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              フラグが登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キー</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>更新日時</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-sm">
                      {flag.key}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {flag.description ?? flagDescriptions[flag.key] ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          flag.defaultValue === 1 ? 'default' : 'secondary'
                        }
                      >
                        {flag.defaultValue === 1 ? 'ON' : 'OFF'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(flag.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Label htmlFor={`flag-${flag.key}`} className="sr-only">
                          {flag.key}
                        </Label>
                        <Switch
                          id={`flag-${flag.key}`}
                          checked={flag.defaultValue === 1}
                          onCheckedChange={() =>
                            handleToggle(flag.key, flag.defaultValue)
                          }
                          disabled={fetcher.state !== 'idle'}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
