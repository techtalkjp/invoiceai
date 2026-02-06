import { cn } from '~/lib/utils'

export function ContentPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string | undefined
}) {
  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      {children}
    </div>
  )
}
