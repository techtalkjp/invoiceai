/**
 * MoneyInput - 金額入力コンポーネント
 *
 * @example conform + zod との統合
 * ```tsx
 * <MoneyInput
 *   {...getInputProps(fields.hourlyRate, { type: 'text' })}
 *   suffix="/ 時間"
 *   placeholder="10,000"
 *   step={500}
 *   shiftStep={5000}
 * />
 * ```
 *
 * @example スタンドアロン
 * ```tsx
 * <MoneyInput defaultValue="50000" suffix="/月" step={10000} />
 * ```
 *
 * 機能:
 * - ¥ プレフィックス / 任意のサフィックス
 * - 入力中もリアルタイム3桁カンマ表示（カーソル位置を自動補正）
 * - ショートカット: "10k" → 10,000 / "1.5m" → 1,500,000
 * - ↑/↓ で step 単位、Shift+↑/↓ で shiftStep 単位の増減
 * - Enter で確定、Escape で取消
 * - hidden input でフォーム送信（conform 互換）
 * - calculator prop でポップオーバー電卓UI（四則演算+括弧）
 */
import { CalculatorIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '~/components/ui/input-group'
import { Popover, PopoverAnchor, PopoverContent } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { CalculatorGrid } from './calculator-grid'
import { formatMoney } from './format-money'

// --- 内部ヘルパー ---

/**
 * ユーザー入力文字列を数値にパースする
 *
 * 対応形式:
 *   - プレーン数値: "10000" => 10000
 *   - カンマ付き: "10,000" => 10000
 *   - k/K（千）: "10k" => 10000, "1.5k" => 1500
 *   - m/M（百万）: "1m" => 1000000
 *   - ¥記号除去: "¥10000" => 10000
 *   - 全角数字: "１０，０００" => 10000
 *
 * パースできない場合は null を返す
 */
export function parseMoneyInput(input: string): number | null {
  let s = input.trim()
  if (s === '') return null

  // ¥記号を除去
  s = s.replace(/^[¥￥]/, '')

  // 全角→半角変換
  s = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
  s = s.replace(/，/g, ',')
  s = s.replace(/．/g, '.')

  // カンマを除去
  s = s.replace(/,/g, '')

  // 空白を除去
  s = s.replace(/\s/g, '')

  if (s === '') return null

  // ショートカットサフィックス（k/K, m/M）
  const suffixMatch = /^(-?\d*\.?\d+)([kmKM])$/.exec(s)
  if (suffixMatch?.[1] != null && suffixMatch[2] != null) {
    const num = Number.parseFloat(suffixMatch[1])
    if (Number.isNaN(num)) return null
    const suffix = suffixMatch[2].toLowerCase()
    const multiplier = suffix === 'k' ? 1000 : 1000000
    return Math.round(num * multiplier)
  }

  // プレーン数値
  const num = Number(s)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return Math.round(num)
}

/** 値を min/max の範囲に制限する */
export function clampMoney(
  value: number,
  min?: number | undefined,
  max?: number | undefined,
): number {
  let result = value
  if (min != null && result < min) result = min
  if (max != null && result > max) result = max
  return result
}

/**
 * 入力途中の値をカンマ区切りにフォーマットする
 * アルファベット（ショートカット入力中）が含まれる場合はそのまま返す
 */
function formatEditingValue(raw: string): string {
  if (/[a-zA-Z]/.test(raw)) return raw
  const stripped = raw.replace(/,/g, '')
  if (stripped === '' || stripped === '-') return raw
  const num = Number(stripped)
  if (Number.isNaN(num)) return raw
  return formatMoney(num)
}

/** 文字列の先頭から pos 文字目までに含まれる数字の個数を返す */
function countDigitsUpTo(str: string, pos: number): number {
  let count = 0
  const end = Math.min(pos, str.length)
  for (let i = 0; i < end; i++) {
    if (/\d/.test(str.charAt(i))) count++
  }
  return count
}

/** フォーマット済み文字列で、左から digitCount 個目の数字の直後の位置を返す */
function cursorPosAfterNthDigit(str: string, digitCount: number): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str.charAt(i))) count++
    if (count === digitCount) return i + 1
  }
  return str.length
}

/** string | number | undefined を number に変換する */
function toNumber(
  value: string | number | undefined,
  fallback: number,
): number {
  if (value == null) return fallback
  if (typeof value === 'number') return value
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

// --- コンポーネント ---

export interface MoneyInputProps extends Omit<
  React.ComponentProps<'input'>,
  'prefix' | 'size' | 'onChange' | 'ref'
> {
  ref?: React.Ref<HTMLInputElement> | undefined
  prefix?: string | undefined
  suffix?: string | undefined
  step?: number | string | undefined
  shiftStep?: number | undefined
  min?: number | string | undefined
  max?: number | string | undefined
  /** ポップオーバー電卓UIを有効にする */
  calculator?: boolean | undefined
}

export function MoneyInput({
  ref,
  name,
  id,
  form: formProp,
  defaultValue,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  prefix = '¥',
  suffix,
  placeholder,
  step: stepProp = 1000,
  shiftStep = 10000,
  min: minProp = 0,
  max: maxProp,
  calculator,
  className,
  disabled,
  // conform が渡す余分な props を無視
  type: _type,
  required: _required,
  minLength: _minLength,
  maxLength: _maxLength,
  pattern: _pattern,
  multiple: _multiple,
  ...rest
}: MoneyInputProps) {
  const step = toNumber(stepProp, 1000)
  const min = toNumber(minProp, 0)
  const max = maxProp == null ? undefined : toNumber(maxProp, 0) || undefined

  const initialValue = defaultValue != null ? String(defaultValue) : ''
  const [committedValue, setCommittedValue] = useState(initialValue)
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingCursorPos = useRef<number | null>(null)

  const displayValue =
    editingValue ??
    (committedValue
      ? formatMoney(Number(committedValue)) || committedValue
      : '')

  // カンマ挿入/削除後のカーソル位置復元
  useLayoutEffect(() => {
    if (pendingCursorPos.current != null && inputRef.current) {
      const pos = pendingCursorPos.current
      inputRef.current.setSelectionRange(pos, pos)
      pendingCursorPos.current = null
    }
  })

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseMoneyInput(raw)
      if (parsed !== null) {
        setCommittedValue(String(clampMoney(parsed, min, max)))
      } else if (raw.trim() === '') {
        setCommittedValue('')
      }
    },
    [min, max],
  )

  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref)
        (ref as React.RefObject<HTMLInputElement | null>).current = el
    },
    [ref],
  )

  const ariaInvalidBool =
    ariaInvalid === true || ariaInvalid === 'true' ? true : undefined

  const handleCalcConfirm = useCallback(
    (value: number) => {
      const clamped = clampMoney(value, min, max)
      setCommittedValue(String(clamped))
      setEditingValue(null)
      setCalcOpen(false)
    },
    [min, max],
  )

  const inputGroup = (
    <InputGroup
      className={cn(disabled && 'opacity-50', className)}
      data-disabled={disabled || undefined}
    >
      {prefix && (
        <InputGroupAddon align="inline-start">
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
      )}
      <InputGroupInput
        {...rest}
        ref={setRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => {
          // IME変換中はフォーマットせずそのまま表示
          if (
            e.nativeEvent instanceof InputEvent &&
            e.nativeEvent.isComposing
          ) {
            setEditingValue(e.target.value)
            return
          }
          const { value, selectionStart } = e.target
          const digitCount = countDigitsUpTo(
            value,
            selectionStart ?? value.length,
          )
          const formatted = formatEditingValue(value)
          setEditingValue(formatted)
          if (formatted !== value) {
            pendingCursorPos.current = cursorPosAfterNthDigit(
              formatted,
              digitCount,
            )
          }
        }}
        onCompositionEnd={(e) => {
          // IME確定後にフォーマットを適用
          const value = e.currentTarget.value
          const selectionStart = e.currentTarget.selectionStart
          const digitCount = countDigitsUpTo(
            value,
            selectionStart ?? value.length,
          )
          const formatted = formatEditingValue(value)
          setEditingValue(formatted)
          if (formatted !== value) {
            pendingCursorPos.current = cursorPosAfterNthDigit(
              formatted,
              digitCount,
            )
          }
        }}
        onKeyDown={(e) => {
          // IME変換中はキー操作を無視
          if (e.nativeEvent.isComposing) return
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const current = parseMoneyInput(editingValue ?? committedValue) ?? 0
            const delta = e.shiftKey ? shiftStep : step
            const next = clampMoney(
              current + delta * (e.key === 'ArrowUp' ? 1 : -1),
              min,
              max,
            )
            setEditingValue(formatMoney(next))
            setCommittedValue(String(next))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (editingValue !== null) commit(editingValue)
            setEditingValue(null)
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setEditingValue(null)
            e.currentTarget.blur()
          }
        }}
        onFocus={(e) => {
          setEditingValue(
            committedValue
              ? formatMoney(Number(committedValue)) || committedValue
              : '',
          )
          requestAnimationFrame(() => e.target.select())
        }}
        onBlur={() => {
          if (editingValue !== null) commit(editingValue)
          setEditingValue(null)
        }}
        placeholder={placeholder}
        aria-invalid={ariaInvalidBool}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        disabled={disabled}
        className="text-right font-mono tabular-nums"
      />
      {suffix && (
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-xs">{suffix}</InputGroupText>
        </InputGroupAddon>
      )}
      {calculator && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={() => setCalcOpen((prev) => !prev)}
            aria-label="電卓を開く"
            disabled={disabled}
            size="icon-xs"
          >
            <CalculatorIcon className="size-3.5" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )

  return (
    <>
      <input type="hidden" name={name} value={committedValue} form={formProp} />
      {calculator ? (
        <Popover open={calcOpen} onOpenChange={setCalcOpen}>
          <PopoverAnchor asChild>{inputGroup}</PopoverAnchor>
          <PopoverContent
            className="w-auto p-3"
            align="end"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CalculatorGrid
              initialValue={committedValue}
              onConfirm={handleCalcConfirm}
              onCancel={() => setCalcOpen(false)}
            />
          </PopoverContent>
        </Popover>
      ) : (
        inputGroup
      )}
    </>
  )
}
