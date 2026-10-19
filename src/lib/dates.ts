// Go's zero time ("0001-01-01T00:00:00Z") stands for «never» / «not set» in older API responses.
export function isUnsetDate(value: string | null | undefined): value is null | undefined | "" {
  return !value || /^0001-01-01(?:T|\s|$)/.test(value)
}
