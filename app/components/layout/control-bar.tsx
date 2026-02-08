interface ControlBarProps {
  left?: React.ReactNode | undefined
  right?: React.ReactNode | undefined
}

export function ControlBar({ left, right }: ControlBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {left && (
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          {left}
        </div>
      )}
      {right && (
        <div className="flex items-center justify-end gap-2 sm:gap-4">
          {right}
        </div>
      )}
    </div>
  )
}
