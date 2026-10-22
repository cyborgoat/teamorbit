import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import { ImageUpload } from '@/components/image-upload'
import { ListControls } from '@/components/list-controls'
import { MarkdownBody } from '@/components/markdown-body'
import { MarkdownEditor } from '@/components/markdown-editor'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { canModerate } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function ArticleDetail({
  kind,
  id,
}: {
  kind: 'news' | 'blog'
  id: string
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const listPath = kind === 'news' ? '/news' : '/blog'
  const resource = kind === 'blog' ? orbit.blogPosts : orbit.news
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys[kind], id],
    queryFn: () => resource.get(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    tags: '',
    coverImageUrl: '',
  })
  const [uploading, setUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  const update = useMutation({
    mutationFn: () =>
      resource.update(id, {
        title: form.title,
        content: form.content,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        coverImageUrl: form.coverImageUrl || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys[kind] })
      toast.success('Updated')
      setEditing(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!data) return <Link to={listPath}>Back to {kind}</Link>

  const allowed = canModerate(user, data.author.id)
  const busy = uploading || coverUploading || update.isPending

  if (editing) {
    return (
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && form.content.trim()) update.mutate()
        }}
      >
        <PageHeader
          title={kind === 'news' ? 'Edit news article' : 'Edit blog post'}
          description="Authors and admins can update this article."
        />
        <div className="space-y-2">
          <Label htmlFor="article-edit-title">Title</Label>
          <Input
            id="article-edit-title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="article-edit-tags">Tags</Label>
          <Input
            id="article-edit-tags"
            placeholder="team, release, ops"
            value={form.tags}
            onChange={(event) =>
              setForm((current) => ({ ...current, tags: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Content</Label>
          <MarkdownEditor
            value={form.content}
            onChange={(content) =>
              setForm((current) => ({ ...current, content }))
            }
            onUploadingChange={setUploading}
            required
            minHeightClass="min-h-80"
          />
        </div>
        <div className="space-y-2">
          <Label>Cover image</Label>
          <ImageUpload
            value={form.coverImageUrl}
            onChange={(coverImageUrl) =>
              setForm((current) => ({ ...current, coverImageUrl }))
            }
            onUploadingChange={setCoverUploading}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !form.content.trim()}>
            {update.isPending ? 'Saving…' : busy ? 'Uploading…' : 'Save'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={data.title}
          description={`By ${data.author.fullName} · ${new Date(data.createdAt).toLocaleString()} · ${data.viewCount} ${data.viewCount === 1 ? 'view' : 'views'}`}
        />
        {allowed ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm({
                title: data.title,
                content: data.content,
                tags: (data.tags ?? []).join(', '),
                coverImageUrl: data.coverImageUrl ?? '',
              })
              setEditing(true)
            }}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : null}
      </div>
      {(data.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {data.coverImageUrl ? (
        <img
          src={data.coverImageUrl}
          alt=""
          className="max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}
      <MarkdownBody content={data.content} />
      <CommentThread resourceType={kind} resourceId={id} />
    </div>
  )
}
