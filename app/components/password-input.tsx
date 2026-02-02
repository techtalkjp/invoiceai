import { IconEye, IconEyeOff } from '@tabler/icons-react'
import * as React from 'react'
import { cn } from '~/lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'

type PasswordInputProps = Omit<React.ComponentPropsWithRef<'input'>, 'type'>

const PasswordInput = ({
  className,
  disabled,
  ref,
  ...props
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = React.useState(false)
  return (
    <div className={cn('relative rounded-md', className)}>
      <Input
        ref={ref}
        disabled={disabled}
        {...props}
        type={showPassword ? 'text' : 'password'}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className="text-muted-foreground absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 rounded-md"
        onClick={() => setShowPassword((prev) => !prev)}
      >
        {showPassword ? <IconEye size={18} /> : <IconEyeOff size={18} />}
      </Button>
    </div>
  )
}
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
