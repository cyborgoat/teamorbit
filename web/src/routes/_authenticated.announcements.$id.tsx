import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import { ListControls } from '@/components/list-controls'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth'
import { canModerate } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/announcements/$id')({
  component: AnnouncementDetailPage,
})

function AnnouncementDetailPage() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.announcements, id],
    queryFn: () => orbit.announcements.get(id),
  })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const update = useMutation({
    mutationFn: () => orbit.announcements.update(id, { title, description }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.announcements })
      toast.success('Announcement updated')
      setEditing(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => orbit.announcements.delete(id),
    onSuccess: async () => {
      // Leave the detail page first and drop its cache entry, otherwise the
      // list invalidation refetches the deleted item and shows "not found".
      qc.removeQueries({ queryKey: [...queryKeys.announcements, id] })
      await navigate({ to: '/announcements' })
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: queryKeys.announcements })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!data) return <Link to="/announcements">Back to announcements</Link>

  const allowed = canModerate(user, data.author.id)

  if (editing) {
    return (
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate()
        }}
      >
        <PageHeader
          title="Edit announcement"
          description="Authors and admins can update this notice."
        />
        <div className="space-y-2">
          <Label htmlFor="ann-edit-title">Title</Label>
          <Input
            id="ann-edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ann-edit-body">Description</Label>
          <Textarea
            id="ann-edit-body"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={6}
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
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
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
          description={`By ${data.author?.fullName ?? '—'} · ${new Date(data.createdAt).toLocaleString()}`}
        />
        {allowed ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm('Delete this announcement?')) remove.mutate()
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTitle(data.title)
                setDescription(data.description)
                setEditing(true)
              }}
            >
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          </div>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {data.description}
      </p>
      <CommentThread resourceType="announcement" resourceId={id} />
    </div>
  )
}
