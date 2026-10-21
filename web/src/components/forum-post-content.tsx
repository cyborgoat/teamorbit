import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Eye, Code2, Trash2 } from 'lucide-react'
import type { ForumPost } from '@goatcheese/teamorbit-client'
import { MarkdownBody } from '@/components/markdown-body'
import { UserAvatar } from '@/components/user-avatar'
import { PageHeader } from '@/components/page-header'
import { VoteControls } from '@/components/vote-controls'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
export function ForumPostContent({
  post,
  pending,
  onVote,
  onDelete,
  canDelete,
}: {
  post: ForumPost
  pending: boolean
  onVote: (value: 1 | -1 | 0) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [mode, setMode] = useState<'view' | 'source'>('view')
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link
            to="/forum"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to forum
          </Link>
          <div className="flex items-center gap-3">
            <UserAvatar
              name={post.author.fullName}
              avatarUrl={post.author.avatarUrl}
              size="lg"
            />
            <PageHeader
              title={post.title}
              description={`By ${post.author.fullName} · ${new Date(post.createdAt).toLocaleString()} · ${post.viewCount} ${post.viewCount === 1 ? 'view' : 'views'}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VoteControls
            score={post.score}
            myVote={post.myVote}
            pending={pending}
            onVote={onVote}
          />
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="xs"
              variant={mode === 'view' ? 'secondary' : 'ghost'}
              onClick={() => setMode('view')}
            >
              <Eye data-icon="inline-start" />
              View
            </Button>
            <Button
              type="button"
              size="xs"
              variant={mode === 'source' ? 'secondary' : 'ghost'}
              onClick={() => setMode('source')}
            >
              <Code2 data-icon="inline-start" />
              Source
            </Button>
          </div>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete post"
              onClick={() => {
                if (confirm('Delete this post and all comments?')) {
                  onDelete()
                }
              }}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="pt-(--card-spacing)">
          {mode === 'source' ? (
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {post.content}
            </pre>
          ) : (
            <MarkdownBody content={post.content} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
