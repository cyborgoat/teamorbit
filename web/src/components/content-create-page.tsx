import { canManage } from '@/lib/policies'
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MarkdownBody } from '@/components/markdown-body'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/markdown-editor'
import { ImageUpload } from '@/components/image-upload'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { orbit } from '@/lib/api'

export function ContentCreatePage({
  kind,
}: {
  kind: 'news' | 'blog' | 'forum'
}) {
  const { user, loading } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    content: '',
    tags: '',
    coverImageUrl: '',
  })
  const [uploading, setUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const isForum = kind === 'forum'
  const isBlog = kind === 'blog'
  // News stays Admin+; blog and forum are open to any signed-in member.
  const allowed = !!user && (isForum || isBlog || canManage(user))
  const list = `/${kind}` as '/news' | '/blog' | '/forum'
  const create = useMutation({
    mutationFn: async () =>
      isForum
        ? orbit.forum.createPost({ title: form.title, content: form.content })
        : orbit[kind === 'blog' ? 'blogPosts' : 'news'].create({
            ...form,
            tags: form.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            coverImageUrl: form.coverImageUrl || null,
          }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [isForum ? 'forum-posts' : kind] })
      toast.success('Published')
      await navigate({ to: list })
    },
    onError: (error: Error) => toast.error(error.message),
  })
  if (loading) return <p>Loading…</p>
  if (!allowed) return <p>You do not have permission to create this content.</p>
  const busy = uploading || coverUploading || create.isPending
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={
          kind === 'news'
            ? 'New news article'
            : kind === 'blog'
              ? 'New blog post'
              : 'New forum post'
        }
        description="Write your post and paste images directly into the editor."
      />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && form.content.trim()) create.mutate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            required
          />
        </div>
        {!isForum && (
          <div className="space-y-2">
            <Label htmlFor="post-tags">Tags</Label>
            <Input
              id="post-tags"
              placeholder="team, release, ops"
              value={form.tags}
              onChange={(event) =>
                setForm((current) => ({ ...current, tags: event.target.value }))
              }
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="post-content-input">Content</Label>
          <MarkdownEditor
            id="post-content"
            value={form.content}
            onChange={(content) =>
              setForm((current) => ({ ...current, content }))
            }
            onUploadingChange={setUploading}
            required
            minHeightClass="min-h-80"
          />
        </div>
        {!isForum && (
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
        )}
        <section
          className="space-y-3 rounded-xl border p-5"
          aria-label="Post preview"
        >
          <h2 className="font-semibold">Preview</h2>
          {form.coverImageUrl && (
            <img
              src={form.coverImageUrl}
              alt="Cover"
              className="max-h-64 rounded-lg object-cover"
            />
          )}
          <h3 className="text-xl font-semibold">{form.title}</h3>
          <MarkdownBody content={form.content} />
        </section>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" asChild>
            <Link to={list}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy || !form.content.trim()}>
            {create.isPending ? 'Publishing…' : busy ? 'Uploading…' : 'Publish'}
          </Button>
        </div>
      </form>
    </div>
  )
}
