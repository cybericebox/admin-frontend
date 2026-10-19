import { isUnsetDate } from "./dates"

// Older event API responses used Go's zero time for an omitted archive date.
export function isUnsetEventDate(value: string | null | undefined): boolean {
  return isUnsetDate(value)
}
