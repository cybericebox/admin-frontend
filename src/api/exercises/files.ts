/**
 * files.ts — attachment upload (multipart) and download URL.
 *
 * NOT via apiPost: request() in client.ts always sets Content-Type:
 * application/json, which breaks the multipart boundary. This uses its own fetch
 * with credentials: "include" and the same envelope-unwrap.
 */
import { ApiError } from "@/api/client"

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? ""
const BASE_URL = DOMAIN ? `https://api.${DOMAIN}` : ""
const FILES = "/api/exercises/files"

export type UploadedFile = { FileID: string; Name: string; Size: number }

/** Download URL (GET /api/exercises/files/:fileID, cookie-auth — suitable for <a href>). */
export function exerciseFileURL(fileId: string): string {
  return `${BASE_URL}${FILES}/${fileId}`
}

/** POST /api/exercises/files (multipart, field "file"). */
export async function uploadExerciseFile(file: File): Promise<UploadedFile> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE_URL}${FILES}`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const raw = await res.text()
  let parsed: unknown = raw
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
    }
  }
  const envelope =
    parsed && typeof parsed === "object"
      ? (parsed as { Status?: { Code?: number; Message?: string }; Data?: unknown })
      : undefined
  if (!res.ok) {
    throw new ApiError(res.status, parsed, envelope?.Status?.Message)
  }
  return envelope?.Data as UploadedFile
}
