import { canManage, canModerate } from '@/lib/policies'
import { useResourceList } from '@/hooks/use-resource-list'
import { ListToolbar } from '@/components/list-toolbar'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Newspaper, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
  const {
    data,
    error,
    refetch,
    isFetching,
    isLoading,
    pagination,
    items,
    filtered,
    toolbar,
  } = useResourceList(
    queryKeys[kind],
    (query) => orbit[kind === 'blog' ? 'blogPosts' : 'news'].list(query),
    {
      sortFields: [
        { value: 'createdAt', label: 'Created' },
        { value: 'title', label: 'Title' },
        { value: 'viewCount', label: 'Views' },
      ],
      defaultSort: 'createdAt',
      defaultOrder: 'desc',
    },
  )
  const remove = useMutation({
    mutationFn: (id: string) =>
      orbit[kind === 'blog' ? 'blogPosts' : 'news'].delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys[kind] })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title={kind === 'blog' ? 'Blog' : 'News'}
        description="Read and manage team articles."
        actions={
          kind === 'blog' || canManage(user) ? (
            <Button asChild>
              <Link to={kind === 'blog' ? '/blog/new' : '/news/new'}>
                <Plus data-icon="inline-start" />
                {kind === 'blog' ? 'New post' : 'New article'}
              </Link>
            </Button>
          ) : null
        }
      />

      <ListToolbar {...toolbar} placeholder="Search articles" />

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
            <EmptyTitle>
              {filtered ? 'No results found' : 'No articles yet'}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Nothing matches the current search or filters.'
                : 'Publish an article to share with your team.'}
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
                <TableHead>Views</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to={kind === 'blog' ? '/blog/$id' : '/news/$id'}
                      params={{ id: item.id }}
                      className="font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
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
                  <TableCell className="tabular-nums">
                    {item.viewCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {canModerate(user, item.author.id) && (
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
    </div>
  )
}
