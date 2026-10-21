import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ForumComment as Comment } from '@goatcheese/teamorbit-client'
import { MarkdownBody } from '@/components/markdown-body'
import { UserAvatar } from '@/components/user-avatar'
import { VoteControls } from '@/components/vote-controls'
import { CommentComposer } from '@/components/comment-composer'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
type Actions = {
  pending: boolean
  voting: boolean
  canModerate: (authorId: string) => boolean
  onVote: (id: string, value: 1 | -1 | 0) => void
  onRemove: (id: string) => void
}
function CommentHeading({
  comment,
  reply = false,
  actions,
}: {
  comment: Comment | Comment['replies'][number]
  reply?: boolean
  actions: Actions
}) {
  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserAvatar
            name={comment.author.fullName}
            avatarUrl={comment.author.avatarUrl}
            size="sm"
          />
          {comment.author.fullName}
        </CardTitle>
        <CardDescription>
          {new Date(comment.createdAt).toLocaleString()}
        </CardDescription>
      </div>
      <div className="flex items-center gap-1">
        <VoteControls
          score={comment.score}
          myVote={comment.myVote}
          pending={actions.voting}
          onVote={(value) => actions.onVote(comment.id, value)}
        />
        {actions.canModerate(comment.author.id) && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={reply ? 'Delete reply' : 'Delete comment'}
            onClick={() => {
              if (
                confirm(reply ? 'Delete this reply?' : 'Delete this comment?')
              )
                actions.onRemove(comment.id)
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  )
}
export function ForumComment({
  comment,
  actions,
  onReply,
}: {
  comment: Comment
  actions: Actions
  onReply: (content: string) => Promise<unknown>
}) {
  const [replying, setReplying] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CommentHeading comment={comment} actions={actions} />
      </CardHeader>
      <CardContent className="space-y-3">
        <MarkdownBody content={comment.content} />
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setReplying(!replying)}
        >
          {replying ? 'Cancel reply' : 'Reply'}
        </Button>
        {replying && (
          <CommentComposer
            reply
            pending={actions.pending}
            onSubmit={async (content) => {
              await onReply(content)
              setReplying(false)
            }}
          />
        )}
        {comment.replies.length > 0 && (
          <div className="space-y-3 border-l pl-4">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="space-y-2">
                <CommentHeading comment={reply} reply actions={actions} />
                <MarkdownBody content={reply.content} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
