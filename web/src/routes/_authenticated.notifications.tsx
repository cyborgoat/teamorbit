import { useListPage } from '@/hooks/use-list-page'
import { ListControls } from '@/components/list-controls'
import { queryKeys } from '@/lib/query-keys'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/notifications')({
  component: NotificationsPage,
})

type InboxGroup = 'unread' | 'read' | 'dismissed'

const groups: { id: InboxGroup; label: string }[] = [
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'dismissed', label: 'Dismissed' },
]

function NotificationsPage() {
  const qc = useQueryClient()
  const pagination = useListPage()
  const [group, setGroup] = useState<InboxGroup>('unread')

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.notifications })

  const { data, error, refetch, isFetching, isLoading } = useQuery({
    queryKey: [...queryKeys.notifications, group, pagination.page],
    queryFn: () =>
      orbit.notifications.list({
        page: pagination.page,
        limit: pagination.limit,
        status: group,
      }),
  })

  const counts = useQuery({
    queryKey: [...queryKeys.notifications, 'counts'],
    queryFn: async () => {
      const [unread, read, dismissed] = await Promise.all([
        orbit.notifications.list({ status: 'unread', limit: 1 }),
        orbit.notifications.list({ status: 'read', limit: 1 }),
        orbit.notifications.list({ status: 'dismissed', limit: 1 }),
      ])
      return {
        unread: unread.total,
        read: read.total,
        dismissed: dismissed.total,
      }
    },
  })

  const markRead = useMutation({
    mutationFn: (id: string) => orbit.notifications.markRead(id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Marked as read')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const markUnread = useMutation({
    mutationFn: (id: string) => orbit.notifications.markUnread(id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Marked as unread')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const markAllRead = useMutation({
    mutationFn: () => orbit.notifications.markAllRead(),
    onSuccess: async (res) => {
      await invalidate()
      toast.success(`Marked ${res.marked} as read`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const dismiss = useMutation({
    mutationFn: (id: string) => orbit.notifications.delete(id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Dismissed')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const restore = useMutation({
    mutationFn: (id: string) => orbit.notifications.restore(id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Restored')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const busy =
    markRead.isPending ||
    markUnread.isPending ||
    markAllRead.isPending ||
    dismiss.isPending ||
    restore.isPending

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Grouped inbox for testing read, unread, dismiss, and restore."
        actions={
          group !== 'dismissed' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || (counts.data?.unread ?? 0) === 0}
              onClick={() => markAllRead.mutate()}
            >
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {groups.map((g) => (
          <Button
            key={g.id}
            size="sm"
            variant={group === g.id ? 'default' : 'outline'}
            onClick={() => {
              setGroup(g.id)
              pagination.setPage(1)
            }}
          >
            {g.label}
            <Badge
              variant={group === g.id ? 'secondary' : 'outline'}
              className="ml-1"
            >
              {counts.data?.[g.id] ?? '…'}
            </Badge>
          </Button>
        ))}
      </div>

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
              <Bell />
            </EmptyMedia>
            <EmptyTitle>
              {group === 'unread'
                ? 'No unread notifications'
                : group === 'read'
                  ? 'No read notifications'
                  : 'No dismissed notifications'}
            </EmptyTitle>
            <EmptyDescription>
              Create content elsewhere to generate notifications, then use the
              actions below to move items between groups.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-64 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((n) => (
                <TableRow
                  key={n.id}
                  className={cn(group === 'unread' && 'bg-muted/30')}
                >
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {group === 'unread' ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <span className="mt-1.5 size-2 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{n.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {n.body}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{n.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {group === 'unread' ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => markRead.mutate(n.id)}
                          >
                            Mark read
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => dismiss.mutate(n.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                      {group === 'read' ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => markUnread.mutate(n.id)}
                          >
                            Mark unread
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => dismiss.mutate(n.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                      {group === 'dismissed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => restore.mutate(n.id)}
                        >
                          Restore
                        </Button>
                      ) : null}
                    </div>
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
