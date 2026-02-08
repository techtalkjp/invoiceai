import { cn } from '~/lib/utils'

export function ContentPanel({
  children,
  className,
  toolbar,
}: {
  children: React.ReactNode
  className?: string | undefined
  toolbar?: React.ReactNode | undefined
}) {
  const content = (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      {children}
    </div>
  )

  if (!toolbar) return content

  return (
    <div className="space-y-1">
      {toolbar}
      {content}
    </div>
  )
}
