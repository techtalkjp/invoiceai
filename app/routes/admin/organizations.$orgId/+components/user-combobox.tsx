import { useCallback, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import { useStableFetcher } from '~/hooks/use-stable-fetcher'
import type { loader } from '../users'

interface UserComboboxProps {
  orgId: string
  value: string
  onValueChange: (value: string) => void
}

export function UserCombobox({
  orgId,
  value,
  onValueChange,
}: UserComboboxProps) {
  const fetcher = useStableFetcher<typeof loader>()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const loadUsers = useCallback(
    (q: string) => {
      fetcher.load(
        `/admin/organizations/${orgId}/users?q=${encodeURIComponent(q)}`,
      )
    },
    [orgId, fetcher.load],
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        loadUsers(query)
      }
    },
    [loadUsers, query],
  )

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setQuery(q)
      if (open) {
        loadUsers(q)
      }
    },
    [open, loadUsers],
  )

  const users = fetcher.data?.users ?? []
  const isLoading = fetcher.state === 'loading'

  return (
    <Combobox
      value={value}
      onValueChange={(v) => onValueChange(v ?? '')}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <ComboboxInput
        placeholder="名前またはメールで検索..."
        className="w-full"
        value={query}
        onChange={handleQueryChange}
      />
      <ComboboxContent>
        <ComboboxList>
          {isLoading ? (
            <div className="text-muted-foreground py-2 text-center text-sm">
              読み込み中...
            </div>
          ) : (
            <>
              <ComboboxEmpty>ユーザーが見つかりません</ComboboxEmpty>
              {users.map((user) => (
                <ComboboxItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </ComboboxItem>
              ))}
            </>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
