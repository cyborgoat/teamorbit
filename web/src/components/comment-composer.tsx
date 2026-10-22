import { useState } from 'react'
import { MarkdownEditor } from '@/components/markdown-editor'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
export function CommentComposer({
  reply = false,
  pending,
  onSubmit,
  initialContent = '',
  submitLabel,
  onCancel,
}: {
  reply?: boolean
  pending: boolean
  onSubmit: (content: string) => Promise<unknown>
  initialContent?: string
  submitLabel?: string
  onCancel?: () => void
}) {
  const [content, setContent] = useState(initialContent)
  const [uploading, setUploading] = useState(false)
  const id = reply ? undefined : 'forum-comment'
  const editing = initialContent.length > 0 || !!onCancel
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (uploading || pending || !content.trim()) return
        void onSubmit(content)
          .then(() => {
            if (!editing) setContent('')
          })
          .catch(() => {})
      }}
    >
      {!reply && !editing && (
        <Label htmlFor="forum-comment-input">Add a comment</Label>
      )}
      <MarkdownEditor
        id={id}
        value={content}
        onChange={setContent}
        onUploadingChange={setUploading}
        minHeightClass={reply || editing ? 'min-h-20' : 'min-h-24'}
        placeholder={
          reply
            ? 'Write a reply…'
            : editing
              ? 'Edit comment…'
              : 'Write a markdown comment…'
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size={reply || editing ? 'sm' : 'default'}
          disabled={uploading || pending || !content.trim()}
        >
          {pending
            ? editing
              ? 'Saving…'
              : 'Posting…'
            : (submitLabel ??
              (editing ? 'Save' : reply ? 'Post reply' : 'Post comment'))}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size={reply || editing ? 'sm' : 'default'}
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
