import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { cn } from '~/lib/utils'

interface HeaderProps extends React.ComponentPropsWithRef<'header'> {}

export const Header = ({ className, children, ...props }: HeaderProps) => {
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
      {children}
    </header>
  )
}
