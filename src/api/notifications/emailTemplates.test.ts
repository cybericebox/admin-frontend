/**
 * emailTemplates.test.ts — TDD RED→GREEN for the email-template + preset API module.
 *
 * vi.mock('@/api/client') intercepts all apiGet/apiPost/apiPut/apiDelete calls.
 * The tests pin exact path strings derived from the SP1 handler's Init routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client BEFORE importing the module under test.
vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listEmailTemplates,
  latestEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  publishEmailTemplate,
  rollbackEmailTemplate,
  listBlockPresets,
  getBlockPreset,
  createBlockPreset,
  updateBlockPreset,
  deleteBlockPreset,
} from './emailTemplates'

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPost = vi.mocked(client.apiPost)
const mockApiPut = vi.mocked(client.apiPut)
const mockApiDelete = vi.mocked(client.apiDelete)

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TEMPLATE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const PRESET_ID   = 'ffffffff-0000-1111-2222-333333333333'

/** Minimal raw template as the backend emits (Body/Styling as parsed JSON). */
const rawTemplate = {
  ID:               TEMPLATE_ID,
  NotificationType: 'welcome',
  Status:           'draft' as const,
  Subject:          'Welcome!',
  Preheader:        'Thanks for joining',
  Body:             [{ type: 'divider' }],
  Styling:          { cta_bg_color: '#000' },
  PublishedAt:      null,
  UpdatedByUserID:  null,
  CreatedAt:        '2024-01-01T00:00:00Z',
  UpdatedAt:        '2024-01-01T00:00:00Z',
}

/** Raw template where Body and Styling are null — must be normalised to []/{}. */
const rawTemplateNullFields = {
  ...rawTemplate,
  Body:    null,
  Styling: null,
}

const rawPreset = {
  ID:          PRESET_ID,
  Name:        'Hero block',
  Description: 'A hero section',
  Blocks:      [{ type: 'divider' }],
  CreatedAt:   '2024-01-01T00:00:00Z',
  UpdatedAt:   '2024-01-01T00:00:00Z',
}

// ── listEmailTemplates ─────────────────────────────────────────────────────────

describe('listEmailTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the correct base path when no filter', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listEmailTemplates()
    expect(mockApiGet).toHaveBeenCalledOnce()
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toBe('/api/notifications/templates/email')
  })

  it('appends status query param when filter.status is provided', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listEmailTemplates({ status: 'draft' })
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toContain('status=draft')
  })

  it('appends type query param when filter.type is provided', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listEmailTemplates({ type: 'welcome' })
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toContain('type=welcome')
  })

  it('normalises null Body/Styling in Templates list', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [rawTemplateNullFields], MissingActiveFor: [] })
    const result = await listEmailTemplates()
    expect(result.Templates[0].Body).toEqual([])
    expect(result.Templates[0].Styling).toEqual({})
  })
})

// ── latestEmailTemplates ───────────────────────────────────────────────────────

describe('latestEmailTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the /latest path', async () => {
    mockApiGet.mockResolvedValueOnce([])
    await latestEmailTemplates()
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/notifications/templates/email/latest')
  })

  it('normalises null Body/Styling in Draft/Published/Unpublished', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        NotificationType: 'welcome',
        Draft:       rawTemplateNullFields,
        Published:   null,
        Unpublished: null,
      },
    ])
    const result = await latestEmailTemplates()
    expect(result[0].NotificationType).toBe('welcome')
    expect(result[0].Draft?.Body).toEqual([])
    expect(result[0].Draft?.Styling).toEqual({})
    expect(result[0].Published).toBeNull()
  })
})

// ── getEmailTemplate ───────────────────────────────────────────────────────────

describe('getEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with /:id path', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplate)
    await getEmailTemplate(TEMPLATE_ID)
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/notifications/templates/email/${TEMPLATE_ID}`)
  })

  it('returns the normalised template', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplate)
    const result = await getEmailTemplate(TEMPLATE_ID)
    expect(result.ID).toBe(TEMPLATE_ID)
    expect(result.Body).toEqual([{ type: 'divider' }])
  })

  it('normalises null Body to []', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplateNullFields)
    const result = await getEmailTemplate(TEMPLATE_ID)
    expect(result.Body).toEqual([])
  })

  it('normalises null Styling to {}', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplateNullFields)
    const result = await getEmailTemplate(TEMPLATE_ID)
    expect(result.Styling).toEqual({})
  })
})

// ── createEmailTemplate ────────────────────────────────────────────────────────

describe('createEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to the base email path', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await createEmailTemplate({ NotificationType: 'welcome', Subject: 'Hi', Preheader: '', Body: [], Styling: {} })
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/notifications/templates/email')
  })
})

// ── updateEmailTemplate ────────────────────────────────────────────────────────

describe('updateEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PUTs to /:id', async () => {
    mockApiPut.mockResolvedValueOnce(rawTemplate)
    await updateEmailTemplate(TEMPLATE_ID, { Subject: 'New', Preheader: '', Body: [], Styling: {} })
    expect(mockApiPut).toHaveBeenCalledOnce()
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/notifications/templates/email/${TEMPLATE_ID}`)
  })
})

// ── deleteEmailTemplate ────────────────────────────────────────────────────────

describe('deleteEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs /:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteEmailTemplate(TEMPLATE_ID)
    expect(mockApiDelete).toHaveBeenCalledOnce()
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/notifications/templates/email/${TEMPLATE_ID}`)
  })
})

// ── publishEmailTemplate ───────────────────────────────────────────────────────

describe('publishEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /:id/publish', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await publishEmailTemplate(TEMPLATE_ID)
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/notifications/templates/email/${TEMPLATE_ID}/publish`)
  })

  it('normalises null Body/Styling in publish response', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplateNullFields)
    const result = await publishEmailTemplate(TEMPLATE_ID)
    expect(result.Body).toEqual([])
    expect(result.Styling).toEqual({})
  })
})

// ── rollbackEmailTemplate ──────────────────────────────────────────────────────

describe('rollbackEmailTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /:id/rollback', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await rollbackEmailTemplate(TEMPLATE_ID)
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/notifications/templates/email/${TEMPLATE_ID}/rollback`)
  })
})

// ── Block presets ──────────────────────────────────────────────────────────────

describe('listBlockPresets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the block-presets path', async () => {
    mockApiGet.mockResolvedValueOnce([])
    await listBlockPresets()
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/notifications/templates/email/block-presets')
  })

  it('normalises null Blocks to []', async () => {
    mockApiGet.mockResolvedValueOnce([{ ...rawPreset, Blocks: null }])
    const result = await listBlockPresets()
    expect(result[0].Blocks).toEqual([])
  })
})

describe('getBlockPreset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with /block-presets/:id', async () => {
    mockApiGet.mockResolvedValueOnce(rawPreset)
    await getBlockPreset(PRESET_ID)
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/notifications/templates/email/block-presets/${PRESET_ID}`)
  })
})

describe('createBlockPreset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to the block-presets path', async () => {
    mockApiPost.mockResolvedValueOnce(rawPreset)
    await createBlockPreset({ Name: 'Hero', Description: 'A hero block', Blocks: [] })
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/notifications/templates/email/block-presets')
  })
})

describe('updateBlockPreset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PUTs to /block-presets/:id', async () => {
    mockApiPut.mockResolvedValueOnce(rawPreset)
    await updateBlockPreset(PRESET_ID, { Name: 'Hero v2', Description: '', Blocks: [] })
    expect(mockApiPut).toHaveBeenCalledOnce()
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/notifications/templates/email/block-presets/${PRESET_ID}`)
  })
})

describe('deleteBlockPreset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs /block-presets/:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteBlockPreset(PRESET_ID)
    expect(mockApiDelete).toHaveBeenCalledOnce()
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/notifications/templates/email/block-presets/${PRESET_ID}`)
  })
})
