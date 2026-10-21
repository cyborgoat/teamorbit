import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CommentThread } from '@/components/comment-thread'
import { ListControls } from '@/components/list-controls'
import { PageHeader } from '@/components/page-header'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/announcements/$id')({
  component: AnnouncementDetailPage,
})

function AnnouncementDetailPage() {
  const { id } = Route.useParams()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.announcements, id],
    queryFn: () => orbit.announcements.get(id),
  })
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!data) return <Link to="/announcements">Back to announcements</Link>
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`By ${data.author?.fullName ?? '—'} · ${new Date(data.createdAt).toLocaleString()}`}
      />
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {data.description}
      </p>
      <CommentThread resourceType="announcement" resourceId={id} />
    </div>
  )
}
