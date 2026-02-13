import { Link, redirect } from 'react-router'
import { AppLogo } from '~/components/layout/app-logo'
import { PublicLayout } from '~/components/layout/public-layout'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { getFirstOrganization, getSession } from '~/lib/auth-helpers.server'
import type { Route } from './+types/index'

export function meta() {
  return [
    { title: 'Invoice AI' },
    { name: 'description', content: 'Invoice AI - 請求書管理システム' },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request)

  // 未ログインまたは anonymous ユーザーならログイン画面を表示
  if (!session?.user || session.user.isAnonymous) {
    return { authenticated: false }
  }

  // ログイン済みなら組織ダッシュボードへ
  const org = await getFirstOrganization(session.user.id)
  if (org?.slug) {
    throw redirect(`/org/${org.slug}`)
  }

  // 組織未所属
  return { authenticated: true, noOrganization: true }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (!loaderData.authenticated) {
    return (
      <PublicLayout>
        <div className="flex min-h-[80vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-col items-center gap-2 text-center">
              <AppLogo size="lg" />
              <CardDescription>請求書管理システム</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button asChild>
                <Link to="/auth/signin">ログイン</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/auth/signup">新規登録</Link>
              </Button>
              <Link
                to="/playground"
                className="text-muted-foreground hover:text-foreground text-center text-sm underline underline-offset-2"
              >
                Playground を試す
              </Link>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  // 組織未所属の場合
  return (
    <PublicLayout>
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">組織に所属していません</CardTitle>
            <CardDescription>
              組織に招待されるか、管理者にお問い合わせください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline" asChild>
              <Link to="/auth/signin">別のアカウントでログイン</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  )
}
