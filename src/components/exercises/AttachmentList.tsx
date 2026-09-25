"use client"

import { useRef, useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Paperclip } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { uploadExerciseFile, exerciseFileURL } from "@/api/exercises/files"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import { RemoveAction } from "./RemoveAction"

/**
 * AttachmentList — task attachments. Upload: POST /api/exercises/files
 * (multipart), size limit is enforced by the backend (ErrFileTooLarge →
 * i18n dictionary). Download: a plain link (cookie-auth). The files
 * themselves don't live in the form — only {FileID, Name}.
 */
export function AttachmentList({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks.${taskIndex}.Attachments` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow picking the same file again
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const uploaded = await uploadExerciseFile(file, setProgress)
      append({ FileID: uploaded.FileID, Name: uploaded.Name })
    } catch (err) {
      setError(exerciseErrorMessage(err))
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exFiles.title")}</span>
        {!disabled && (
          <>
            <input
              ref={fileRef}
              data-testid="attachment-file-input"
              type="file"
              className="hidden"
              onChange={onPicked}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="mr-1 h-4 w-4" />
              {t("admin.exFiles.upload")}
            </Button>
          </>
        )}
      </div>

      {uploading && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{t("admin.exFiles.uploading")}</span><span>{progress ?? 0}%</span></div>
          <div role="progressbar" aria-label={t("admin.exFiles.uploading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0} className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress ?? 0}%` }} /></div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {fields.length > 0 && (
        <ul className="space-y-1">
          {fields.map((field, ai) => (
            <li key={field.id} className="flex items-center gap-2 text-sm">
              <a
                href={exerciseFileURL(field.FileID)}
                download={field.Name}
                className="text-primary hover:underline"
              >
                {field.Name}
              </a>
              {!disabled && (
                <RemoveAction ariaLabel={t("admin.exFiles.remove")} onClick={() => remove(ai)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
