import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'

interface TextTabProps {
  inputText: string
  onInputTextChange: (text: string) => void
  isParsing: boolean
  onParse: () => void
  error?: string | undefined
  parseErrors?: string[] | undefined
}

export function TextTab({
  inputText,
  onInputTextChange,
  isParsing,
  onParse,
  error,
  parseErrors,
}: TextTabProps) {
  return (
    <div className="grid gap-2">
      <Textarea
        placeholder={`稼働テキストを貼り付け（例）\n1/15 9:00-18:00 休憩1h タスクA対応\n1/16 10:00-17:00 MTG、ドキュメント作成`}
        className="max-h-40 min-h-20 resize-none"
        rows={3}
        value={inputText}
        onChange={(e) => onInputTextChange(e.target.value)}
        disabled={isParsing}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {parseErrors && parseErrors.length > 0 && (
        <div className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          {parseErrors.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      <Button
        size="sm"
        onClick={onParse}
        disabled={!inputText.trim() || isParsing}
        className="self-center"
      >
        {isParsing ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            解析中...
          </>
        ) : (
          <>
            <SparklesIcon className="size-4" />
            AIで解析して反映
          </>
        )}
      </Button>
    </div>
  )
}
