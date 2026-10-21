/** Shared GLOBAL notification payload for content creates. */
export function globalCreatedNotification(input: {
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
}) {
  return {
    audience: 'GLOBAL' as const,
    type: input.type,
    title: input.title,
    body: input.body,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  };
}
