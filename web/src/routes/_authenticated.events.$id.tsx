import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import { ImageUpload } from '@/components/image-upload'
import { ListControls } from '@/components/list-controls'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth'
import { canManage, canModerate } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/events/$id')({
  component: EventDetailPage,
})

function toLocalInput(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString()
}

function EventDetailPage() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.events, id],
    queryFn: () => orbit.events.get(id),
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    startAt: '',
    endAt: '',
    coverImageUrl: '',
    audience: 'GLOBAL' as 'GLOBAL' | 'INVITE_ONLY',
    recipientIds: [] as string[],
  })
  const [coverUploading, setCoverUploading] = useState(false)

  const usersQuery = useQuery({
    queryKey: [...queryKeys.users, 'active-picker'],
    queryFn: () => orbit.users.list({ page: 1, limit: 100, status: 'ACTIVE' }),
    enabled: canManage(user) && editing && form.audience === 'INVITE_ONLY',
  })

  const update = useMutation({
    mutationFn: () => {
      const audience =
        canManage(user) && form.audience === 'INVITE_ONLY'
          ? 'INVITE_ONLY'
          : form.audience
      return orbit.events.update(id, {
        title: form.title,
        description: form.description,
        location: form.location,
        startAt: fromLocalInput(form.startAt),
        endAt: fromLocalInput(form.endAt),
        coverImageUrl: form.coverImageUrl || null,
        ...(canManage(user)
          ? {
              audience,
              recipientIds:
                audience === 'INVITE_ONLY' ? form.recipientIds : undefined,
            }
          : {}),
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.events })
      toast.success('Event updated')
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
  if (!data) return <Link to="/events">Back to events</Link>

  const allowed = canModerate(user, data.createdBy.id)
  const busy = coverUploading || update.isPending

  if (editing) {
    return (
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) update.mutate()
        }}
      >
        <PageHeader
          title="Edit event"
          description="Authors and admins can update this event."
        />
        <div className="space-y-2">
          <Label htmlFor="ev-edit-title">Title</Label>
          <Input
            id="ev-edit-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-edit-location">Location</Label>
          <Input
            id="ev-edit-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ev-edit-start">Starts</Label>
            <Input
              id="ev-edit-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-edit-end">Ends</Label>
            <Input
              id="ev-edit-end"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-edit-desc">Description</Label>
          <Textarea
            id="ev-edit-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={5}
          />
        </div>
        {canManage(user) ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Audience</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ev-edit-audience"
                checked={form.audience === 'GLOBAL'}
                onChange={() =>
                  setForm({ ...form, audience: 'GLOBAL', recipientIds: [] })
                }
              />
              Global
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ev-edit-audience"
                checked={form.audience === 'INVITE_ONLY'}
                onChange={() => setForm({ ...form, audience: 'INVITE_ONLY' })}
              />
              Invite-only
            </label>
          </fieldset>
        ) : null}
        {canManage(user) && form.audience === 'INVITE_ONLY' ? (
          <div className="space-y-2">
            <Label>Invitees</Label>
            <p className="text-xs text-muted-foreground">
              You are always included as the creator.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {usersQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading members…</p>
              ) : (
                (usersQuery.data?.items ?? [])
                  .filter((member) => member.id !== data.createdBy.id)
                  .map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.recipientIds.includes(member.id)}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            recipientIds: prev.recipientIds.includes(member.id)
                              ? prev.recipientIds.filter((x) => x !== member.id)
                              : [...prev.recipientIds, member.id],
                          }))
                        }
                      />
                      {member.fullName}
                    </label>
                  ))
              )}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Cover image</Label>
          <ImageUpload
            value={form.coverImageUrl}
            onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })}
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
          <Button type="submit" disabled={busy}>
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
          description={`${data.location} · ${new Date(data.startAt).toLocaleString()} – ${new Date(data.endAt).toLocaleString()}`}
        />
        {allowed ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm({
                title: data.title,
                description: data.description,
                location: data.location,
                startAt: toLocalInput(data.startAt),
                endAt: toLocalInput(data.endAt),
                coverImageUrl: data.coverImageUrl ?? '',
                audience: data.audience,
                recipientIds: (data.recipients ?? [])
                  .map((r) => r.id)
                  .filter((recipientId) => recipientId !== data.createdBy.id),
              })
              setEditing(true)
            }}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {data.audience === 'INVITE_ONLY' ? 'Invite-only' : 'Global'}
        </Badge>
        {data.audience === 'INVITE_ONLY' && data.recipients?.length ? (
          <p className="text-sm text-muted-foreground">
            {data.recipients.map((r) => r.fullName).join(', ')}
          </p>
        ) : null}
      </div>
      {data.coverImageUrl ? (
        <img
          src={data.coverImageUrl}
          alt=""
          className="max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {data.description}
      </p>
      <CommentThread resourceType="event" resourceId={id} />
    </div>
  )
}
