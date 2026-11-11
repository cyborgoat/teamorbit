import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { PillSelect, type PillOption } from '@/components/pill-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SortOrder } from '@/hooks/use-list-params'

const pillClass = 'h-8 px-3 text-sm'

/** A pill-styled filter: "Label: value" that opens a menu on click. */
export function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly PillOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <PillSelect
      value={value}
      options={options}
      onChange={onChange}
      prefix={`${label}:`}
      variant={value === 'ALL' ? 'outline' : 'secondary'}
      className={pillClass}
      aria-label={`Filter by ${label.toLowerCase()}`}
    />
  )
}

/** Search box + filter pills + sort pill/direction used above every table. */
export function ListToolbar<S extends string>({
  search,
  onSearch,
  placeholder = 'Search',
  filters,
  sort,
  onClear,
}: {
  search: string
  onSearch: (v: string) => void
  placeholder?: string
  filters?: ReactNode
  sort?: {
    options: readonly { value: S; label: string }[]
    value: S
    order: SortOrder
    onChange: (v: S) => void
    onToggleOrder: () => void
  }
  /** When provided, a "Clear" button is shown. */
  onClear?: (() => void) | null
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          className="rounded-4xl pl-8"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {filters}
      {sort ? (
        <>
          <PillSelect
            value={sort.value}
            options={sort.options}
            onChange={sort.onChange}
            prefix="Sort:"
            className={pillClass}
            variant="outline"
            aria-label="Sort by"
          />
          <Button
            variant="outline"
            size="icon"
            className="rounded-4xl"
            aria-label={sort.order === 'asc' ? 'Ascending' : 'Descending'}
            title={sort.order === 'asc' ? 'Ascending' : 'Descending'}
            onClick={sort.onToggleOrder}
          >
            {sort.order === 'asc' ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </>
      ) : null}
      {onClear ? (
        <Button variant="ghost" size="xs" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  )
}
