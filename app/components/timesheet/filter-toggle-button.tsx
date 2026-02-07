import { FilterIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useTimesheetStore } from './store'

/**
 * 「入力済みのみ」フィルタトグルボタン。
 * store の showOnlyFilled を内部で subscribe するので、
 * 親コンポーネントの再レンダリングを引き起こさない。
 */
export function FilterToggleButton() {
  const showOnlyFilled = useTimesheetStore((s) => s.showOnlyFilled)

  return (
    <Button
      variant={showOnlyFilled ? 'secondary' : 'ghost'}
      size="sm"
      onClick={() => useTimesheetStore.getState().setShowOnlyFilled((v) => !v)}
      className="text-muted-foreground text-xs"
    >
      <FilterIcon className="size-3.5" />
      入力済みのみ
    </Button>
  )
}
