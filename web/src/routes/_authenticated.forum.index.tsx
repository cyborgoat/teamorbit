import { ListControls } from '@/components/list-controls'
import { ListToolbar } from '@/components/list-toolbar'
import { queryKeys } from '@/lib/query-keys'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { TableCard, actionsHeadClass, actionsCellClass, RowDeleteButton } from '@/components/data-table'
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
import { canModerate } from '@/lib/policies'
import { useResourceList } from '@/hooks/use-resource-list'
import { orbit } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/forum/')({
  component: ForumPage,
})

function ForumPage() {
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
    queryKeys.forum,
    (query) => orbit.forum.listPosts(query),
    {
      sortFields: [
        { value: 'score', label: 'Score' },
        { value: 'createdAt', label: 'Created' },
        { value: 'title', label: 'Title' },
        { value: 'viewCount', label: 'Views' },
      ],
      defaultSort: 'score',
      defaultOrder: 'desc',
    },
  )
  const remove = useMutation({
    mutationFn: (id: string) => orbit.forum.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.forum })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

      <ListToolbar {...toolbar} placeholder="Search posts" />

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
            <EmptyTitle>
              {filtered ? 'No results found' : 'No forum posts yet'}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Nothing matches the current search or filters.'
                : 'Start a discussion — any signed-in member can post.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className={actionsHeadClass} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
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
                  <TableCell className="tabular-nums">
                    {item.viewCount}
                  </TableCell>
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
                  <TableCell className={actionsCellClass}>
                    {canModerate(user, item.author.id) ? (
                      <RowDeleteButton
                        onClick={() => {
                          if (confirm('Delete this post?')) remove.mutate(item.id)
                        }}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  )
}
