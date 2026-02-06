import { ReceiptTextIcon } from 'lucide-react'
import { cn } from '~/lib/utils'

export function AppLogo({
  size = 'default',
  showText = true,
}: {
  size?: 'sm' | 'default' | 'lg' | undefined
  showText?: boolean | undefined
}) {
  const iconSize = {
    sm: 'h-5 w-5',
    default: 'h-8 w-8',
    lg: 'h-10 w-10',
  }[size]

  const iconPadding = {
    sm: 'h-7 w-7',
    default: 'h-8 w-8',
    lg: 'h-12 w-12',
  }[size]

  const textSize = {
    sm: 'text-base',
    default: 'text-lg',
    lg: 'text-3xl',
  }[size]

  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-lg',
          'bg-gradient-to-br from-zinc-700 to-zinc-900 text-white shadow-sm',
          iconPadding,
        )}
      >
        <ReceiptTextIcon className={iconSize} />
      </span>
      {showText && (
        <span className={cn('font-bold tracking-tight', textSize)}>
          Invoice{' '}
          <span className="bg-gradient-to-r from-zinc-600 to-zinc-900 bg-clip-text text-transparent">
            AI
          </span>
        </span>
      )}
    </span>
  )
}
