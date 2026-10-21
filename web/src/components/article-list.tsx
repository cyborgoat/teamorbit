import { canManage } from '@/lib/policies'
import { useListPage } from '@/hooks/use-list-page'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import type { News as Item } from '@goatcheese/teamorbit-client'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Newspaper, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MarkdownPreview } from '@/components/markdown-preview'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { orbit } from '@/lib/api'

export function ArticleList({ kind }: { kind: 'news' | 'blog' }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const pagination = useListPage()
  const { data, error, refetch, isFetching, isLoading } = useQuery({
    queryKey: [...queryKeys[kind], pagination.page],
    queryFn: () =>
      orbit[kind === 'blog' ? 'blogPosts' : 'news'].list({
        page: pagination.page,
        limit: pagination.limit,
      }),
  })
  const [preview, setPreview] = useState<Item | null>(null)
  const remove = useMutation({
    mutationFn: (id: string) =>
      orbit[kind === 'blog' ? 'blogPosts' : 'news'].delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys[kind] })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []

  return (
    <div>
      <PageHeader
        title={kind === 'blog' ? 'Blog' : 'News'}
        description="Read and manage team articles."
        actions={
          canManage(user) ? (
            <Button asChild>
              <Link to={kind === 'blog' ? '/blog/new' : '/news/new'}>
                <Plus data-icon="inline-start" />
                {kind === 'blog' ? 'New post' : 'New article'}
              </Link>
            </Button>
          ) : null
        }
      />

      <ListControls
        {...pagination}
        total={data?.total}
        error={error}
        retry={refetch}
        pending={isFetching}
      />
      {error ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Newspaper />
            </EmptyMedia>
            <EmptyTitle>No articles yet</EmptyTitle>
            <EmptyDescription>
              Publish an article to share with your team.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setPreview(item)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium hover:underline focus-visible:underline"
                      onClick={() => setPreview(item)}
                    >
                      {item.title}
                    </button>
                    <pre className="mt-1 max-w-md truncate font-mono text-xs text-muted-foreground">
                      {item.content}
                    </pre>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(item.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {canManage(user) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this article?'))
                            remove.mutate(item.id)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MarkdownPreview
        open={preview !== null}
        onOpenChange={(next) => {
          if (!next) setPreview(null)
        }}
        title={preview?.title ?? ''}
        content={preview?.content ?? ''}
        tags={preview?.tags}
        coverImageUrl={preview?.coverImageUrl}
        createdAt={preview?.createdAt}
      />
    </div>
  )
}
