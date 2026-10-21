export const queryKeys = {
  profile: (token: string | null) => ['auth-user', token] as const,
  users: ['users'] as const,
  events: ['events'] as const,
  announcements: ['announcements'] as const,
  news: ['news'] as const,
  blog: ['blog'] as const,
  forum: ['forum-posts'] as const,
  post: (id: string) => ['forum-post', id] as const,
  comments: (resourceType: string, resourceId: string) =>
    ['comments', resourceType, resourceId] as const,
  notifications: ['notifications'] as const,
  avatars: ['avatar-presets'] as const,
}
