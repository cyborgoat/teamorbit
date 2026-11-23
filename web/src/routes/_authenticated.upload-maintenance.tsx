import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { orbit } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canManage } from '@/lib/policies'
import { PageHeader } from '@/components/page-header'
import { ListPage, ListTable } from '@/components/data-table'
import { ListControls } from '@/components/list-controls'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/upload-maintenance')({
  component: UploadMaintenancePage,
})

const bytes = (value: number) =>
  value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`
const date = (value: string) => new Date(value).toLocaleString()

function UploadMaintenancePage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState(false)
  const qc = useQueryClient()
  const preview = useQuery({
    queryKey: ['upload-cleanup', page],
    queryFn: () => orbit.uploads.cleanupPreview({ page, limit: 20 }),
    enabled: canManage(user),
    refetchInterval: (query) =>
      query.state.data?.lastRun?.status === 'RUNNING' ? 2000 : false,
  })
  const cleanup = useMutation({
    mutationFn: () => orbit.uploads.startCleanup(),
    onSuccess: () => {
      setConfirm(false)
      toast.success('Upload cleanup started')
      void qc.invalidateQueries({ queryKey: ['upload-cleanup'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
      void qc.invalidateQueries({ queryKey: ['upload-cleanup'] })
    },
  })
  if (!canManage(user))
    return <p role="alert">Only administrators can manage upload cleanup.</p>
  const data = preview.data
  const run = data?.lastRun
  const running = run?.status === 'RUNNING'

  return (
    <ListPage>
      <PageHeader
        title="Upload maintenance"
        description="Review and remove uploads that no saved content references."
      />
      <p className="mb-2 max-w-prose text-xs text-muted-foreground">
        Images used by saved posts, comments, covers, and avatars are retained.
        Uses outside this app and unsaved drafts cannot be detected. Deletion is
        permanent; back up uploads before cleanup.
      </p>
      {preview.isPending ? <p>Scanning uploads…</p> : null}
      {preview.error ? <p role="alert">{preview.error.message}</p> : null}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={preview.isFetching}
          onClick={() => void preview.refetch()}
        >
          {preview.isFetching ? 'Scanning…' : 'Refresh preview'}
        </Button>
        <Button
          size="sm"
          disabled={
            !data?.eligibleCount ||
            running ||
            cleanup.isPending ||
            preview.isFetching ||
            preview.isError
          }
          onClick={() => setConfirm(true)}
        >
          {running ? 'Cleanup running…' : 'Clean now'}
        </Button>
      </div>
      {data ? (
        <>
          <div className="mb-2 grid gap-2 text-xs text-muted-foreground sm:grid-flow-col sm:auto-cols-fr sm:gap-4">
            <section className="space-y-1">
              <h2 className="font-medium text-foreground">Cleanup policy</h2>
              <p>
                Automatic cleanup:{' '}
                {data.settings.enabled
                  ? `every ${data.settings.intervalHours} hour(s)`
                  : 'disabled'}
                . Grace period: {data.settings.graceHours} hour(s) after an
                upload is first found without references.
              </p>
              <p>
                {data.total} orphan files ({bytes(data.orphanBytes)}).{' '}
                {data.eligibleCount} eligible for cleanup (
                {bytes(data.reclaimableBytes)}).
              </p>
            </section>
            {run ? (
              <section className="space-y-1" aria-live="polite">
                <h2 className="font-medium text-foreground">Latest cleanup</h2>
                <p>
                  Status: {run.status}. Trigger: {run.trigger}
                  {run.actorId ? ` (administrator ${run.actorId})` : ''}.
                </p>
                <p>
                  Started {date(run.startedAt)}
                  {run.finishedAt ? `; finished ${date(run.finishedAt)}` : ''}.
                </p>
                <p>
                  Deleted {run.deletedCount} files ({bytes(run.deletedBytes)});{' '}
                  {run.failedCount} failures.
                </p>
                {run.error ? <p role="alert">{run.error}</p> : null}
              </section>
            ) : null}
          </div>
          <ListControls
            page={page}
            setPage={setPage}
            total={data.total}
            limit={data.limit}
            retry={preview.refetch}
            pending={preview.isFetching}
          />
          <ListTable label="Orphan uploads" key={page}>
            <TableHeader>
              <TableRow>
                <TableHead>Upload</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Unreferenced since</TableHead>
                <TableHead>Eligible after</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((asset) => (
                <TableRow key={asset.path}>
                  <TableCell className="max-w-80 break-all font-mono text-xs">
                    {asset.path}
                  </TableCell>
                  <TableCell>{bytes(asset.size)}</TableCell>
                  <TableCell>{date(asset.unreferencedAt)}</TableCell>
                  <TableCell>{date(asset.eligibleAt)}</TableCell>
                  <TableCell>
                    {asset.error
                      ? `Retry pending: ${asset.error}`
                      : asset.state === 'DELETING'
                        ? 'Deletion pending'
                        : asset.eligible
                          ? 'Eligible'
                          : 'Grace period'}
                  </TableCell>
                </TableRow>
              ))}
              {!data.items.length ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    No orphan uploads on this page.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </ListTable>
        </>
      ) : null}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete eligible orphan uploads?</DialogTitle>
            <DialogDescription>
              Up to {data?.eligibleCount ?? 0} files (
              {bytes(data?.reclaimableBytes ?? 0)}) may be permanently deleted.
              Unsaved drafts and external uses are not tracked. The server
              rechecks saved references and the grace period before deleting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={cleanup.isPending}
              onClick={() => cleanup.mutate()}
            >
              {cleanup.isPending ? 'Starting…' : 'Delete eligible uploads'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListPage>
  )
}
