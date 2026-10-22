import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ForumPostContent } from '@/components/forum-post-content'
import { CommentThread } from '@/components/comment-thread'
import { ListControls } from '@/components/list-controls'
import { useAuth } from '@/lib/auth'
import { canModerate } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/forum/$postId')({
  component: ForumPostPage,
})

function ForumPostPage() {
  const { postId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const {
    data: post,
    error,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: () => orbit.forum.getPost(postId),
    // Detail GET increments viewCount; avoid focus refetch inflation.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.post(postId) })
    void qc.invalidateQueries({ queryKey: queryKeys.forum })
  }
  const onError = (error: Error) => toast.error(error.message)
  const votePost = useMutation({
    mutationFn: (value: 1 | -1 | 0) => orbit.forum.votePost(postId, value),
    onSuccess: invalidate,
    onError,
  })
  const removePost = useMutation({
    mutationFn: () => orbit.forum.deletePost(postId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.forum })
      toast.success('Post deleted')
      void navigate({ to: '/forum' })
    },
    onError,
  })
  const updatePost = useMutation({
    mutationFn: (body: { title: string; content: string }) =>
      orbit.forum.updatePost(postId, body),
    onSuccess: () => {
      invalidate()
      toast.success('Post updated')
    },
    onError,
  })
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!post) return <Link to="/forum">Back to forum</Link>
  return (
    <div className="space-y-6">
      <ForumPostContent
        post={post}
        pending={votePost.isPending}
        onVote={(value) => votePost.mutate(value)}
        onDelete={() => removePost.mutate()}
        onSave={(body) => updatePost.mutateAsync(body)}
        canModerate={canModerate(user, post.author.id)}
      />
      <CommentThread resourceType="forum" resourceId={postId} />
    </div>
  )
}