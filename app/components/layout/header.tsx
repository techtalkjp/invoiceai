import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { useBreadcrumbs } from '~/hooks/use-breadcrumbs'
import { cn } from '~/lib/utils'

interface HeaderProps extends Omit<
  React.ComponentPropsWithRef<'header'>,
  'children'
> {}

export const Header = ({ className, ...props }: HeaderProps) => {
  const { Breadcrumbs } = useBreadcrumbs()

  return (
    <header
      className={cn(
        'bg-background flex h-12 shrink-0 items-center gap-3 border-b px-4',
        className,
      )}
      {...props}
    >
      <SidebarTrigger variant="outline" className="scale-125 sm:scale-100" />
      <Separator orientation="vertical" className="h-6" />
      <Breadcrumbs />
    </header>
  )
}
