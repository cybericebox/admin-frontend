"use client"

import { useId, type ReactNode } from "react"
import { t } from "@/i18n/t"

/** A labelled control group keeps custom controls and their help intact. */
export function FieldValidation({ error, children, label, errorId }: { error?: string; children: ReactNode; label?: string; errorId?: string }) {
  const generatedId = useId()
  const id = errorId ?? generatedId
  return <div role="group" aria-label={label ? t("admin.form.fieldValidation") : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined}>
    {children}
    {error && <p id={id} role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
}
