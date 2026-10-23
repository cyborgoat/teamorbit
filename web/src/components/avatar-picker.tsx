import { queryKeys } from '@/lib/query-keys'
import { uploadImage } from '@/lib/api'
import { useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/user-avatar'
import { isDefaultAvatar, isSelectedPreset } from '@/lib/avatar'
import { orbit } from '@/lib/api'

export function AvatarPicker({
  name,
  value,
  onChange,
  onUploadingChange,
}: {
  name: string
  value?: string | null
  onChange: (url: string) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [externalUrl, setExternalUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const urlId = useId()
  const presets = useQuery({
    queryKey: queryKeys.avatars,
    queryFn: () => orbit.avatars.list(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const useDefault = isDefaultAvatar(value)
  function select(url: string) {
    onChange(url)
    setExternalUrl('')
    setUrlError('')
  }
  function applyUrl() {
    try {
      const url = new URL(externalUrl.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error('Unsupported protocol')
      onChange(url.href)
      setUrlError('')
    } catch {
      setUrlError(
        'Enter a direct image URL beginning with http:// or https://.',
      )
    }
  }
  async function upload(file?: File) {
    if (!file) return
    setUploading(true)
    onUploadingChange(true)
    try {
      const response = await uploadImage(file)
      select(response.url)
      toast.success('Avatar uploaded. Save to apply it.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Avatar upload failed',
      )
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5">
        <UserAvatar
          name={name || 'User'}
          avatarUrl={value}
          className="size-24"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <Upload />
              {uploading ? 'Uploading…' : 'Choose avatar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={uploading || useDefault}
              onClick={() => select('')}
            >
              Use default avatar
            </Button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              aria-label="Upload avatar"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                void upload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {uploading
              ? 'Uploading avatar…'
              : useDefault
                ? 'Default animal avatar · Images up to 5 MB'
                : 'Custom avatar · Images up to 5 MB'}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Character portraits</p>
        {presets.isPending && (
          <p className="text-xs text-muted-foreground">Loading portraits…</p>
        )}
        {presets.isError && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Portraits couldn’t be loaded.
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void presets.refetch()}
            >
              Retry portraits
            </Button>
          </div>
        )}
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          role="group"
          aria-label="Preset avatars"
        >
          {presets.data?.items.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={uploading}
              aria-label={`Select ${preset.name} avatar`}
              aria-pressed={isSelectedPreset(value, preset)}
              onClick={() => select(preset.isDefault ? '' : preset.url)}
              className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-transparent p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary/5"
            >
              <img
                src={preset.url}
                alt=""
                loading="lazy"
                className="size-14 rounded-full object-cover"
              />
              <span className="text-center text-xs leading-tight">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={urlId}>Image URL</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={urlId}
            aria-label="External avatar image URL"
            inputMode="url"
            className="min-w-0 flex-1 basis-48"
            value={externalUrl}
            placeholder="https://your-image-host/avatar.png"
            disabled={uploading}
            aria-invalid={!!urlError}
            aria-describedby={`${urlId}-help${urlError ? ` ${urlId}-error` : ''}`}
            onChange={(event) => {
              setExternalUrl(event.target.value)
              setUrlError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyUrl()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading || !externalUrl.trim()}
            onClick={applyUrl}
          >
            Use image link
          </Button>
        </div>
        <p id={`${urlId}-help`} className="text-xs text-muted-foreground">
          Use a direct HTTP or HTTPS image link, then save your changes.
        </p>
        {urlError && (
          <p
            id={`${urlId}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {urlError}
          </p>
        )}
      </div>
    </div>
  )
}
