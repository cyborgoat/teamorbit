import type { ComponentProps, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'

export function ListPage({ children }: { children: ReactNode }) {
  return (
    <div data-slot="list-page" className="flex min-h-0 flex-col [&>*]:shrink-0">
      {children}
    </div>
  )
}

export function ListTable({
  children,
  label,
}: {
  children: ComponentProps<typeof Table>['children']
  label: string
}) {
  return (
    <Table
      aria-label={label}
      containerProps={{
        'data-slot': 'list-scroll',
        'aria-label': `Scroll ${label.toLowerCase()}`,
        role: 'region',
        tabIndex: 0,
        className:
          'min-h-0 overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
      }}
      className="border-separate border-spacing-0"
    >
      {children}
    </Table>
  )
}

/** Shared width/alignment for the trailing actions column. */
export const actionsHeadClass = 'w-8'
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
