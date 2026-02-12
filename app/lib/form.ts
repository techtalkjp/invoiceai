/**
 * configureForms による共通フォーム設定
 *
 * zod v4 は Standard Schema 対応なので、スキーマを第1引数に渡すだけで
 * バリデーション・型推論が自動で効く（isSchema / validateSchema 不要）。
 *
 * extendFieldMetadata で各フィールドにカスタムプロパティを追加。
 * 既存ルートは段階的に移行可能。新しいルートはここの useForm を使う。
 *
 * @example
 * ```tsx
 * import { useForm } from '~/lib/form'
 *
 * const { form, fields } = useForm(demoSchema, {
 *   lastResult: actionData?.lastResult,
 *   defaultValue: { hourlyRate: '5000' },
 * })
 *
 * // getInputProps 不要 — fields から直接 spread
 * <Input {...fields.name.inputProps} />
 * <Textarea {...fields.note.textareaProps} />
 * <MoneyInput {...fields.hourlyRate.moneyInputProps} suffix="/h" />
 * <Select {...fields.role.selectProps}>
 *   <SelectTrigger {...fields.role.selectTriggerProps}><SelectValue /></SelectTrigger>
 * </Select>
 * <Checkbox {...fields.agree.checkboxProps} />
 * <Switch {...fields.isActive.switchProps} />
 * <PasswordInput {...fields.password.passwordInputProps} />
 * ```
 */
import { configureForms } from '@conform-to/react/future'
import { getConstraints } from '@conform-to/zod/v4/future'
import type { MoneyInputProps } from '~/components/money/money-input'
import type { Checkbox } from '~/components/ui/checkbox'
import type { Input } from '~/components/ui/input'
import type { Switch } from '~/components/ui/switch'
import type { Textarea } from '~/components/ui/textarea'

export const { useForm, useField, FormProvider, useFormMetadata } =
  configureForms({
    getConstraints,
    shouldValidate: 'onBlur',

    extendFieldMetadata(metadata) {
      return {
        /** <Input> 向け props */
        get inputProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            defaultValue: metadata.defaultValue,
            form: metadata.formId,
            'aria-invalid': metadata.ariaInvalid,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<React.ComponentProps<typeof Input>>
        },

        /** <Textarea> 向け props */
        get textareaProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            defaultValue: metadata.defaultValue,
            form: metadata.formId,
            'aria-invalid': metadata.ariaInvalid,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<React.ComponentProps<typeof Textarea>>
        },

        /** <Select> (Root) 向け props — name, defaultValue, form */
        get selectProps() {
          return {
            name: metadata.name,
            defaultValue: metadata.defaultValue,
            form: metadata.formId,
          }
        },

        /** <SelectTrigger> 向け props — id, aria-invalid, aria-describedby */
        get selectTriggerProps() {
          return {
            id: metadata.id,
            'aria-invalid': metadata.ariaInvalid,
            'aria-describedby': metadata.ariaDescribedBy,
          }
        },

        /** <MoneyInput> 向け props */
        get moneyInputProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            defaultValue: metadata.defaultValue,
            form: metadata.formId,
            'aria-invalid': metadata.ariaInvalid,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<MoneyInputProps>
        },

        /** <Checkbox> 向け props (boolean フィールド用) */
        get checkboxProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            value: 'on',
            defaultChecked: metadata.defaultChecked,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<React.ComponentProps<typeof Checkbox>>
        },

        /** <Switch> 向け props (boolean フィールド用) */
        get switchProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            value: 'on',
            defaultChecked: metadata.defaultChecked,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<React.ComponentProps<typeof Switch>>
        },

        /** <PasswordInput> 向け props (type を除いた Input 互換) */
        get passwordInputProps() {
          return {
            id: metadata.id,
            name: metadata.name,
            defaultValue: metadata.defaultValue,
            form: metadata.formId,
            'aria-invalid': metadata.ariaInvalid,
            'aria-describedby': metadata.ariaDescribedBy,
          } satisfies Partial<React.ComponentProps<typeof Input>>
        },
      }
    },
  })
