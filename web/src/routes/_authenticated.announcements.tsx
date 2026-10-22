import { useAuth } from '@/lib/auth'
import { canManage, canModerate } from '@/lib/policies'
import { useResourceList } from '@/hooks/use-resource-list'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
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
import type { Announcement } from '@goatcheese/teamorbit-client'

export const Route = createFileRoute('/_authenticated/announcements')({
  component: AnnouncementsPage,
})

function AnnouncementsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, error, refetch, isFetching, isLoading, pagination, items } =
    useResourceList<Announcement>(queryKeys.announcements, (query) =>
      orbit.announcements.list(query),
    )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () => orbit.announcements.create({ title, description }),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      setOpen(false)
      qc.invalidateQueries({ queryKey: queryKeys.announcements })
      toast.success('Announcement published')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => orbit.announcements.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcements })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Short team notices. Creating one also pushes a live notification."
        actions={
          canManage(user) && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus data-icon="inline-start" />
                  New announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    create.mutate()
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>New announcement</DialogTitle>
                    <DialogDescription>
                      Visible to all signed-in members after publish.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="ann-title">Title</Label>
                    <Input
                      id="ann-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ann-body">Description</Label>
                    <Textarea
                      id="ann-body"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
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
                      {create.isPending ? 'Publishing…' : 'Publish'}
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
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>No announcements yet</EmptyTitle>
            <EmptyDescription>
              Publish the first notice for the team.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to="/announcements/$id"
                      params={{ id: item.id }}
                      className="font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.author?.fullName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {canModerate(user, item.author.id) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={() => {
                          if (confirm('Delete this announcement?'))
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
