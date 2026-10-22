/** Convert an ISO timestamp to a value for `<input type="datetime-local">`. */
export function toLocalInput(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Convert a datetime-local value to an ISO timestamp. */
export function fromLocalInput(value: string) {
  return new Date(value).toISOString()
}
