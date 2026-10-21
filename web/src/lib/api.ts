import { createTeamOrbitClient } from '@goatcheese/teamorbit-client'
import { getToken } from './session'
export { TeamOrbitError as ApiError } from '@goatcheese/teamorbit-client'
export type { User } from '@goatcheese/teamorbit-client'
export const orbit = createTeamOrbitClient({
  baseUrl: window.location.origin,
  token: () => getToken() ?? undefined,
})
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export function validateImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error('Images must be 5 MB or smaller')
}
export async function uploadImage(file: File) {
  validateImage(file)
  return orbit.uploads.upload(file, file.name)
}
