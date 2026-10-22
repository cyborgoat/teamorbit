import { useQuery } from '@tanstack/react-query'
import { ImageUpload } from '@/components/image-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { canManage } from '@/lib/policies'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { User } from '@goatcheese/teamorbit-client'

export type EventFormValues = {
  title: string
  description: string
  location: string
  startAt: string
  endAt: string
  coverImageUrl: string
  audience: 'GLOBAL' | 'INVITE_ONLY'
  recipientIds: string[]
}

export const emptyEventForm = (): EventFormValues => ({
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: '',
  coverImageUrl: '',
  audience: 'GLOBAL',
  recipientIds: [],
})

export function EventFormFields({
  form,
  setForm,
  user,
  idPrefix,
  descriptionRows,
  creatorId,
  showAudienceHint,
  coverUploadingChange,
  inviteesEnabled,
}: {
  form: EventFormValues
  setForm: (
    next: EventFormValues | ((prev: EventFormValues) => EventFormValues),
  ) => void
  user: Pick<User, 'id' | 'role'> | null
  idPrefix: string
  descriptionRows?: number
  /** When editing, lock the creator checkbox to this id. Defaults to current user. */
  creatorId?: string
  showAudienceHint?: boolean
  coverUploadingChange?: (uploading: boolean) => void
  inviteesEnabled: boolean
}) {
  const lockedCreatorId = creatorId ?? user?.id
  const usersQuery = useQuery({
    queryKey: [...queryKeys.users, 'active-picker'],
    queryFn: () => orbit.users.list({ page: 1, limit: 100, status: 'ACTIVE' }),
    enabled: inviteesEnabled && form.audience === 'INVITE_ONLY',
  })

  const patch = (partial: Partial<EventFormValues>) =>
    setForm((prev) => ({ ...prev, ...partial }))

  const toggleRecipient = (id: string) => {
    if (id === lockedCreatorId) return
    setForm((prev) => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(id)
        ? prev.recipientIds.filter((x) => x !== id)
        : [...prev.recipientIds, id],
    }))
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-location`}>Location</Label>
        <Input
          id={`${idPrefix}-location`}
          value={form.location}
          onChange={(e) => patch({ location: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Starts</Label>
          <Input
            id={`${idPrefix}-start`}
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => patch({ startAt: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end`}>Ends</Label>
          <Input
            id={`${idPrefix}-end`}
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => patch({ endAt: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          required
          rows={descriptionRows}
        />
      </div>
      {canManage(user) ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Audience</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-audience`}
              checked={form.audience === 'GLOBAL'}
              onChange={() => patch({ audience: 'GLOBAL', recipientIds: [] })}
            />
            Global
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-audience`}
              checked={form.audience === 'INVITE_ONLY'}
              onChange={() => patch({ audience: 'INVITE_ONLY' })}
            />
            Invite-only
          </label>
        </fieldset>
      ) : showAudienceHint ? (
        <p className="text-sm text-muted-foreground">
          Events you create are global (visible to everyone).
        </p>
      ) : null}
      {canManage(user) && form.audience === 'INVITE_ONLY' ? (
        <div className="space-y-2">
          <Label>Invitees</Label>
          <p className="text-xs text-muted-foreground">
            You are always included as the creator.
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {usersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            ) : (
              (usersQuery.data?.items ?? []).map((member) => {
                const isCreator = member.id === lockedCreatorId
                const checked =
                  isCreator || form.recipientIds.includes(member.id)
                return (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isCreator}
                      onChange={() => toggleRecipient(member.id)}
                    />
                    <span>
                      {member.fullName}
                      <span className="text-muted-foreground">
                        {' '}
                        @{member.username}
                        {isCreator ? ' (you)' : ''}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Cover image</Label>
        <ImageUpload
          value={form.coverImageUrl}
          onChange={(coverImageUrl) => patch({ coverImageUrl })}
          onUploadingChange={coverUploadingChange}
        />
      </div>
    </>
  )
}
