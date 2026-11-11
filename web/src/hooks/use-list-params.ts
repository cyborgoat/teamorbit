import { useEffect, useState } from 'react'
import { useListPage } from '@/hooks/use-list-page'

export type SortOrder = 'asc' | 'desc'

/** Page + debounced search + sort state shared by every list/table page. */
export function useListParams<S extends string>(
  defaultSort: S | undefined,
  defaultOrder: SortOrder,
) {
  const { page, setPage, limit } = useListPage()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<S | undefined>(defaultSort)
  const [order, setOrder] = useState<SortOrder>(defaultOrder)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search, setPage])

  return {
    page,
    setPage,
    limit,
    search,
    setSearch,
    q,
    sortBy,
    order,
    setSortBy: (v: S) => {
      setSortBy(v)
      setPage(1)
    },
    toggleOrder: () => {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
      setPage(1)
    },
    /** Reset search (not sort) and return to page 1. */
    reset: () => {
      setSearch('')
      setQ('')
      setPage(1)
    },
  }
}
