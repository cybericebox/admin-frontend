import { t, type MessageVars } from "./t"

const rules = new Map<string, Intl.PluralRules>()

/** The plural suffix of a count: «one», «few» or «many» (the form for «other» too). English reads «one» and «many». */
export function pluralSuffix(count: number, locale = "uk"): "one" | "few" | "many" {
  let rule = rules.get(locale)
  if (!rule) { rule = new Intl.PluralRules(locale); rules.set(locale, rule) }
  const category = rule.select(count)
  return category === "one" || category === "few" ? category : "many"
}

/** Translates `<key>.one|few|many` by the count; `count` is also passed as a variable unless `vars` sets it. */
export function tPlural(key: string, count: number, vars: MessageVars = {}): string {
  return t(`${key}.${pluralSuffix(count)}`, { count, ...vars })
}
