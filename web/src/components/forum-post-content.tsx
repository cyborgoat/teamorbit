import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Code2, Eye, Pencil, Trash2 } from 'lucide-react'
import type { ForumPost } from '@goatcheese/teamorbit-client'
import { MarkdownBody } from '@/components/markdown-body'
import { MarkdownEditor } from '@/components/markdown-editor'
import { UserAvatar } from '@/components/user-avatar'
import { PageHeader } from '@/components/page-header'
import { VoteControls } from '@/components/vote-controls'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function ForumPostContent({
  post,
  pending,
  onVote,
  onDelete,
  onSave,
  canModerate,
}: {
  post: ForumPost
  pending: boolean
  onVote: (value: 1 | -1 | 0) => void
  onDelete: () => void
  onSave: (values: { title: string; content: string }) => Promise<unknown>
  canModerate: boolean
}) {
  const [mode, setMode] = useState<'view' | 'source'>('view')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setTitle(post.title)
    setContent(post.content)
    setEditing(true)
  }

  if (editing) {
    return (
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (saving || uploading || !title.trim() || !content.trim()) return
          setSaving(true)
          void onSave({ title: title.trim(), content })
            .then(() => setEditing(false))
            .finally(() => setSaving(false))
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="forum-edit-title">Title</Label>
          <Input
            id="forum-edit-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Content</Label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            onUploadingChange={setUploading}
            minHeightClass="min-h-60"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || uploading || !title.trim() || !content.trim()}
          >
            {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
          </Button>
        </div>
      </form>
    )
  }

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
          {canModerate ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit post"
                onClick={startEdit}
              >
                <Pencil />
              </Button>
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
            </>
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
