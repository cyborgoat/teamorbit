import { Select as SelectPrimitive } from 'radix-ui'
import { ChevronDownIcon } from 'lucide-react'
import type { VariantProps } from 'class-variance-authority'
import { badgeVariants } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** Badge variant for a user status. */
export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'PENDING':
      return 'secondary'
    case 'SUSPENDED':
    case 'DELETED':
      return 'destructive'
    default:
      return 'outline'
  }
}

/**
 * A badge that is itself the select trigger: click the pill to open the menu.
 * Use anywhere a table cell shows an editable enum value.
 */
export type PillOption<T extends string> = T | { value: T; label: string }

export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  variant = 'outline',
  prefix,
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: T
  options: readonly PillOption<T>[]
  onChange: (value: T) => void
  variant?: BadgeVariant
  /** Static text shown before the value, e.g. "Role:". */
  prefix?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const items = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (v && v !== value) onChange(v as T)
      }}
    >
      <SelectPrimitive.Trigger
        data-slot="pill-select-trigger"
        aria-label={ariaLabel}
        className={cn(
          badgeVariants({ variant }),
          'cursor-pointer gap-1 pr-1.5 outline-none hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50',
          className,
        )}
      >
        {prefix ? <span className="opacity-70">{prefix}</span> : null}
        <SelectValue>
          {items.find((o) => o.value === value)?.label ?? value}
        </SelectValue>
        <ChevronDownIcon className="size-3 opacity-70" />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper" align="start">
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
