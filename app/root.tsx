import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from 'react-router'

import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { signOut, useSession } from '~/lib/auth-client'
import type { Route } from './+types/root'
import './app.css'

export const links: Route.LinksFunction = () => []

function HeaderNav() {
  const { data: session, isPending } = useSession()

  // ログイン中のメニュー
  if (session?.user) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {session.user.name ?? session.user.email}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {session.user.role === 'admin' && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/admin">管理画面</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => signOut().then(() => window.location.reload())}
            >
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    )
  }

  // 未ログイン時のメニュー
  if (!isPending) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" asChild>
          <Link to="/auth/signin">ログイン</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/auth/signup">アカウント登録</Link>
        </Button>
      </nav>
    )
  }

  return null
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const location = useLocation()
  const isOrgRoute =
    location.pathname.startsWith('/org/') ||
    location.pathname.startsWith('/admin')

  // 組織ルートや管理画面では独自のレイアウトを使うため、シンプルなラッパーのみ
  if (isOrgRoute) {
    return (
      <div className="bg-background text-foreground min-h-screen">
        <Outlet />
      </div>
    )
  }

  // 通常ページ（ログイン、サインアップ、ホームなど）
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/60 bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-3 text-lg font-semibold"
          >
            <span className="bg-foreground text-background inline-flex h-9 w-9 items-center justify-center rounded-full">
              I
            </span>
            Invoice AI
          </Link>
          <HeaderNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <Outlet />
      </main>
      <footer className="border-border/60 text-muted-foreground border-t py-6 text-center text-xs">
        Copyright © {new Date().getFullYear()}{' '}
        <a
          href="https://www.techtalk.jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline underline-offset-2 transition-colors"
        >
          TechTalk Inc.
        </a>
      </footer>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{message}</h1>
      <p className="text-muted-foreground mt-2">{details}</p>
      {stack && (
        <pre className="bg-muted mt-4 w-full overflow-x-auto rounded-xl p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
