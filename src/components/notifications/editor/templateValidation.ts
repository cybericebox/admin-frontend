import { t } from "@/i18n/t"
import { VARIABLE_TOKEN, type VariableDef } from "./variableUtils"

/** Inline guidance only: saving drafts and existing send rules retain their own contracts. */
export function templateFieldError(value: string, variables: VariableDef[], required = false): string {
  if (required && !value.trim()) return t("admin.notif.validation.required")
  const opens = value.match(/\{\{/g)?.length ?? 0
  const closes = value.match(/\}\}/g)?.length ?? 0
  if (opens !== closes) return t("admin.notif.validation.syntax")
  if (variables.length === 0) return ""
  const known = new Set(variables.map(({ name }) => name))
  const unknown = [...new Set([...value.matchAll(new RegExp(VARIABLE_TOKEN.source, "g"))].map((match) => match[1]).filter((name) => !known.has(name)))]
  return unknown.length ? t("admin.notif.validation.unknownVariables", { names: unknown.join(", ") }) : ""
}
