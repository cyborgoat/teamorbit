export const DEFAULT_AVATAR_URL = '/avatars/default-raven.png'

import type { AvatarPreset } from '@goatcheese/teamorbit-client'
export function isSelectedPreset(
  value: string | null | undefined,
  preset: AvatarPreset,
) {
  if (preset.isDefault && isDefaultAvatar(value)) return true
  try {
    return (
      !!value &&
      new URL(value, window.location.origin).href ===
        new URL(preset.url, window.location.origin).href
    )
  } catch {
    return false
  }
}

export function isDefaultAvatar(url?: string | null) {
  if (!url) return true
  try {
    return new URL(url, window.location.origin).pathname === DEFAULT_AVATAR_URL
  } catch {
    return false
  }
}
