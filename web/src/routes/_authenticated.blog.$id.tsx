import { createFileRoute } from '@tanstack/react-router'
import { ArticleDetail } from '@/components/article-detail'

export const Route = createFileRoute('/_authenticated/blog/$id')({
  component: BlogDetailPage,
})

function BlogDetailPage() {
  const { id } = Route.useParams()
  return <ArticleDetail kind="blog" id={id} />
}
