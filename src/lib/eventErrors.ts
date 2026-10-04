/**
 * eventErrors.ts — FullCode → i18n key dictionary for event domain errors.
 *
 * FullCode = informCode*10000 + objectCode*100 + detailCode (EventObjectCode = 11;
 * inform 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict).
 * Source: AP Backend internal/model/event/errors.go.
 * Unknown code → generic + backend Status.Message. 401/403 never reach here.
 */
import { ApiError } from '@/api/client'
import { t } from '@/i18n/t'

export const ERR_EVENT_EXISTS = 41102
export const ERR_EVENT_MODIFIED = 71103

export const CODE_TO_KEY: Record<number, string> = {
  31101: 'admin.events.err.notFound',
  41102: 'admin.events.err.exists',
  71103: 'admin.events.err.modified',
  21104: 'admin.events.err.tagInvalid',
  21142: 'admin.events.err.tagReserved',
  21105: 'admin.events.err.datesInvalid',
  21106: 'admin.events.err.nameTooLong',
  21114: 'admin.events.err.nameRequired',
  71123: 'admin.events.err.infrastructureUnavailable',
  71140: 'admin.events.err.infrastructureLocked',
  71141: 'admin.events.err.infrastructureInUse',
}

type EnvelopeBody = { Status?: { Code?: number; Message?: string } }

/** FullCode from the error body, or null (not an ApiError / no envelope). */
export function eventErrorCode(e: unknown): number | null {
  if (!(e instanceof ApiError)) return null
  const body = e.body as EnvelopeBody | null | undefined
  const code = body?.Status?.Code
  return typeof code === 'number' ? code : null
}

/** Human-readable (Ukrainian) message for any events API error. */
export function eventErrorMessage(e: unknown): string {
  const code = eventErrorCode(e)
  if (code !== null) {
    const key = CODE_TO_KEY[code]
    if (key) return t(key)
    const message = ((e as ApiError).body as EnvelopeBody | null | undefined)?.Status?.Message
    if (message) return `${t('admin.events.err.generic')}: ${message}`
  }
  return t('admin.events.err.generic')
}
