"use client"

import { useRef, useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Paperclip, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { uploadExerciseFile, exerciseFileURL } from "@/api/exercises/files"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

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
  const [error, setError] = useState<string | null>(null)

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow picking the same file again
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadExerciseFile(file)
      append({ FileID: uploaded.FileID, Name: uploaded.Name })
    } catch (err) {
      setError(exerciseErrorMessage(err))
    } finally {
      setUploading(false)
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner label={t("admin.exFiles.uploading")} />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {fields.length === 0 && !uploading ? (
        <p className="text-xs text-muted-foreground">{t("admin.exFiles.empty")}</p>
      ) : (
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`remove-attachment-${ai}`}
                  onClick={() => remove(ai)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
