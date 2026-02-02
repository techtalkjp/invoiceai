import { XIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { TableCell } from '~/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

type Props = {
  clientId: string
  workDate: string
  hasData: boolean
}

export function ClearRowButton({ clientId, workDate, hasData }: Props) {
  const fetcher = useFetcher({ key: `clear-${workDate}` })
  const isClearing = fetcher.state !== 'idle'

  const handleClear = () => {
    fetcher.submit(
      {
        intent: 'saveEntry',
        clientId,
        workDate,
        startTime: '',
        endTime: '',
        breakMinutes: '0',
        description: '',
      },
      { method: 'POST' },
    )
  }

  if (!hasData) {
    return <TableCell className="w-8 p-0.5" />
  }

  return (
    <TableCell className="w-8 p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground hover:text-destructive h-7 w-7',
              isClearing && 'opacity-50',
            )}
            onClick={handleClear}
            disabled={isClearing}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">この日のデータをクリア</TooltipContent>
      </Tooltip>
    </TableCell>
  )
}
