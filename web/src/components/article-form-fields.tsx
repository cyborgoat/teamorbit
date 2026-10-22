import { ImageUpload } from '@/components/image-upload'
import { MarkdownEditor } from '@/components/markdown-editor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ArticleFormValues = {
  title: string
  content: string
  tags: string
  coverImageUrl: string
}

export const emptyArticleForm = (): ArticleFormValues => ({
  title: '',
  content: '',
  tags: '',
  coverImageUrl: '',
})

export function ArticleFormFields({
  form,
  setForm,
  idPrefix,
  showTags = true,
  showCover = true,
  titleId,
  contentId,
  contentLabelId,
  onContentUploadingChange,
  onCoverUploadingChange,
}: {
  form: ArticleFormValues
  setForm: (
    next: ArticleFormValues | ((prev: ArticleFormValues) => ArticleFormValues),
  ) => void
  idPrefix: string
  showTags?: boolean
  showCover?: boolean
  /** Override title input id (e.g. create page uses post-title). */
  titleId?: string
  contentId?: string
  contentLabelId?: string
  onContentUploadingChange?: (uploading: boolean) => void
  onCoverUploadingChange?: (uploading: boolean) => void
}) {
  const patch = (partial: Partial<ArticleFormValues>) =>
    setForm((prev) => ({ ...prev, ...partial }))

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={titleId ?? `${idPrefix}-title`}>Title</Label>
        <Input
          id={titleId ?? `${idPrefix}-title`}
          value={form.title}
          onChange={(event) => patch({ title: event.target.value })}
          required
        />
      </div>
      {showTags ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
          <Input
            id={`${idPrefix}-tags`}
            placeholder="team, release, ops"
            value={form.tags}
            onChange={(event) => patch({ tags: event.target.value })}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={contentLabelId ?? `${idPrefix}-content`}>Content</Label>
        <MarkdownEditor
          id={contentId ?? `${idPrefix}-content`}
          value={form.content}
          onChange={(content) => patch({ content })}
          onUploadingChange={onContentUploadingChange}
          required
          minHeightClass="min-h-80"
        />
      </div>
      {showCover ? (
        <div className="space-y-2">
          <Label>Cover image</Label>
          <ImageUpload
            value={form.coverImageUrl}
            onChange={(coverImageUrl) => patch({ coverImageUrl })}
            onUploadingChange={onCoverUploadingChange}
          />
        </div>
      ) : null}
    </>
  )
}
