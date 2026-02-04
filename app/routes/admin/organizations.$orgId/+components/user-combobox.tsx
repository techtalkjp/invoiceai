import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
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
  const fetcher = useFetcher<typeof loader>()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  // Combobox が開いたとき、または検索クエリが変わったときにロード
  useEffect(() => {
    if (open) {
      fetcher.load(
        `/admin/organizations/${orgId}/users?q=${encodeURIComponent(query)}`,
      )
    }
  }, [open, query, orgId, fetcher.load])

  const users = fetcher.data?.users ?? []
  const isLoading = fetcher.state === 'loading'

  return (
    <Combobox
      value={value}
      onValueChange={(v) => onValueChange(v ?? '')}
      open={open}
      onOpenChange={setOpen}
    >
      <ComboboxInput
        placeholder="名前またはメールで検索..."
        className="w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
