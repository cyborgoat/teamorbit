import type { ComponentProps, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Bordered, rounded wrapper so every table in the app looks the same. */
export function TableCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('overflow-hidden rounded-xl border', className)}
      {...props}
    />
  )
}

/** Shared width/alignment for the trailing actions column. */
export const actionsHeadClass = 'w-14'
export const actionsCellClass = 'text-right'

/**
 * Delete icon that only appears while hovering (or keyboard-focusing) the
 * table row. Touch devices have no hover, so it stays visible there.
 * Requires the parent TableRow to carry the `group` class (the shared
 * TableRow already does).
 */
export function RowDeleteButton({
  label = 'Delete',
  onClick,
  disabled,
}: {
  label?: string
  onClick: () => void
  disabled?: boolean
}): ReactNode {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Trash2 />
    </Button>
  )
}
