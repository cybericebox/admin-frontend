/**
 * eventErrors.test.ts — FullCode → i18n key dictionary for event domain errors.
 * t is mocked "key → key" to assert the key choice specifically.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ApiError } from '@/api/client'
import {
  eventErrorCode,
  eventErrorMessage,
  ERR_EVENT_EXISTS,
  ERR_EVENT_MODIFIED,
} from './eventErrors'

function apiError(status: number, code: number, message: string): ApiError {
  return new ApiError(status, { Status: { Code: code, Message: message } }, message)
}

describe('eventErrorCode', () => {
  it('extracts the FullCode from the envelope body', () => {
    expect(eventErrorCode(apiError(409, 71103, 'modified'))).toBe(71103)
  })
  it('returns null for non-ApiError values', () => {
    expect(eventErrorCode(new Error('boom'))).toBeNull()
  })
})

describe('eventErrorMessage', () => {
  it('maps each known event code to its i18n key', () => {
    expect(eventErrorMessage(apiError(404, 31101, 'x'))).toBe('admin.events.err.notFound')
    expect(eventErrorMessage(apiError(409, ERR_EVENT_EXISTS, 'x'))).toBe('admin.events.err.exists')
    expect(eventErrorMessage(apiError(409, ERR_EVENT_MODIFIED, 'x'))).toBe('admin.events.err.modified')
    expect(eventErrorMessage(apiError(422, 21104, 'x'))).toBe('admin.events.err.tagInvalid')
    expect(eventErrorMessage(apiError(422, 21105, 'x'))).toBe('admin.events.err.datesInvalid')
    expect(eventErrorMessage(apiError(422, 21106, 'x'))).toBe('admin.events.err.nameTooLong')
    expect(eventErrorMessage(apiError(422, 21114, 'x'))).toBe('admin.events.err.nameRequired')
  })

  it('falls back to generic + backend Status.Message for unknown codes', () => {
    expect(eventErrorMessage(apiError(500, 42, 'weird backend fact')))
      .toBe('admin.events.err.generic: weird backend fact')
  })

  it('falls back to plain generic for non-ApiError', () => {
    expect(eventErrorMessage(new TypeError('offline'))).toBe('admin.events.err.generic')
  })
})
