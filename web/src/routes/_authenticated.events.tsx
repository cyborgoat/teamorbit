import { useAuth } from '@/lib/auth'
import { canManage } from '@/lib/policies'
import { useResourceList } from '@/hooks/use-resource-list'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ImageUpload } from '@/components/image-upload'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { orbit } from '@/lib/api'
import type { Event } from '@goatcheese/teamorbit-client'

export const Route = createFileRoute('/_authenticated/events')({
  component: EventsPage,
})

function fromLocalInput(value: string) {
  return new Date(value).toISOString()
}

const emptyForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: '',
  coverImageUrl: '',
  audience: 'GLOBAL' as 'GLOBAL' | 'SELECTED',
  recipientIds: [] as string[],
}

function EventsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, error, refetch, isFetching, isLoading, pagination, items } =
    useResourceList<Event>(queryKeys.events, (query) =>
      orbit.events.list(query),
    )
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const usersQuery = useQuery({
    queryKey: [...queryKeys.users, 'active-picker'],
    queryFn: () =>
      orbit.users.list({ page: 1, limit: 100, status: 'ACTIVE' }),
    enabled: canManage(user) && open && form.audience === 'SELECTED',
  })

  const create = useMutation({
    mutationFn: () =>
      orbit.events.create({
        title: form.title,
        description: form.description,
        location: form.location,
        startAt: fromLocalInput(form.startAt),
        endAt: fromLocalInput(form.endAt),
        coverImageUrl: form.coverImageUrl || undefined,
        audience: form.audience,
        recipientIds:
          form.audience === 'SELECTED' ? form.recipientIds : undefined,
      }),
    onSuccess: () => {
      setForm(emptyForm)
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

  const toggleRecipient = (id: string) => {
    if (id === user?.id) return
    setForm((prev) => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(id)
        ? prev.recipientIds.filter((x) => x !== id)
        : [...prev.recipientIds, id],
    }))
  }

  return (
    <div>
      <PageHeader
        title="Events"
        description="Team schedule with local date/time pickers and optional cover images."
        actions={
          canManage(user) && (
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
                  <div className="space-y-2">
                    <Label htmlFor="ev-title">Title</Label>
                    <Input
                      id="ev-title"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ev-location">Location</Label>
                    <Input
                      id="ev-location"
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ev-start">Starts</Label>
                      <Input
                        id="ev-start"
                        type="datetime-local"
                        value={form.startAt}
                        onChange={(e) =>
                          setForm({ ...form, startAt: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ev-end">Ends</Label>
                      <Input
                        id="ev-end"
                        type="datetime-local"
                        value={form.endAt}
                        onChange={(e) =>
                          setForm({ ...form, endAt: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ev-desc">Description</Label>
                    <Textarea
                      id="ev-desc"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      required
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Audience</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="ev-audience"
                        checked={form.audience === 'GLOBAL'}
                        onChange={() =>
                          setForm({
                            ...form,
                            audience: 'GLOBAL',
                            recipientIds: [],
                          })
                        }
                      />
                      Entire team
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="ev-audience"
                        checked={form.audience === 'SELECTED'}
                        onChange={() =>
                          setForm({ ...form, audience: 'SELECTED' })
                        }
                      />
                      Selected users
                    </label>
                  </fieldset>
                  {form.audience === 'SELECTED' ? (
                    <div className="space-y-2">
                      <Label>Invitees</Label>
                      <p className="text-xs text-muted-foreground">
                        You are always included as the creator.
                      </p>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                        {usersQuery.isLoading ? (
                          <p className="text-sm text-muted-foreground">
                            Loading members…
                          </p>
                        ) : (
                          (usersQuery.data?.items ?? []).map((member) => {
                            const isCreator = member.id === user?.id
                            const checked =
                              isCreator ||
                              form.recipientIds.includes(member.id)
                            return (
                              <label
                                key={member.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isCreator}
                                  onChange={() => toggleRecipient(member.id)}
                                />
                                <span>
                                  {member.fullName}
                                  <span className="text-muted-foreground">
                                    {' '}
                                    @{member.username}
                                    {isCreator ? ' (you)' : ''}
                                  </span>
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Cover image</Label>
                    <ImageUpload
                      value={form.coverImageUrl}
                      onChange={(url) =>
                        setForm({ ...form, coverImageUrl: url })
                      }
                    />
                  </div>
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
                      {item.audience === 'SELECTED' ? 'Invitees' : 'Team'}
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
                    {canManage(user) && (
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
