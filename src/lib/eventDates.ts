// Older event API responses used Go's zero time for an omitted archive date.
export function isUnsetEventDate(value: string | null | undefined): boolean {
  return !value || /^0001-01-01(?:T|\s|$)/.test(value)
}
