/**
 * eventSchemas.ts — zod mirror of the backend event validation + datetime
 * conversion between RFC3339 (API) and the datetime-local input value.
 * The server is authoritative; this only improves UX before the request.
 */
import { z } from 'zod'
import { t } from '@/i18n/t'

export const TAG_RE = /^[a-z0-9]+$/

export const eventFormSchema = z
  .object({
    Tag: z
      .string()
      .regex(TAG_RE, t('admin.events.val.tag'))
      .min(3, t('admin.events.val.tag'))
      .max(64, t('admin.events.val.tag')),
    Name: z.string().max(255, t('admin.events.val.name')),
    AvailableFrom: z.string().min(1, t('admin.events.val.availableFrom')),
    ArchiveAt: z.string().min(1, t('admin.events.val.archiveAt')),
  })
  .refine(
    (v) => {
      const from = new Date(v.AvailableFrom).getTime()
      const to = new Date(v.ArchiveAt).getTime()
      return Number.isFinite(from) && Number.isFinite(to) && to > from
    },
    { message: t('admin.events.val.dates'), path: ['ArchiveAt'] },
  )

export type EventFormValues = z.infer<typeof eventFormSchema>

/** RFC3339 → "YYYY-MM-DDTHH:mm" (local time). "" for empty/invalid. */
export function isoToLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local) → RFC3339 UTC. "" for empty/invalid. */
export function localToIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}
