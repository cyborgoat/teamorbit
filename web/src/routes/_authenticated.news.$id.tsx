import { createFileRoute } from '@tanstack/react-router'
import { ArticleDetail } from '@/components/article-detail'

export const Route = createFileRoute('/_authenticated/news/$id')({
  component: NewsDetailPage,
})

function NewsDetailPage() {
  const { id } = Route.useParams()
  return <ArticleDetail kind="news" id={id} />
}
