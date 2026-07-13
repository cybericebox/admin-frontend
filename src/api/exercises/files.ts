/**
 * files.ts — загрузка вложений (multipart) и download-URL.
 *
 * НЕ через apiPost: request() в client.ts всегда ставит Content-Type:
 * application/json, что ломает multipart boundary. Здесь собственный fetch
 * с credentials: "include" и тем же envelope-unwrap.
 */
import { ApiError } from "@/api/client"
import { awaitAuthBootstrap } from "@/lib/silentAuth"

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const FILES = "/api/exercises/files"

export type UploadedFile = { FileID: string; Name: string; Size: number }

/** URL для скачивания (GET /api/exercises/files/:fileID, cookie-auth — годится для <a href>). */
export function exerciseFileURL(fileId: string): string {
  return `${BASE_URL}${FILES}/${fileId}`
}

/** POST /api/exercises/files (multipart, поле "file"). */
export async function uploadExerciseFile(file: File): Promise<UploadedFile> {
  await awaitAuthBootstrap()
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
