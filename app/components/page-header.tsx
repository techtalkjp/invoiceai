import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'

interface PageHeaderProps {
  title: string
  subtitle?: string | undefined
  backTo?: string | undefined
  actions?: React.ReactNode | undefined
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {backTo && (
          <Button variant="ghost" size="icon" asChild>
            <Link to={backTo}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
