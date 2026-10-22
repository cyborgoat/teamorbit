import { useAuth } from '@/lib/auth'
import { canManage, canModerate } from '@/lib/policies'
import { useResourceList } from '@/hooks/use-resource-list'
import { ListControls } from '@/components/list-controls'
import {
  emptyEventForm,
  EventFormFields,
  type EventFormValues,
} from '@/components/event-form-fields'
import { queryKeys } from '@/lib/query-keys'
import { fromLocalInput } from '@/lib/event-datetime'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { orbit } from '@/lib/api'
import type { Event } from '@goatcheese/teamorbit-client'

export const Route = createFileRoute('/_authenticated/events')({
  component: EventsPage,
})

function EventsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, error, refetch, isFetching, isLoading, pagination, items } =
    useResourceList<Event>(queryKeys.events, (query) =>
      orbit.events.list(query),
    )
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EventFormValues>(emptyEventForm)

  const create = useMutation({
    mutationFn: () => {
      const audience =
        canManage(user) && form.audience === 'INVITE_ONLY'
          ? 'INVITE_ONLY'
          : 'GLOBAL'
      return orbit.events.create({
        title: form.title,
        description: form.description,
        location: form.location,
        startAt: fromLocalInput(form.startAt),
        endAt: fromLocalInput(form.endAt),
        coverImageUrl: form.coverImageUrl || undefined,
        audience,
        recipientIds:
          audience === 'INVITE_ONLY' ? form.recipientIds : undefined,
      })
    },
    onSuccess: () => {
      setForm(emptyEventForm())
      setOpen(false)
      qc.invalidateQueries({ queryKey: queryKeys.events })
      toast.success('Event created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => orbit.events.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title="Events"
        description="Team schedule with local date/time pickers and optional cover images."
        actions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus data-icon="inline-start" />
                  New event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    create.mutate()
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>New event</DialogTitle>
                    <DialogDescription>
                      Dates use your local timezone and are stored as ISO
                      timestamps.
                    </DialogDescription>
                  </DialogHeader>
                  <EventFormFields
                    form={form}
                    setForm={setForm}
                    user={user}
                    idPrefix="ev"
                    showAudienceHint
                    inviteesEnabled={canManage(user) && open}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? 'Saving…' : 'Create event'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <ListControls
        {...pagination}
        total={data?.total}
        error={error}
        retry={refetch}
        pending={isFetching}
      />
      {error ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No events scheduled</EmptyTitle>
            <EmptyDescription>
              Add an event with start/end times and a location.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.coverImageUrl ? (
                        <img
                          src={item.coverImageUrl}
                          alt=""
                          className="size-10 rounded-md object-cover"
                        />
                      ) : null}
                      <div>
                        <Link
                          to="/events/$id"
                          params={{ id: item.id }}
                          className="font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                        <div className="line-clamp-1 text-sm text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.audience === 'INVITE_ONLY'
                        ? 'Invite-only'
                        : 'Global'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.startAt).toLocaleString()}
                    <div className="text-xs">
                      → {new Date(item.endAt).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell>
                    {canModerate(user, item.createdBy.id) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={() => {
                          if (confirm('Delete this event?'))
                            remove.mutate(item.id)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
