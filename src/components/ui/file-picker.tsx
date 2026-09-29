"use client"

import { useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n/t"

// DS file picker: «Обрати файл», the chosen file name and a clear action
// instead of the browser's native control.
export function FilePicker({ id, fileName, onFile, accept, disabled = false, describedBy }: {
  id: string
  fileName: string | null
  onFile: (file: File | null) => void
  accept?: string
  disabled?: boolean
  describedBy?: string
}) {
  const input = useRef<HTMLInputElement | null>(null)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => { const file = e.target.files?.[0] ?? null; e.target.value = ""; onFile(file) }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} aria-describedby={describedBy} onClick={() => input.current?.click()}>
        {t("admin.files.choose")}
      </Button>
      <span className={fileName ? "min-w-0 flex-1 truncate text-sm text-foreground" : "min-w-0 flex-1 truncate text-sm text-muted-foreground"}>
        {fileName ?? t("admin.files.none")}
      </span>
      {fileName && (
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("admin.files.clear", { name: fileName })} onClick={() => onFile(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
