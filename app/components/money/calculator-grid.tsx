import {
  DeleteIcon,
  DivideIcon,
  EqualIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { Button } from '~/components/ui/button'
import { evaluateExpression } from './evaluate-expression'
import { formatMoney } from './format-money'

interface CalculatorGridProps {
  initialValue?: string | undefined
  onConfirm: (value: number) => void
  onCancel: () => void
}

// --- Expression reducer ---

type Action =
  | { type: 'append'; value: string }
  | { type: 'negate' }
  | { type: 'clear' }
  | { type: 'backspace' }

function expressionReducer(state: string, action: Action): string {
  switch (action.type) {
    case 'append':
      return state + action.value
    case 'negate':
      if (state === '' || state === '0') return '-'
      return state.startsWith('-') ? state.slice(1) : `-${state}`
    case 'clear':
      return ''
    case 'backspace':
      return state.slice(0, -1)
  }
}

// --- Shared button style ---

const iconClass = 'size-4'
const btnClass = 'h-9 font-mono text-base tabular-nums'

function CalcBtn({
  label,
  ariaLabel,
  variant,
  onClick,
}: {
  label: React.ReactNode
  ariaLabel: string
  variant: 'default' | 'outline' | 'ghost' | 'secondary'
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={ariaLabel}
      onClick={onClick}
      className={btnClass}
    >
      {label}
    </Button>
  )
}

// --- Main component ---

export function CalculatorGrid({
  initialValue,
  onConfirm,
  onCancel,
}: CalculatorGridProps) {
  const [expr, dispatch] = useReducer(
    expressionReducer,
    initialValue && initialValue !== '0' ? initialValue : '',
  )

  const containerRef = useRef<HTMLDivElement>(null)
  // Sync external DOM focus
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const preview = useMemo(
    () => (expr ? evaluateExpression(expr) : null),
    [expr],
  )

  const confirm = () => {
    if (preview !== null) onConfirm(preview)
  }
  const ap = (v: string) => () => dispatch({ type: 'append', value: v })

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (/^[0-9+\-*/.]$/.test(e.key)) {
      e.preventDefault()
      dispatch({ type: 'append', value: e.key })
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      dispatch({ type: 'backspace' })
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault()
      confirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Delete') {
      e.preventDefault()
      dispatch({ type: 'clear' })
    }
  }

  return (
    <div
      ref={containerRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" で電卓キーボード入力を受け付ける
      tabIndex={0}
      role="application"
      aria-label="電卓"
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-2 outline-none"
    >
      {/* ディスプレイ */}
      <div className="bg-muted/30 space-y-1 rounded-md border px-3 py-2">
        <div className="text-muted-foreground min-h-5 text-right font-mono text-sm">
          {expr || '0'}
        </div>
        <div className="min-h-7 text-right font-mono text-lg font-semibold tabular-nums">
          {preview !== null ? `= ${formatMoney(preview)}` : '\u00A0'}
        </div>
      </div>

      {/* ボタングリッド */}
      <div className="grid grid-cols-4 gap-1">
        {/* Row 1: ⌫ AC 00 ÷ */}
        <CalcBtn
          label={<DeleteIcon className={iconClass} />}
          ariaLabel="バックスペース"
          variant="ghost"
          onClick={() => dispatch({ type: 'backspace' })}
        />
        <CalcBtn
          label="AC"
          ariaLabel="クリア"
          variant="ghost"
          onClick={() => dispatch({ type: 'clear' })}
        />
        <CalcBtn label="00" ariaLabel="00" variant="ghost" onClick={ap('00')} />
        <CalcBtn
          label={<DivideIcon className={iconClass} />}
          ariaLabel="÷"
          variant="secondary"
          onClick={ap('/')}
        />
        {/* Row 2: 7 8 9 × */}
        <CalcBtn label="7" ariaLabel="7" variant="outline" onClick={ap('7')} />
        <CalcBtn label="8" ariaLabel="8" variant="outline" onClick={ap('8')} />
        <CalcBtn label="9" ariaLabel="9" variant="outline" onClick={ap('9')} />
        <CalcBtn
          label={<XIcon className={iconClass} />}
          ariaLabel="×"
          variant="secondary"
          onClick={ap('*')}
        />
        {/* Row 3: 4 5 6 − */}
        <CalcBtn label="4" ariaLabel="4" variant="outline" onClick={ap('4')} />
        <CalcBtn label="5" ariaLabel="5" variant="outline" onClick={ap('5')} />
        <CalcBtn label="6" ariaLabel="6" variant="outline" onClick={ap('6')} />
        <CalcBtn
          label={<MinusIcon className={iconClass} />}
          ariaLabel="−"
          variant="secondary"
          onClick={ap('-')}
        />
        {/* Row 4: 1 2 3 + */}
        <CalcBtn label="1" ariaLabel="1" variant="outline" onClick={ap('1')} />
        <CalcBtn label="2" ariaLabel="2" variant="outline" onClick={ap('2')} />
        <CalcBtn label="3" ariaLabel="3" variant="outline" onClick={ap('3')} />
        <CalcBtn
          label={<PlusIcon className={iconClass} />}
          ariaLabel="+"
          variant="secondary"
          onClick={ap('+')}
        />
        {/* Row 5: ± 0 . = */}
        <CalcBtn
          label="±"
          ariaLabel="±"
          variant="ghost"
          onClick={() => dispatch({ type: 'negate' })}
        />
        <CalcBtn label="0" ariaLabel="0" variant="outline" onClick={ap('0')} />
        <CalcBtn label="." ariaLabel="." variant="outline" onClick={ap('.')} />
        <CalcBtn
          label={<EqualIcon className={iconClass} />}
          ariaLabel="="
          variant="default"
          onClick={confirm}
        />
      </div>
    </div>
  )
}
