// Column order and visibility of an index table (the idea of nexus index-shell/columns.js, Apache-2.0), pure.
// A layout is one list: the keys shown, in order. A hidden column is simply absent. The identity column is always
// first: it cannot be hidden, moved, or have anything placed before it.

/** The identity first; unknown and repeated keys dropped. */
export function normalizeCols(cols: readonly string[] | undefined, allKeys: readonly string[], identity: string): string[] {
  const known = new Set(allKeys)
  const seen = new Set([identity])
  const out = [identity]
  for (const key of cols ?? []) {
    if (seen.has(key) || !known.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/** Move `key` so it lands at `toIndex` of the list as it was before the move. */
export function moveCol(cols: string[], key: string, toIndex: number, identity: string): string[] {
  if (key === identity) return cols
  const from = cols.indexOf(key)
  if (from < 0) return cols
  let to = Math.max(1, Math.min(toIndex, cols.length))
  const next = cols.filter((k) => k !== key)
  if (from < to) to -= 1
  to = Math.max(1, to)
  next.splice(to, 0, key)
  return next
}

/** One step up (-1) or down (+1): Alt+↑ / Alt+↓ on a handle of the Columns menu. */
export function moveColBy(cols: string[], key: string, delta: -1 | 1, identity: string): string[] {
  if (key === identity) return cols
  const from = cols.indexOf(key)
  const to = from + delta
  if (from < 0 || to < 1 || to >= cols.length) return cols
  const next = [...cols]
  next.splice(from, 1)
  next.splice(to, 0, key)
  return next
}

/** Hide a shown column, or show a hidden one at the end. */
export function toggleCol(cols: string[], key: string, identity: string): string[] {
  if (key === identity) return cols
  return cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key]
}

/** Where a handle dragged to `y` would drop: the index of the gap whose neighbours' midpoints it is between. Never 0. */
export function insertionIndex(rects: readonly { top: number; bottom: number }[], y: number): number {
  let index = rects.length
  for (let i = 0; i < rects.length; i += 1) {
    if (y < (rects[i].top + rects[i].bottom) / 2) { index = i; break }
  }
  return Math.max(1, index)
}

export type MenuEntry = { key: string; on: boolean; locked: boolean }

/** The Columns menu list: shown columns in their order, then the hidden ones in catalogue order. */
export function columnsMenuList(cols: readonly string[], allKeys: readonly string[], identity: string): MenuEntry[] {
  const shown = new Set(cols)
  return [
    ...cols.map((key) => ({ key, on: true, locked: key === identity })),
    ...allKeys.filter((k) => !shown.has(k)).map((key) => ({ key, on: false, locked: false })),
  ]
}

export const sameCols = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && a.every((k, i) => k === b[i])

export const MIN_COL_WIDTH = 80
export const MAX_COL_WIDTH = 640
export const DEFAULT_COL_WIDTH = 160

/** The width a column is drawn at: the dragged (saved) width, else the configured one, else the default. */
export function columnWidth(configured: number | undefined, saved: number | undefined): number {
  const width = saved && saved > 0 ? saved : configured ?? DEFAULT_COL_WIDTH
  return Math.round(Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, width)))
}
