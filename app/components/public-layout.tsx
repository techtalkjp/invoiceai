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
import { AppLogo } from './app-logo'

function HeaderNav() {
  const { data: session, isPending } = useSession()

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

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/60 bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <AppLogo size="sm" />
          </Link>
          <HeaderNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-2 pt-4 pb-8 sm:px-6 sm:pt-10 sm:pb-16">
        {children}
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
