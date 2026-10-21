import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CommentThread } from '@/components/comment-thread'
import { ListControls } from '@/components/list-controls'
import { MarkdownBody } from '@/components/markdown-body'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export const Route = createFileRoute('/_authenticated/news/$id')({
  component: NewsDetailPage,
})

function NewsDetailPage() {
  const { id } = Route.useParams()
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: [...queryKeys.news, id],
    queryFn: () => orbit.news.get(id),
  })
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error)
    return (
      <ListControls page={1} setPage={() => {}} error={error} retry={refetch} />
    )
  if (!data) return <Link to="/news">Back to news</Link>
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`By ${data.author.fullName} · ${new Date(data.createdAt).toLocaleString()}`}
      />
      {(data.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {data.coverImageUrl ? (
        <img
          src={data.coverImageUrl}
          alt=""
          className="max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}
      <MarkdownBody content={data.content} />
      <CommentThread resourceType="news" resourceId={id} />
    </div>
  )
}
