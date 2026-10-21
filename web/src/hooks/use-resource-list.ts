import { useListPage } from '@/hooks/use-list-page'
import { useQuery } from '@tanstack/react-query'

/** Shared paginated list query for admin content tables. */
export function useResourceList<TItem>(
  queryKey: readonly unknown[],
  list: (query: {
    page: number
    limit: number
  }) => Promise<{ items: TItem[]; total: number }>,
) {
  const pagination = useListPage()
  const query = useQuery({
    queryKey: [...queryKey, pagination.page],
    queryFn: () =>
      list({
        page: pagination.page,
        limit: pagination.limit,
      }),
  })
  return {
    ...query,
    pagination,
    items: (query.data?.items ?? []) as TItem[],
  }
}
