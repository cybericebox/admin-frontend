/**
 * inAppTemplates.test.ts — TDD RED→GREEN for the in-app template API module.
 *
 * vi.mock('@/api/client') intercepts all apiGet/apiPost/apiPut/apiDelete calls.
 * The tests pin exact path strings derived from the SP1 handler's Init routes:
 *   /api/notifications/templates/inapp[/:id[/publish|/rollback]]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client BEFORE importing the module under test.
vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listInAppTemplates,
  latestInAppTemplates,
  getInAppTemplate,
  createInAppTemplate,
  updateInAppTemplate,
  deleteInAppTemplate,
  publishInAppTemplate,
  rollbackInAppTemplate,
} from './inAppTemplates'

const mockApiGet    = vi.mocked(client.apiGet)
const mockApiPost   = vi.mocked(client.apiPost)
const mockApiPut    = vi.mocked(client.apiPut)
const mockApiDelete = vi.mocked(client.apiDelete)

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TEMPLATE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

/** Minimal raw template as the backend emits. */
const rawTemplate = {
  ID:               TEMPLATE_ID,
  NotificationType: 'account_alert',
  Status:           'draft' as const,
  Title:            'Alert!',
  Body:             'Something happened.',
  Link:             '/dashboard',
  Icon:             'bell',
  Tone:             'warning',
  AccentColor:      '#f59e0b',
  Surface:          'banner',
  AutoDismissMs:    5000,
  Actions:          [{ label: 'View', href: '/dashboard' }],
  PublishedAt:      null,
  UpdatedByUserID:  null,
  CreatedAt:        '2024-01-01T00:00:00Z',
  UpdatedAt:        '2024-01-01T00:00:00Z',
}

/** Raw template where Actions is null — must be normalised to []. */
const rawTemplateNullActions = {
  ...rawTemplate,
  Actions: null,
}

// ── listInAppTemplates ─────────────────────────────────────────────────────────

describe('listInAppTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the correct base path when no filter', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listInAppTemplates()
    expect(mockApiGet).toHaveBeenCalledOnce()
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toBe('/api/notifications/templates/inapp')
  })

  it('appends status query param when filter.status is provided', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listInAppTemplates({ status: 'draft' })
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toContain('status=draft')
  })

  it('appends type query param when filter.type is provided', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [], MissingActiveFor: [] })
    await listInAppTemplates({ type: 'account_alert' })
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toContain('type=account_alert')
  })

  it('normalises null Actions in list results', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [rawTemplateNullActions], MissingActiveFor: [] })
    const result = await listInAppTemplates()
    expect(result.Templates[0].Actions).toEqual([])
  })

  it('returns MissingActiveFor in list response', async () => {
    mockApiGet.mockResolvedValueOnce({ Templates: [rawTemplate], MissingActiveFor: ['alert'] })
    const result = await listInAppTemplates()
    expect(result.MissingActiveFor).toEqual(['alert'])
  })
})

// ── latestInAppTemplates ───────────────────────────────────────────────────────

describe('latestInAppTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the /latest path', async () => {
    mockApiGet.mockResolvedValueOnce([])
    await latestInAppTemplates()
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/notifications/templates/inapp/latest')
  })

  it('normalises null Actions in Draft/Published/Unpublished', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        NotificationType: 'account_alert',
        Draft:            rawTemplateNullActions,
        Published:        null,
        Unpublished:      null,
      },
    ])
    const result = await latestInAppTemplates()
    expect(result[0].NotificationType).toBe('account_alert')
    expect(result[0].Draft?.Actions).toEqual([])
    expect(result[0].Published).toBeNull()
  })
})

// ── getInAppTemplate ───────────────────────────────────────────────────────────

describe('getInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with /:id path', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplate)
    await getInAppTemplate(TEMPLATE_ID)
    expect(mockApiGet).toHaveBeenCalledOnce()
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/notifications/templates/inapp/${TEMPLATE_ID}`)
  })

  it('returns the normalised template', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplate)
    const result = await getInAppTemplate(TEMPLATE_ID)
    expect(result.ID).toBe(TEMPLATE_ID)
    expect(result.Actions).toEqual([{ label: 'View', href: '/dashboard' }])
  })

  it('normalises null Actions to []', async () => {
    mockApiGet.mockResolvedValueOnce(rawTemplateNullActions)
    const result = await getInAppTemplate(TEMPLATE_ID)
    expect(result.Actions).toEqual([])
  })
})

// ── createInAppTemplate ────────────────────────────────────────────────────────

describe('createInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to the base in-app path', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await createInAppTemplate({
      NotificationType: 'account_alert',
      Title:            'Alert!',
      Body:             'Something happened.',
      Link:             '/dashboard',
      Icon:             'bell',
      Tone:             'warning',
      AccentColor:      '#f59e0b',
      Surface:          'banner',
      AutoDismissMs:    null,
      Actions:          [],
    })
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/notifications/templates/inapp')
  })

  it('normalises null Actions in create response', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplateNullActions)
    const result = await createInAppTemplate({
      NotificationType: 'account_alert',
      Title: 'Alert!', Body: '', Link: '', Icon: '', Tone: '', AccentColor: '', Surface: '',
      AutoDismissMs: null, Actions: [],
    })
    expect(result.Actions).toEqual([])
  })
})

// ── updateInAppTemplate ────────────────────────────────────────────────────────

describe('updateInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PUTs to /:id', async () => {
    mockApiPut.mockResolvedValueOnce(rawTemplate)
    await updateInAppTemplate(TEMPLATE_ID, {
      Title: 'Updated', Body: '', Link: '', Icon: '', Tone: '', AccentColor: '', Surface: '',
      AutoDismissMs: null, Actions: [],
    })
    expect(mockApiPut).toHaveBeenCalledOnce()
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/notifications/templates/inapp/${TEMPLATE_ID}`)
  })
})

// ── deleteInAppTemplate ────────────────────────────────────────────────────────

describe('deleteInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs /:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteInAppTemplate(TEMPLATE_ID)
    expect(mockApiDelete).toHaveBeenCalledOnce()
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/notifications/templates/inapp/${TEMPLATE_ID}`)
  })
})

// ── publishInAppTemplate ───────────────────────────────────────────────────────

describe('publishInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /:id/publish', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await publishInAppTemplate(TEMPLATE_ID)
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/notifications/templates/inapp/${TEMPLATE_ID}/publish`)
  })

  it('normalises null Actions in publish response', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplateNullActions)
    const result = await publishInAppTemplate(TEMPLATE_ID)
    expect(result.Actions).toEqual([])
  })
})

// ── rollbackInAppTemplate ──────────────────────────────────────────────────────

describe('rollbackInAppTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /:id/rollback', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplate)
    await rollbackInAppTemplate(TEMPLATE_ID)
    expect(mockApiPost).toHaveBeenCalledOnce()
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/notifications/templates/inapp/${TEMPLATE_ID}/rollback`)
  })

  it('normalises null Actions in rollback response', async () => {
    mockApiPost.mockResolvedValueOnce(rawTemplateNullActions)
    const result = await rollbackInAppTemplate(TEMPLATE_ID)
    expect(result.Actions).toEqual([])
  })
})
