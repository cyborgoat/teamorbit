import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CommentThread } from '@/components/comment-thread'
import { ListControls } from '@/components/list-controls'
import { PageHeader } from '@/components/page-header'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/events/$id')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { id } = Route.useParams()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.events, id],
    queryFn: () => orbit.events.get(id),
  })
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!data) return <Link to="/events">Back to events</Link>
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`${data.location} · ${new Date(data.startAt).toLocaleString()} – ${new Date(data.endAt).toLocaleString()}`}
      />
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
