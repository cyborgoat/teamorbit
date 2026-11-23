import { Button } from '@/components/ui/button'
export function ListControls({
  page,
  setPage,
  total,
  limit = 20,
  error,
  retry,
  pending,
}: {
  page: number
  setPage: (page: number) => void
  total?: number
  limit?: number
  error?: Error | null
  retry: () => unknown
  pending?: boolean
}) {
  if (error)
    return (
      <div
        role="alert"
        className="mb-4 flex items-center gap-3 text-sm text-destructive"
      >
        {error.message}
        <Button variant="outline" onClick={() => retry()}>
          Retry
        </Button>
      </div>
    )
  if (total === undefined || (total <= limit && page === 1)) return null
  return (
    <nav
      aria-label="Pagination"
      className="mb-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground"
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1 || pending}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, Math.ceil(total / limit))}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page * limit >= total || pending}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}
