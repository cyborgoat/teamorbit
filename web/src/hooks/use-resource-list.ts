import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useListParams, type SortOrder } from '@/hooks/use-list-params'

export type ListQuery<S extends string, X> = {
  page: number
  limit: number
  q?: string
  sortBy?: S
  order?: SortOrder
} & X

/**
 * Shared paginated list query for content tables, with search + sort state.
 * `extra` carries page-specific filters (already omitted when undefined).
 */
export function useResourceList<
  TItem,
  S extends string,
  X extends object = object,
>(
  queryKey: readonly unknown[],
  list: (query: ListQuery<S, X>) => Promise<{ items: TItem[]; total: number }>,
  opts: {
    sortFields: readonly { value: S; label: string }[]
    defaultSort: NoInfer<S>
    defaultOrder: SortOrder
    extra?: X
    /** True when an `extra` filter is active (shows the Clear button). */
    extraActive?: boolean
    onClear?: () => void
  },
) {
  const params = useListParams<S>(opts.defaultSort, opts.defaultOrder)
  const { page, setPage, limit, q, sortBy, order } = params
  const query = useQuery({
    queryKey: [...queryKey, page, q, sortBy, order, opts.extra],
    queryFn: () =>
      list({
        page,
        limit,
        q: q || undefined,
        sortBy,
        order,
        ...opts.extra,
      } as ListQuery<S, X>),
    placeholderData: keepPreviousData,
  })
  const filtered = q !== '' || !!opts.extraActive
  return {
    ...query,
    pagination: { page, setPage, limit },
    items: (query.data?.items ?? []) as TItem[],
    filtered,
    toolbar: {
      search: params.search,
      onSearch: params.setSearch,
      sort: {
        options: opts.sortFields,
        value: sortBy as S,
        order,
        onChange: params.setSortBy,
        onToggleOrder: params.toggleOrder,
      },
      onClear: filtered
        ? () => {
            params.reset()
            opts.onClear?.()
          }
        : null,
    },
  }
}
