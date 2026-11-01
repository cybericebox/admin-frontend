"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { effectiveStatus } from "@/lib/templateStatus"
import { notifTypeLabel } from "@/utils/notifType"

export type TemplateSortKey = "type" | "status" | "updated" | "updatedBy"
export type TemplateSort = { key: TemplateSortKey; dir: "asc" | "desc" }

type Version = { UpdatedAt?: string | null; UpdatedByUserID?: string | null } | null | undefined
type Entry = { NotificationType: string; Draft: Version; Published: Version; Unpublished: Version }

const effective = (entry: Entry): Version => {
  const status = effectiveStatus(entry as never)
  return status === "published" ? entry.Published : status === "draft" ? entry.Draft : entry.Unpublished
}

/** One comparator for the list: by type label, status, last change or who changed it; ties keep the type order. */
export function compareEntries(sort: TemplateSort, nameOf: (userId: string | null | undefined) => string) {
  const factor = sort.dir === "asc" ? 1 : -1
  const byType = (a: Entry, b: Entry) => notifTypeLabel(a.NotificationType).localeCompare(notifTypeLabel(b.NotificationType), "uk")
  return (a: Entry, b: Entry) => {
    let result: number
    if (sort.key === "type") result = byType(a, b)
    else if (sort.key === "status") result = String(effectiveStatus(a as never) ?? "").localeCompare(String(effectiveStatus(b as never) ?? ""))
    else if (sort.key === "updated") result = Date.parse(effective(a)?.UpdatedAt ?? "") - Date.parse(effective(b)?.UpdatedAt ?? "") || 0
    else result = nameOf(effective(a)?.UpdatedByUserID).localeCompare(nameOf(effective(b)?.UpdatedByUserID), "uk")
    return result * factor || byType(a, b)
  }
}

/** A sortable column heading of the template lists. */
export function SortableHeading({ label, field, sort, onSort }: { label: string; field: TemplateSortKey; sort: TemplateSort; onSort: (field: TemplateSortKey) => void }) {
  const active = sort.key === field
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-2.5 text-left">
    <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1.5 font-medium hover:text-foreground">{label}<Icon aria-hidden="true" className="h-3.5 w-3.5" /></button>
  </th>
}

/** The next sort after a click on a column: the same column flips, another one starts ascending (dates descending). */
export function nextSort(current: TemplateSort, field: TemplateSortKey): TemplateSort {
  if (current.key === field) return { key: field, dir: current.dir === "asc" ? "desc" : "asc" }
  return { key: field, dir: field === "updated" ? "desc" : "asc" }
}
