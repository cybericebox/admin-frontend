// The filter model of an index table (the idea of nexus index-shell/filters.js, Apache-2.0), pure.
// A page describes its fields once as FilterDefs. A filter bag is { [key]: { op, v: string[] } }; every value is a
// string so the bag round-trips through the address (`f.<key>=op:v1,v2`) and a saved view unchanged.

export type FilterType = "choice" | "text" | "number" | "boolean" | "date"
export type FilterOption = { value: string; label: string }
export type FilterDef = {
  key: string
  label: string
  type: FilterType
  options?: FilterOption[]
  /** A choice that holds one value: picking another replaces it. */
  single?: boolean
  /** The operators the backend of the page understands; defaults by type. */
  ops?: Op[]
}
export type Op = "in" | "not_in" | "contains" | "is" | "gt" | "gte" | "lt" | "eq" | "after" | "before" | "between" | "empty" | "not_empty"
export type Cond = { op: Op; v: string[] }
export type FilterBag = Record<string, Cond>

export const OPS_BY_TYPE: Record<FilterType, Op[]> = {
  choice: ["in", "not_in", "empty", "not_empty"],
  text: ["contains", "is", "empty", "not_empty"],
  number: ["gt", "gte", "lt", "eq", "empty", "not_empty"],
  boolean: ["is"],
  date: ["after", "before", "between"],
}
const VALUELESS = new Set<Op>(["empty", "not_empty"])
const ALL_OPS = new Set<Op>(Object.values(OPS_BY_TYPE).flat())

export const opsOf = (def: FilterDef): Op[] => def.ops ?? OPS_BY_TYPE[def.type]
export const defaultOp = (def: FilterDef): Op => opsOf(def)[0]
export const isValueless = (op: Op) => VALUELESS.has(op)

const clean = (v: readonly string[] | undefined) => (v ?? []).filter((x) => typeof x === "string" && x.trim() !== "")

/** Does the condition carry everything its operator needs? */
export function isComplete(cond: Cond | undefined): cond is Cond {
  if (!cond || !ALL_OPS.has(cond.op)) return false
  if (cond.op === "between") return clean(cond.v).length >= 2
  return VALUELESS.has(cond.op) || clean(cond.v).length >= 1
}

export const urlKey = (key: string) => `f.${key}`

/** `in:admin,user` -> { op, v }; anything malformed gives undefined (the filter is ignored). */
export function parseCond(raw: string | undefined, def: FilterDef): Cond | undefined {
  if (!raw) return undefined
  const at = raw.indexOf(":")
  const op = (at < 0 ? raw : raw.slice(0, at)) as Op
  if (!opsOf(def).includes(op)) return undefined
  const v = at < 0 || at === raw.length - 1 ? [] : raw.slice(at + 1).split(",").map((x) => decodeURIComponent(x))
  const cond = { op, v: clean(v) }
  return isComplete(cond) ? cond : undefined
}

export function serializeCond(cond: Cond | undefined): string {
  if (!isComplete(cond)) return ""
  return VALUELESS.has(cond.op) ? cond.op : `${cond.op}:${clean(cond.v).map((x) => encodeURIComponent(x)).join(",")}`
}

/** The bag held by the address values of `f.<key>`. */
export function bagFromUrl(values: Record<string, string>, defs: readonly FilterDef[]): FilterBag {
  const bag: FilterBag = {}
  for (const def of defs) {
    const cond = parseCond(values[urlKey(def.key)], def)
    if (cond) bag[def.key] = cond
  }
  return bag
}

export const activeCount = (bag: FilterBag) => Object.keys(bag).length

/** A stable text of the bag: the key of a request, and of a facet request. */
export const bagSignature = (bag: FilterBag) => Object.keys(bag).sort().map((key) => `${key}=${serializeCond(bag[key])}`).join("&")

export function withoutKey(bag: FilterBag, key: string): FilterBag {
  const rest = { ...bag }
  delete rest[key]
  return rest
}

const labelOf = (def: FilterDef, value: string) => def.options?.find((o) => o.value === value)?.label ?? value

/** The three parts of a chip: field, operator, value (each styled apart). `opLabel` names an operator in the UI language. */
export function chipParts(def: FilterDef, cond: Cond | undefined, opLabel: (op: Op) => string, yes: string, no: string, any: string): { key: string; op: string; value: string } {
  const key = def.label
  if (!isComplete(cond)) return { key, op: "", value: any }
  const v = clean(cond.v)
  if (VALUELESS.has(cond.op)) return { key, op: opLabel(cond.op), value: "" }
  if (cond.op === "between") return { key, op: opLabel("between"), value: `${v[0]} – ${v[1] ?? ""}` }
  if (def.type === "boolean") return { key, op: opLabel("is"), value: v[0] === "true" ? yes : no }
  if (cond.op === "in" || cond.op === "not_in") {
    const labels = v.map((x) => labelOf(def, x))
    const shown = labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", ")
    return { key, op: opLabel(cond.op === "in" && labels.length === 1 ? "is" : cond.op), value: shown }
  }
  return { key, op: opLabel(cond.op), value: v[0] }
}

/** A choice field's options with their counts: `counts` is { value: n } once known, undefined while loading, null when unknown. */
export function orderFacetOptions(options: readonly FilterOption[], counts: Record<string, number> | undefined | null) {
  const base = options.map((o) => ({ ...o, count: counts === undefined ? undefined : counts === null ? null : (counts[o.value] ?? 0) }))
  if (!counts) return base
  // Options with records first (most records first), the empty ones after, never hidden.
  const nonEmpty = base.filter((o) => (o.count as number) > 0).sort((a, b) => (b.count as number) - (a.count as number))
  return [...nonEmpty, ...base.filter((o) => (o.count as number) === 0)]
}
