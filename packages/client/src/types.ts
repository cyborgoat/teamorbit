import type { components, paths } from './schema.js';

type Schemas = components['schemas'];

/** User records always include email; it is null when no address is supplied. */
export type User = Schemas['UserDto'];
export type UploadCleanupPreview = Schemas['CleanupPreviewDto'];
export type UploadCleanupRun = Schemas['CleanupRunDto'];
export type AvatarPreset = Schemas['AvatarPresetDto'];
/** Explicit login selector; omit it to infer email from an @ in the identifier. */
export type LoginMethod = 'username' | 'email';
export type Role = User['role'];
export type UserStatus = User['status'];
export type Event = Schemas['EventDto'];
export type Announcement = Schemas['AnnouncementDto'];
export type News = Schemas['NewsDto'];
export type BlogPost = Schemas['BlogPostDto'];
export type ForumPost = Schemas['ForumPostDetailDto'];
export type Comment = Schemas['CommentDto'];
/** @deprecated Use `Comment` */
export type ForumComment = Comment;
export type Notification = Schemas['PaginatedNotificationsDto']['items'][number];

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never;

/** JSON request body of an endpoint. */
export type BodyOf<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer R;
}
  ? Json<NonNullable<R>>
  : never;

/** Query parameters of an endpoint (list filters, `page`, `limit`, ...). */
export type QueryOf<P extends keyof paths, M extends keyof paths[P] = 'get' & keyof paths[P]> =
  paths[P][M] extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;

/** Successful (2xx) JSON response of an endpoint. */
export type ResponseOf<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: infer R;
}
  ? Json<R[keyof R & (200 | 201 | 202)]>
  : never;
