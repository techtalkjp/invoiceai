interface ControlBarProps {
  left?: React.ReactNode | undefined
  right?: React.ReactNode | undefined
}

export function ControlBar({ left, right }: ControlBarProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
      {left && (
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          {left}
        </div>
      )}
      {right && (
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 sm:gap-4">
          {right}
        </div>
      )}
    </div>
  )
}
