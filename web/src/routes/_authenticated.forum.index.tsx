import { useListPage } from '@/hooks/use-list-page'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { UserAvatar } from '@/components/user-avatar'
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

export const Route = createFileRoute('/_authenticated/forum/')({
  component: ForumPage,
})

function ForumPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const pagination = useListPage()
  const { data, error, refetch, isFetching, isLoading } = useQuery({
    queryKey: [...queryKeys.forum, pagination.page],
    queryFn: () =>
      orbit.forum.listPosts({ page: pagination.page, limit: pagination.limit }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => orbit.forum.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.forum })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const canModerate = (authorId: string) =>
    user?.id === authorId ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPERUSER'

  return (
    <div>
      <PageHeader
        title="Forum"
        description="Markdown discussion posts with comments, replies, and votes."
        actions={
          <Button asChild>
            <Link to="/forum/new">
              <Plus data-icon="inline-start" />
              New post
            </Link>
          </Button>
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
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>No forum posts yet</EmptyTitle>
            <EmptyDescription>
              Start a discussion — any signed-in member can post.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/forum/$postId"
                      params={{ postId: item.id }}
                      className="block font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <pre className="mt-1 max-w-md truncate font-mono text-xs text-muted-foreground">
                      {item.content}
                    </pre>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.score}</TableCell>
                  <TableCell className="tabular-nums">
                    {item.commentCount}
                  </TableCell>
                  <TableCell className="tabular-nums">{item.viewCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={item.author.fullName}
                        avatarUrl={item.author.avatarUrl}
                        size="sm"
                      />
                      {item.author.fullName}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {canModerate(item.author.id) ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this post?'))
                            remove.mutate(item.id)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
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
