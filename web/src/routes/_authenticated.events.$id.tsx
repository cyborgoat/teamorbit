import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import {
  emptyEventForm,
  EventFormFields,
  type EventFormValues,
} from '@/components/event-form-fields'
import { ListControls } from '@/components/list-controls'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { canManage, canModerate } from '@/lib/policies'
import { fromLocalInput, toLocalInput } from '@/lib/event-datetime'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/events/$id')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.events, id],
    queryFn: () => orbit.events.get(id),
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EventFormValues>(emptyEventForm)
  const [coverUploading, setCoverUploading] = useState(false)

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
        audience,
        ...(canManage(user)
          ? {
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
        <EventFormFields
          form={form}
          setForm={setForm}
          user={user}
          idPrefix="ev-edit"
          descriptionRows={5}
          creatorId={data.createdBy.id}
          coverUploadingChange={setCoverUploading}
          inviteesEnabled={canManage(user) && editing}
        />
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
