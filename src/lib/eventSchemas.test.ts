/**
 * eventSchemas.test.ts — tag/name/date validation + datetime round-trip.
 * t is mocked identity so a zod message equals its i18n key.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { eventFormSchema, isoToLocal, localToIso } from './eventSchemas'

const valid = {
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00',
  ArchiveAt: '2026-03-08T00:00',
}

describe('eventFormSchema', () => {
  it('accepts a valid form', () => {
    expect(eventFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a tag with uppercase or symbols', () => {
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'Spring-CTF' }).success).toBe(false)
  })

  it('rejects a tag shorter than 3 or longer than 64', () => {
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'ab' }).success).toBe(false)
    expect(eventFormSchema.safeParse({ ...valid, Tag: 'a'.repeat(65) }).success).toBe(false)
  })

  it('accepts an empty name but rejects one over 255 chars', () => {
    expect(eventFormSchema.safeParse({ ...valid, Name: '' }).success).toBe(true)
    expect(eventFormSchema.safeParse({ ...valid, Name: 'x'.repeat(256) }).success).toBe(false)
  })

  it('rejects when ArchiveAt is not strictly after AvailableFrom', () => {
    const r = eventFormSchema.safeParse({ ...valid, ArchiveAt: valid.AvailableFrom })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'admin.events.val.dates')).toBe(true)
    }
  })

  it('rejects empty date fields', () => {
    expect(eventFormSchema.safeParse({ ...valid, AvailableFrom: '' }).success).toBe(false)
    expect(eventFormSchema.safeParse({ ...valid, ArchiveAt: '' }).success).toBe(false)
  })
})

describe('datetime helpers', () => {
  it('round-trips a local value through localToIso → isoToLocal', () => {
    const local = '2026-03-01T09:30'
    expect(isoToLocal(localToIso(local))).toBe(local)
  })

  it('returns "" for empty or invalid input', () => {
    expect(isoToLocal('')).toBe('')
    expect(isoToLocal('not-a-date')).toBe('')
    expect(localToIso('')).toBe('')
    expect(localToIso('not-a-date')).toBe('')
  })

  it('localToIso produces a Z-terminated RFC3339 string', () => {
    expect(localToIso('2026-03-01T09:30')).toMatch(/Z$/)
  })
})
