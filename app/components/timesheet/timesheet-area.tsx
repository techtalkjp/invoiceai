import { ContextMenu, ContextMenuTrigger } from '~/components/ui/context-menu'
import { TimesheetContextMenuItems } from './context-menu-items'
import { FloatingToolbar } from './floating-toolbar'
import { SelectionHint } from './selection-hint'
import { TimesheetTable } from './table'
import { useTimesheetSelection } from './use-timesheet-selection'

interface TimesheetAreaProps {
  monthDates: string[]
  children: React.ReactNode
}

export function TimesheetArea({ monthDates, children }: TimesheetAreaProps) {
  const { handleMouseUp, handleClearSelection } = useTimesheetSelection()

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: selection clear on background click
    <div className="min-w-0 space-y-1" onClick={handleClearSelection}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
      <div onClick={(e) => e.stopPropagation()}>{children}</div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: stop propagation only */}
          <div
            className="overflow-x-auto rounded-md border select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <TimesheetTable monthDates={monthDates} onMouseUp={handleMouseUp} />
          </div>
        </ContextMenuTrigger>
        <TimesheetContextMenuItems />
      </ContextMenu>

      <SelectionHint />
      <FloatingToolbar />
    </div>
  )
}
