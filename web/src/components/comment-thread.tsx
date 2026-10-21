import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { ContentComment } from '@/components/content-comment'
import { CommentComposer } from '@/components/comment-composer'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { canModerate } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

type ResourceType = 'announcement' | 'event' | 'news' | 'blog' | 'forum'

export function CommentThread({
  resourceType,
  resourceId,
}: {
  resourceType: ResourceType
  resourceId: string
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = queryKeys.comments(resourceType, resourceId)
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => orbit.comments.list({ resourceType, resourceId }),
  })
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key })
    if (resourceType === 'forum') {
      void qc.invalidateQueries({ queryKey: queryKeys.post(resourceId) })
      void qc.invalidateQueries({ queryKey: queryKeys.forum })
    }
  }
  const onError = (error: Error) => toast.error(error.message)
  const addComment = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) =>
      orbit.comments.create({
        resourceType,
        resourceId,
        content: payload.content,
        parentId: payload.parentId,
      }),
    onSuccess: (_data, vars) => {
      invalidate()
      toast.success(vars.parentId ? 'Reply posted' : 'Comment posted')
    },
    onError,
  })
  const voteComment = useMutation({
    mutationFn: ({ id, value }: { id: string; value: 1 | -1 | 0 }) =>
      orbit.comments.vote(id, value),
    onSuccess: invalidate,
    onError,
  })
  const removeComment = useMutation({
    mutationFn: (id: string) => orbit.comments.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success('Comment deleted')
    },
    onError,
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Comments
          </CardTitle>
          <CardDescription>
            Reply to the post or to a top-level comment (one level deep).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommentComposer
            pending={addComment.isPending}
            onSubmit={(content) => addComment.mutateAsync({ content })}
          />
        </CardContent>
      </Card>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        items.map((comment) => (
          <ContentComment
            key={comment.id}
            comment={comment}
            actions={{
              pending: addComment.isPending,
              voting: voteComment.isPending,
              canModerate: (id) => canModerate(user, id),
              onVote: (id, value) => voteComment.mutate({ id, value }),
              onRemove: (id) => removeComment.mutate(id),
            }}
            onReply={(content) =>
              addComment.mutateAsync({ content, parentId: comment.id })
            }
          />
        ))
      )}
    </div>
  )
}
