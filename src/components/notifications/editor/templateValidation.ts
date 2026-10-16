import { t } from "@/i18n/t"
import { inspectTemplate, type VariableDef } from "./variableUtils"

/** Inline guidance only: saving drafts and existing send rules retain their own contracts. */
export function templateFieldError(value: unknown, variables: VariableDef[], required = false): string {
  if (required && typeof value === "string" && !value.trim()) return t("admin.notif.validation.required")
  const template = inspectTemplate(value)
  for (const text of template.texts) {
    let start = text.indexOf("{{")
    while (start !== -1) {
      const end = text.indexOf("}}", start + 2)
      if (end === -1) return t("admin.notif.validation.syntax")
      start = text.indexOf("{{", end + 2)
    }
  }
  if (variables.length === 0) return ""
  const known = new Set(variables.map(({ name }) => name))
  const unknown = template.variables.filter((name) => !known.has(name))
  return unknown.length ? t("admin.notif.validation.unknownVariables", { names: unknown.join(", ") }) : ""
}
