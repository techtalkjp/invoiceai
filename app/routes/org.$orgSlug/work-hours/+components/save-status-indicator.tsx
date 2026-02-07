import { CheckIcon, LoaderIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

/**
 * 自動保存のステータスを表示する独立コンポーネント。
 * useFetcher の key を共有することで、useWorkHoursAutoSave と同じ fetcher を参照する。
 * 親コンポーネントの再レンダリングを引き起こさない。
 */
export function SaveStatusIndicator({ fetcherKey }: { fetcherKey: string }) {
  const fetcher = useFetcher({ key: fetcherKey })
  const prevStateRef = useRef(fetcher.state)
  const [showSaved, setShowSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // saving → idle への遷移を検出して「保存済み」を2秒間表示
  useEffect(() => {
    if (
      prevStateRef.current !== 'idle' &&
      fetcher.state === 'idle' &&
      fetcher.data
    ) {
      setShowSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000)
    }
    prevStateRef.current = fetcher.state

    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [fetcher.state, fetcher.data])

  if (fetcher.state !== 'idle') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <LoaderIcon className="size-3 animate-spin" />
        保存中…
      </span>
    )
  }

  if (showSaved) {
    return (
      <span className="text-muted-foreground animate-in fade-in flex items-center gap-1 text-xs">
        <CheckIcon className="size-3" />
        保存済み
      </span>
    )
  }

  return null
}
